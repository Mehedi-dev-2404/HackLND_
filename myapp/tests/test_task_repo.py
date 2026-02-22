from app.models.domain.task import Task
from app.models.persistence.task_repo import TaskRepository


class _FakeCursor:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows

    def sort(self, key: str, direction: int):
        reverse = direction == -1
        self.rows.sort(key=lambda row: row.get(key, ""), reverse=reverse)
        return self

    def limit(self, value: int):
        self.rows = self.rows[:value]
        return self

    def __iter__(self):
        return iter(self.rows)


class _FakeCollection:
    def __init__(self) -> None:
        self.docs: dict[str, dict] = {}

    def update_one(self, query: dict, update: dict, upsert: bool = False) -> None:
        task_id = query.get("id") or query.get("task_id")
        if not task_id:
            raise KeyError("id")
        existing = self.docs.get(task_id)

        if existing is None:
            existing = {}
            existing.update(update.get("$setOnInsert", {}))

        existing.update(update.get("$set", {}))
        self.docs[task_id] = existing

    def find(self, _query: dict, _projection: dict):
        rows = [dict(row) for row in self.docs.values()]
        return _FakeCursor(rows)


def test_task_repo_upsert_and_list_are_deterministic() -> None:
    fake_collection = _FakeCollection()
    repo = TaskRepository(
        mongo_uri="mongodb://localhost:27017",
        db_name="aura_tasks_test",
        collection=fake_collection,
    )

    first = Task(
        id="task-1",
        title="Math Homework",
        subject="Math",
        deadline="2026-02-25T16:00:00Z",
        priority=90,
    )
    second = Task(
        id="task-2",
        title="Business Essay",
        subject="Business",
        deadline="2026-02-28T16:00:00Z",
        priority=70,
    )

    assert repo.upsert_tasks([first, second]) == 2

    updated_first = Task(
        id="task-1",
        title="Math Homework Updated",
        subject="Math",
        deadline="2026-02-25T18:00:00Z",
        priority=95,
    )
    assert repo.upsert_tasks([updated_first]) == 1

    tasks = repo.list_tasks(limit=10)
    by_id = {task.id: task for task in tasks}
    assert len(by_id) == 2
    assert by_id["task-1"].title == "Math Homework Updated"
    assert by_id["task-1"].priority == 95
    assert by_id["task-1"].completed is False
