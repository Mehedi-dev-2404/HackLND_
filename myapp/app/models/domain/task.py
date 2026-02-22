from dataclasses import dataclass


@dataclass
class Task:
    id: str
    title: str
    subject: str = ""
    deadline: str = ""
    priority: int = 1
    module: str | None = None
    due_at: str | None = None
    priority_score: int | None = None
    module_weight_percent: int = 0
    estimated_hours: int = 0
    priority_band: str = "low"
    completed: bool = False
    notes: str = ""

    def __post_init__(self) -> None:
        if self.module and not self.subject:
            self.subject = self.module
        if self.subject and not self.module:
            self.module = self.subject

        if self.due_at and not self.deadline:
            self.deadline = self.due_at
        if self.deadline and not self.due_at:
            self.due_at = self.deadline

        if self.priority_score is None:
            self.priority_score = int(self.priority)
        self.priority = int(self.priority_score)
        self.completed = bool(self.completed)
