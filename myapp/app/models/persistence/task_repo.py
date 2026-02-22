from app.models.domain.task import Task
from app.models.persistence.db import MongoDB
from app.utils.time import utc_now_iso


class TaskRepository:
    _INDEXES = [
        {"keys": [("task_id", 1)], "options": {"unique": True, "name": "uq_task_id"}},
        {
            "keys": [("priority_score", 1)],
            "options": {"name": "idx_priority_score_asc"},
        },
        {"keys": [("due_at", 1)], "options": {"name": "idx_due_at_asc"}},
        {"keys": [("completed", 1)], "options": {"name": "idx_completed_asc"}},
        {"keys": [("created_at", 1)], "options": {"name": "idx_created_at_asc"}},
        {"keys": [("updated_at", 1)], "options": {"name": "idx_updated_at_asc"}},
    ]

    def __init__(
        self,
        mongo_uri: str,
        db_name: str,
        mongodb: MongoDB | None = None,
        collection_name: str = "tasks",
        collection=None,
    ) -> None:
        self.mongodb = mongodb or MongoDB(
            mongo_uri=mongo_uri,
            db_name=db_name,
            collection_name=collection_name,
        )
        if collection is None:
            self.mongodb.ensure_indexes(self._INDEXES)
            self.collection = self.mongodb.collection
        else:
            self.collection = collection

    def _as_int(self, value: object, default: int = 0) -> int:
        try:
            return int(value)  # type: ignore[arg-type]
        except Exception:
            return int(default)

    def _as_bool(self, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"1", "true", "yes", "on"}:
                return True
            if lowered in {"0", "false", "no", "off", ""}:
                return False
        return bool(value)

    def _to_doc(self, task: Task, now_iso: str) -> dict:
        return {
            "task_id": task.id,
            "title": task.title,
            "module": task.module,
            "due_at": task.due_at,
            "module_weight_percent": self._as_int(task.module_weight_percent, default=0),
            "estimated_hours": self._as_int(task.estimated_hours, default=0),
            "priority_score": self._as_int(task.priority_score, default=0),
            "priority_band": task.priority_band,
            "completed": self._as_bool(task.completed),
            "notes": task.notes,
            "updated_at": now_iso,
        }

    def _to_task(self, row: dict) -> Task:
        return Task(
            id=row.get("task_id") or row.get("id", ""),
            title=row.get("title", ""),
            module=row.get("module", "General"),
            due_at=row.get("due_at"),
            module_weight_percent=self._as_int(row.get("module_weight_percent", 0), default=0),
            estimated_hours=self._as_int(row.get("estimated_hours", 0), default=0),
            priority_score=self._as_int(row.get("priority_score", 0), default=0),
            priority_band=row.get("priority_band", "low"),
            completed=self._as_bool(row.get("completed", False)),
            notes=row.get("notes", ""),
        )

    def list_tasks(self, limit: int = 200) -> list[Task]:
        cursor = (
            self.collection.find({}, {"_id": 0})
            .sort("created_at", -1)
            .limit(max(1, int(limit)))
        )
        return [self._to_task(row) for row in cursor]

    def upsert_tasks(self, tasks: list[Task]) -> int:
        if not tasks:
            return 0

        now_iso = utc_now_iso()
        for task in tasks:
            self.collection.update_one(
                {"task_id": task.id},
                {
                    "$set": self._to_doc(task, now_iso=now_iso),
                    "$setOnInsert": {"created_at": now_iso},
                },
                upsert=True,
            )
        return len(tasks)

    def replace_tasks(self, tasks: list[Task]) -> int:
        return self.upsert_tasks(tasks)
