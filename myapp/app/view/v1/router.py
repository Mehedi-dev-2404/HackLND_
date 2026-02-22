from fastapi import APIRouter

from app.view.v1.endpoints.assistant_view import router as assistant_router
from app.view.v1.endpoints.documents_view import router as documents_router
from app.view.v1.endpoints.health_view import router as health_router
from app.view.v1.endpoints.jobs_view import router as jobs_router
from app.view.v1.endpoints.llm_view import router as llm_router
from app.view.v1.endpoints.scheduler_view import router as scheduler_router
from app.view.v1.endpoints.scrape_view import router as scrape_router
from app.view.v1.endpoints.socratic_view import router as socratic_router
from app.view.v1.endpoints.workflow_view import router as workflow_router

router = APIRouter()
router.include_router(health_router)
router.include_router(scrape_router)
router.include_router(llm_router)
router.include_router(socratic_router)
router.include_router(workflow_router)
router.include_router(scheduler_router)
router.include_router(documents_router)
router.include_router(assistant_router)
router.include_router(jobs_router)
