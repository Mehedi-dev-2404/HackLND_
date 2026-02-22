from pydantic import BaseModel, Field


class TaskSchema(BaseModel):
    task_id: str = Field(..., min_length=1)
    title: str
    module: str = "General"
    due_at: str | None = None
    module_weight_percent: int = 0
    estimated_hours: int = 0
    priority_score: int = 0
    priority_band: str = "low"
    completed: bool = False
    notes: str = ""
    created_at: str | None = None
    updated_at: str | None = None
