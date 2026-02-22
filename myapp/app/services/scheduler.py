from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from app.models.domain.task import Task
from app.models.persistence.calendar_event_repo import CalendarEventRepository
from app.models.persistence.task_repo import TaskRepository
from app.services.llm.provider_gemini import GeminiProvider
from app.utils.hashing import sha256_text


class SchedulerService:
    def __init__(
        self,
        task_repo: TaskRepository,
        event_repo: CalendarEventRepository,
        llm_provider: GeminiProvider,
        schedule_timezone: str = "Europe/London",
    ) -> None:
        self.task_repo = task_repo
        self.event_repo = event_repo
        self.llm_provider = llm_provider
        self.timezone = ZoneInfo(schedule_timezone)

    def _parse_iso(self, value: str | None) -> datetime | None:
        if not value:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = raw.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed

    def _to_utc_iso(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")

    def _round_up_30(self, dt: datetime) -> datetime:
        if dt.minute in {0, 30} and dt.second == 0 and dt.microsecond == 0:
            return dt
        minute = 30 if dt.minute < 30 else 60
        rounded = dt.replace(minute=0, second=0, microsecond=0) + timedelta(minutes=minute)
        return rounded

    def _fit_within_study_window(self, start: datetime, duration_minutes: int) -> datetime:
        cursor = start
        while True:
            day_start = cursor.replace(hour=9, minute=0, second=0, microsecond=0)
            day_end = cursor.replace(hour=21, minute=0, second=0, microsecond=0)
            if cursor < day_start:
                cursor = day_start
            if cursor + timedelta(minutes=duration_minutes) <= day_end:
                return cursor
            cursor = (cursor + timedelta(days=1)).replace(
                hour=9,
                minute=0,
                second=0,
                microsecond=0,
            )

    def _rank_tasks(self, tasks: list[Task]) -> list[Task]:
        if not tasks:
            return []

        payload = [
            {
                "id": task.id,
                "title": task.title,
                "module": task.module or task.subject or "General",
                "due_at": task.due_at,
                "module_weight_percent": int(task.module_weight_percent),
                "estimated_hours": int(task.estimated_hours or 1),
                "notes": task.notes,
            }
            for task in tasks
        ]
        llm_output = self.llm_provider.rate_tasks(tasks=payload)
        rated = {
            str(item.get("id")): int(item.get("priority_score", 0))
            for item in llm_output.get("rated_tasks", [])
            if isinstance(item, dict)
        }

        def sort_key(task: Task) -> tuple[int, datetime]:
            due = self._parse_iso(task.due_at) or datetime.max.replace(tzinfo=UTC)
            score = rated.get(task.id, int(task.priority_score or 0))
            task.priority_score = score
            return (-score, due)

        return sorted(tasks, key=sort_key)

    def _build_events_for_tasks(self, tasks: list[Task]) -> list[dict]:
        if not tasks:
            return []

        now_local = self._round_up_30(datetime.now(UTC).astimezone(self.timezone))
        cursor = now_local
        events: list[dict] = []

        for task in tasks:
            duration = max(30, min(8 * 60, int(task.estimated_hours or 1) * 60))
            start_local = self._fit_within_study_window(cursor, duration)

            due_utc = self._parse_iso(task.due_at)
            if due_utc is not None:
                due_local = due_utc.astimezone(self.timezone)
                candidate = self._round_up_30(due_local - timedelta(minutes=duration))
                candidate = self._fit_within_study_window(candidate, duration)
                if candidate >= now_local and candidate >= cursor:
                    start_local = candidate

            end_local = start_local + timedelta(minutes=duration)
            events.append(
                {
                    "event_id": f"evt-{task.id}",
                    "task_id": task.id,
                    "title": task.title,
                    "start_at": self._to_utc_iso(start_local),
                    "end_at": self._to_utc_iso(end_local),
                    "source": "ai_scheduler",
                    "status": "scheduled",
                }
            )
            cursor = self._round_up_30(end_local + timedelta(minutes=30))

        events.sort(key=lambda row: row["start_at"])
        return events

    def list_events(self, start_at: str | None = None, end_at: str | None = None) -> list[dict]:
        return self.event_repo.list_events(start_at=start_at, end_at=end_at)

    def add_task(
        self,
        title: str,
        module: str,
        due_at: str | None,
        module_weight_percent: int,
        estimated_hours: int,
        notes: str,
    ) -> tuple[Task, list[dict]]:
        now_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        task_id = f"task-{sha256_text(f'{title}|{now_iso}')[:12]}"
        task = Task(
            id=task_id,
            title=title,
            module=module,
            due_at=due_at,
            module_weight_percent=module_weight_percent,
            estimated_hours=estimated_hours,
            notes=notes,
            completed=False,
        )
        self.task_repo.upsert_tasks([task])
        events = self.reschedule()
        return task, events

    def patch_task(self, task_id: str, patch: dict) -> tuple[Task, list[dict]]:
        tasks = self.task_repo.list_tasks(limit=1000)
        target = next((task for task in tasks if task.id == task_id), None)
        if target is None:
            raise ValueError(f"Task not found: {task_id}")

        for field in [
            "title",
            "module",
            "due_at",
            "module_weight_percent",
            "estimated_hours",
            "notes",
            "completed",
        ]:
            if field in patch and patch[field] is not None:
                setattr(target, field, patch[field])

        self.task_repo.upsert_tasks([target])
        events = self.reschedule()
        return target, events

    def reschedule(self) -> list[dict]:
        tasks = self.task_repo.list_tasks(limit=1000)
        # Defensive filtering for legacy/bad rows in Mongo so reschedule does not fail hard.
        seen_ids: set[str] = set()
        active: list[Task] = []
        for task in tasks:
            task_id = str(getattr(task, "id", "") or "").strip()
            if not task_id or task_id in seen_ids:
                continue
            seen_ids.add(task_id)
            if bool(getattr(task, "completed", False)):
                continue
            active.append(task)
        ranked = self._rank_tasks(active)
        events = self._build_events_for_tasks(ranked)
        self.event_repo.replace_events(events)
        return events
