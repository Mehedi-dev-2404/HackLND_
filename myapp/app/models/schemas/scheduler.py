from pydantic import BaseModel, Field


class SchedulerTaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    module: str = Field(default="General")
    due_at: str | None = None
    module_weight_percent: int = Field(default=0, ge=0, le=100)
    estimated_hours: int = Field(default=1, ge=1, le=100)
    notes: str = ""


class SchedulerTaskPatchRequest(BaseModel):
    title: str | None = None
    module: str | None = None
    due_at: str | None = None
    module_weight_percent: int | None = Field(default=None, ge=0, le=100)
    estimated_hours: int | None = Field(default=None, ge=1, le=100)
    notes: str | None = None
    completed: bool | None = None


class CalendarEventSchema(BaseModel):
    event_id: str
    task_id: str
    title: str
    start_at: str
    end_at: str
    source: str = "ai_scheduler"
    status: str = "scheduled"
    created_at: str | None = None
    updated_at: str | None = None


class SchedulerEventsResponse(BaseModel):
    count: int
    events: list[CalendarEventSchema]


class SchedulerTaskResponse(BaseModel):
    task_id: str
    title: str
    module: str
    due_at: str | None = None
    estimated_hours: int
    completed: bool
    events: list[CalendarEventSchema]


class SchedulerRescheduleResponse(BaseModel):
    rescheduled_count: int
    events: list[CalendarEventSchema]
