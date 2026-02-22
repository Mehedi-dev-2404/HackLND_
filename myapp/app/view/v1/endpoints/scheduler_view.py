from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_scheduler_service
from app.models.schemas.scheduler import (
    SchedulerEventsResponse,
    SchedulerRescheduleResponse,
    SchedulerTaskCreateRequest,
    SchedulerTaskPatchRequest,
    SchedulerTaskResponse,
)
from app.services.scheduler import SchedulerService

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


@router.get("/events", response_model=SchedulerEventsResponse)
def list_events(
    start: str | None = None,
    end: str | None = None,
    service: SchedulerService = Depends(get_scheduler_service),
) -> SchedulerEventsResponse:
    events = service.list_events(start_at=start, end_at=end)
    return SchedulerEventsResponse(count=len(events), events=events)


@router.post("/tasks", response_model=SchedulerTaskResponse)
def add_task(
    request: SchedulerTaskCreateRequest,
    service: SchedulerService = Depends(get_scheduler_service),
) -> SchedulerTaskResponse:
    task, events = service.add_task(
        title=request.title,
        module=request.module,
        due_at=request.due_at,
        module_weight_percent=request.module_weight_percent,
        estimated_hours=request.estimated_hours,
        notes=request.notes,
    )
    return SchedulerTaskResponse(
        task_id=task.id,
        title=task.title,
        module=task.module or "General",
        due_at=task.due_at,
        estimated_hours=int(task.estimated_hours),
        completed=bool(task.completed),
        events=events,
    )


@router.patch("/tasks/{task_id}", response_model=SchedulerTaskResponse)
def patch_task(
    task_id: str,
    request: SchedulerTaskPatchRequest,
    service: SchedulerService = Depends(get_scheduler_service),
) -> SchedulerTaskResponse:
    try:
        task, events = service.patch_task(task_id=task_id, patch=request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SchedulerTaskResponse(
        task_id=task.id,
        title=task.title,
        module=task.module or "General",
        due_at=task.due_at,
        estimated_hours=int(task.estimated_hours),
        completed=bool(task.completed),
        events=events,
    )


@router.post("/reschedule", response_model=SchedulerRescheduleResponse)
def reschedule(
    service: SchedulerService = Depends(get_scheduler_service),
) -> SchedulerRescheduleResponse:
    events = service.reschedule()
    return SchedulerRescheduleResponse(rescheduled_count=len(events), events=events)
