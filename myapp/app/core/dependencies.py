from functools import lru_cache

from app.core.config import Settings, get_settings
from app.models.persistence.assistant_repo import AssistantConversationRepository
from app.models.persistence.calendar_event_repo import CalendarEventRepository
from app.models.persistence.document_repo import DocumentRepository
from app.models.persistence.job_repo import JobRepository
from app.models.persistence.task_repo import TaskRepository
from app.services.assistant_service import AssistantService
from app.services.document_service import DocumentService
from app.services.job_discovery_service import JobDiscoveryService
from app.services.llm.provider_gemini import GeminiProvider
from app.services.scheduler import SchedulerService
from app.services.socratic.agent import SocraticAgentService
from app.services.socratic.voice import ElevenLabsVoiceService
from app.services.workflow.pipeline import WorkflowPipeline


@lru_cache(maxsize=1)
def get_cached_settings() -> Settings:
    return get_settings()


@lru_cache(maxsize=1)
def get_job_repo() -> JobRepository:
    settings = get_cached_settings()
    return JobRepository(mongo_uri=settings.mongo_uri, db_name=settings.db_name)


@lru_cache(maxsize=1)
def get_task_repo() -> TaskRepository:
    settings = get_cached_settings()
    return TaskRepository(mongo_uri=settings.mongo_uri, db_name=settings.tasks_db_name)


@lru_cache(maxsize=1)
def get_calendar_event_repo() -> CalendarEventRepository:
    settings = get_cached_settings()
    return CalendarEventRepository(
        mongo_uri=settings.mongo_uri,
        db_name=settings.tasks_db_name,
    )


@lru_cache(maxsize=1)
def get_document_repo() -> DocumentRepository:
    settings = get_cached_settings()
    return DocumentRepository(
        mongo_uri=settings.mongo_uri,
        db_name=settings.docs_db_name,
    )


@lru_cache(maxsize=1)
def get_assistant_repo() -> AssistantConversationRepository:
    settings = get_cached_settings()
    return AssistantConversationRepository(
        mongo_uri=settings.mongo_uri,
        db_name=settings.docs_db_name,
    )



def get_llm_provider() -> GeminiProvider:
    settings = get_cached_settings()
    return GeminiProvider(
        model=settings.llm_model,
        api_key=settings.gemini_api_key,
        enable_live=settings.enable_live_llm,
    )


@lru_cache(maxsize=1)
def get_socratic_agent() -> SocraticAgentService:
    settings = get_cached_settings()
    return SocraticAgentService(
        model=settings.llm_model,
        api_key=settings.gemini_api_key,
        enable_live=settings.enable_live_llm,
    )


@lru_cache(maxsize=1)
def get_voice_service() -> ElevenLabsVoiceService:
    settings = get_cached_settings()
    return ElevenLabsVoiceService(api_key=settings.eleven_labs_api_key)


@lru_cache(maxsize=1)
def get_scheduler_service() -> SchedulerService:
    settings = get_cached_settings()
    return SchedulerService(
        task_repo=get_task_repo(),
        event_repo=get_calendar_event_repo(),
        llm_provider=get_llm_provider(),
        schedule_timezone=settings.schedule_timezone,
    )


@lru_cache(maxsize=1)
def get_document_service() -> DocumentService:
    settings = get_cached_settings()
    return DocumentService(
        document_repo=get_document_repo(),
        default_user_id=settings.default_user_id,
        max_upload_mb=settings.max_upload_mb,
        model=settings.llm_model,
        api_key=settings.gemini_api_key,
        enable_live=settings.enable_live_llm,
    )


@lru_cache(maxsize=1)
def get_assistant_service() -> AssistantService:
    settings = get_cached_settings()
    return AssistantService(
        model=settings.llm_model,
        api_key=settings.gemini_api_key,
        enable_live=settings.enable_live_llm,
        conversation_repo=get_assistant_repo(),
        job_repo=get_job_repo(),
        task_repo=get_task_repo(),
    )


@lru_cache(maxsize=1)
def get_job_discovery_service() -> JobDiscoveryService:
    settings = get_cached_settings()
    return JobDiscoveryService(
        job_repo=get_job_repo(),
        model=settings.llm_model,
        gemini_api_key=settings.gemini_api_key,
        enable_live=settings.enable_live_llm,
        serpapi_key=settings.serpapi_key,
    )



def get_workflow_pipeline() -> WorkflowPipeline:
    return WorkflowPipeline(
        job_repo=get_job_repo(),
        task_repo=get_task_repo(),
        llm_provider=get_llm_provider(),
    )
