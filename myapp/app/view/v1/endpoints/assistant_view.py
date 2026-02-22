from fastapi import APIRouter, Depends

from app.core.dependencies import get_assistant_service
from app.models.schemas.assistant import AssistantChatRequest, AssistantChatResponse
from app.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=AssistantChatResponse)
def chat(
    request: AssistantChatRequest,
    service: AssistantService = Depends(get_assistant_service),
) -> AssistantChatResponse:
    payload = service.chat(
        conversation_id=request.conversation_id,
        message=request.message,
        context_page=request.context_page,
    )
    return AssistantChatResponse(**payload)
