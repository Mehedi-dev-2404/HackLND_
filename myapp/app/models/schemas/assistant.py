from pydantic import BaseModel, Field


class AssistantChatRequest(BaseModel):
    conversation_id: str = Field(default="default-conversation", min_length=1)
    message: str = Field(..., min_length=1)
    context_page: str = "dashboard"


class AssistantChatResponse(BaseModel):
    conversation_id: str
    reply: str
    model: str
    fallback: bool
