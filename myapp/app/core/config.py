import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv


VALID_ENVIRONMENTS = {"development", "test", "staging", "production"}
MONGO_SCHEMES = {"mongodb", "mongodb+srv"}
DB_NAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class SettingsValidationError(ValueError):
    pass


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    environment: str
    gemini_api_key: str
    eleven_labs_api_key: str
    mongo_uri: str
    db_name: str
    tasks_db_name: str
    llm_model: str
    enable_live_llm: bool
    allowed_origins: list[str]
    ui_html_path: Path
    docs_db_name: str = "beacon_docs"
    serpapi_key: str = ""
    default_user_id: str = "demo-user"
    schedule_timezone: str = "Europe/London"
    max_upload_mb: int = 20

    def dependency_status(self) -> dict[str, bool]:
        return {
            "gemini_configured": bool(self.gemini_api_key.strip()),
            "eleven_labs_configured": bool(self.eleven_labs_api_key.strip()),
            "mongo_configured": bool(self.mongo_uri.strip()),
            "serpapi_configured": bool(self.serpapi_key.strip()),
        }


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_origins(value: str | None) -> list[str]:
    if not value:
        return ["*"]
    items = [item.strip() for item in value.split(",") if item.strip()]
    return items or ["*"]


def _parse_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value.strip())
    except Exception:
        return default


def _validate_settings(settings: Settings) -> None:
    errors: list[str] = []

    if not settings.app_name.strip():
        errors.append("APP_NAME cannot be blank")
    if not settings.app_version.strip():
        errors.append("APP_VERSION cannot be blank")
    if settings.environment not in VALID_ENVIRONMENTS:
        errors.append(
            "APP_ENV must be one of: development, test, staging, production"
        )
    if not settings.db_name.strip() or not DB_NAME_PATTERN.match(settings.db_name):
        errors.append("DB_NAME must match ^[A-Za-z0-9._-]{1,64}$")
    if not settings.tasks_db_name.strip() or not DB_NAME_PATTERN.match(
        settings.tasks_db_name
    ):
        errors.append("TASKS_DB_NAME must match ^[A-Za-z0-9._-]{1,64}$")
    if settings.db_name.strip() and settings.tasks_db_name.strip():
        if settings.db_name.strip() == settings.tasks_db_name.strip():
            errors.append("DB_NAME and TASKS_DB_NAME must be different databases")
    if not settings.docs_db_name.strip() or not DB_NAME_PATTERN.match(settings.docs_db_name):
        errors.append("DOCS_DB_NAME must match ^[A-Za-z0-9._-]{1,64}$")
    if settings.docs_db_name.strip() and settings.docs_db_name.strip() == settings.tasks_db_name.strip():
        errors.append("DOCS_DB_NAME and TASKS_DB_NAME must be different databases")
    if settings.docs_db_name.strip() and settings.docs_db_name.strip() == settings.db_name.strip():
        errors.append("DOCS_DB_NAME and DB_NAME must be different databases")
    if not settings.allowed_origins:
        errors.append("ALLOWED_ORIGINS cannot be empty")
    if settings.mongo_uri:
        parsed = urlparse(settings.mongo_uri)
        if parsed.scheme not in MONGO_SCHEMES:
            errors.append("MONGO_URI must use mongodb:// or mongodb+srv://")
    if settings.ui_html_path.suffix.lower() != ".html":
        errors.append("UI_HTML_PATH must point to an .html file")
    if not settings.ui_html_path.exists():
        errors.append(f"UI_HTML_PATH does not exist: {settings.ui_html_path}")
    if not settings.llm_model.strip():
        errors.append("LLM_MODEL cannot be blank")
    if not settings.default_user_id.strip():
        errors.append("DEFAULT_USER_ID cannot be blank")
    if not settings.schedule_timezone.strip():
        errors.append("SCHEDULE_TIMEZONE cannot be blank")
    if int(settings.max_upload_mb) <= 0:
        errors.append("MAX_UPLOAD_MB must be greater than zero")

    if errors:
        raise SettingsValidationError("; ".join(errors))


def validate_startup_dependencies(settings: Settings) -> None:
    missing: list[str] = []
    if not settings.mongo_uri.strip():
        missing.append("MONGO_URI")
    if not settings.gemini_api_key.strip():
        missing.append("GEMINI_API_KEY")

    if missing:
        raise SettingsValidationError(
            "Missing required startup environment variables: " + ", ".join(missing)
        )


def get_settings() -> Settings:
    myapp_root = Path(__file__).resolve().parents[2]
    repo_root = myapp_root.parent

    load_dotenv(myapp_root / ".env")

    ui_default = repo_root / "Mohammed" / "code.html"

    jobs_db_name = os.getenv("JOBS_DB_NAME", os.getenv("DB_NAME", "beacon_jobs"))
    tasks_db_name = os.getenv("TASKS_DB_NAME", "beacon_tasks")
    docs_db_name = os.getenv("DOCS_DB_NAME", "beacon_docs")

    settings = Settings(
        app_name=os.getenv("APP_NAME", "Beacon API"),
        app_version=os.getenv("APP_VERSION", "0.1.0"),
        environment=os.getenv("APP_ENV", "development"),
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        eleven_labs_api_key=os.getenv("ELEVEN_LABS_API_KEY", ""),
        mongo_uri=os.getenv("MONGO_URI", ""),
        db_name=jobs_db_name,
        tasks_db_name=tasks_db_name,
        docs_db_name=docs_db_name,
        llm_model=os.getenv("LLM_MODEL", "gemini-1.5-pro"),
        enable_live_llm=_parse_bool(os.getenv("ENABLE_LIVE_LLM"), default=False),
        serpapi_key=os.getenv("SERPAPI_KEY", ""),
        default_user_id=os.getenv("DEFAULT_USER_ID", "demo-user"),
        schedule_timezone=os.getenv("SCHEDULE_TIMEZONE", "Europe/London"),
        max_upload_mb=_parse_int(os.getenv("MAX_UPLOAD_MB"), default=20),
        allowed_origins=_parse_origins(os.getenv("ALLOWED_ORIGINS")),
        ui_html_path=Path(os.getenv("UI_HTML_PATH", str(ui_default))),
    )
    _validate_settings(settings)
    return settings
