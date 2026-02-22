from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import (
    SettingsValidationError,
    get_settings,
    validate_startup_dependencies,
)
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.view.v1.router import router as v1_router

logger = get_logger(__name__)

try:
    settings = get_settings()
except SettingsValidationError as exc:
    raise RuntimeError(f"Invalid application settings: {exc}") from exc

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        validate_startup_dependencies(settings)
        logger.info("Startup dependency checks passed")
    except SettingsValidationError as exc:
        raise RuntimeError(f"Startup dependency checks failed: {exc}") from exc
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
register_exception_handlers(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")

repo_root = Path(__file__).resolve().parents[2]
ui_dir = repo_root / "Mohammed"
if ui_dir.exists():
    app.mount("/ui", StaticFiles(directory=str(ui_dir), html=True), name="ui")


@app.get("/")
def root() -> dict:
    return {
        "service": settings.app_name,
        "status": "ok",
        "docs": "/docs",
        "api": "/api/v1",
        "ui": "/ui/code.html",
    }


@app.get("/app")
def app_ui() -> RedirectResponse:
    return RedirectResponse(url="/ui/code.html", status_code=307)
