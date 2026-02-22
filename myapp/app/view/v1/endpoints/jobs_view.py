from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_job_discovery_service
from app.models.schemas.jobs import (
    JobDiscoveryRequest,
    JobDiscoveryResponse,
    JobsListResponse,
)
from app.services.job_discovery_service import JobDiscoveryService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/discover", response_model=JobDiscoveryResponse)
def discover_jobs(
    request: JobDiscoveryRequest,
    service: JobDiscoveryService = Depends(get_job_discovery_service),
) -> JobDiscoveryResponse:
    try:
        payload = service.discover(
            query=request.query,
            location=request.location,
            limit=request.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Job discovery failed: {exc}") from exc
    return JobDiscoveryResponse(**payload)


@router.get("", response_model=JobsListResponse)
def list_jobs(
    service: JobDiscoveryService = Depends(get_job_discovery_service),
) -> JobsListResponse:
    payload = service.list_jobs(auto_refresh=True)
    return JobsListResponse(**payload)


@router.post("/refresh", response_model=JobDiscoveryResponse)
def refresh_jobs(
    request: JobDiscoveryRequest,
    service: JobDiscoveryService = Depends(get_job_discovery_service),
) -> JobDiscoveryResponse:
    try:
        payload = service.discover(
            query=request.query,
            location=request.location,
            limit=request.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Job refresh failed: {exc}") from exc
    return JobDiscoveryResponse(**payload)
