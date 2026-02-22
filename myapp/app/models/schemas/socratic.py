from typing import Literal

from pydantic import BaseModel, Field


class IntegrityCheckRequest(BaseModel):
    query: str = Field(..., min_length=1)


class IntegrityCheckResponse(BaseModel):
    is_acceptable: bool
    reason: str
    severity: str


class SocraticQuestionRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    previous_answer: str | None = None
    student_query: str | None = None


class SocraticQuestionResponse(BaseModel):
    question: str
    fallback: bool = False
    integrity: IntegrityCheckResponse | None = None


class AnswerEvaluationRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    reference_text: str | None = None


class AnswerEvaluationResponse(BaseModel):
    score: int = Field(..., ge=0, le=100)
    comments: str
    strengths: list[str]
    improvements: list[str]
    fallback: bool = False


class CareerAnalysisRequest(BaseModel):
    job_text: str = Field(..., min_length=10)


class CareerAnalysisResponse(BaseModel):
    technical_skills: list[str]
    tools_technologies: list[str]
    cognitive_skills: list[str]
    behavioural_traits: list[str]
    experience_level: str
    fallback: bool = False


class ChunkRequest(BaseModel):
    text: str = Field(..., min_length=1)
    strategy: Literal["chars", "sentences", "paragraphs"] = "chars"
    max_chunk_size: int = Field(default=1000, ge=50, le=10000)
    overlap: int = Field(default=100, ge=0, le=2000)
    sentences_per_chunk: int = Field(default=5, ge=1, le=50)
    max_paragraphs: int = Field(default=3, ge=1, le=20)


class ChunkResponse(BaseModel):
    count: int
    chunks: list[str]


class VoiceSynthesisRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str = "Rachel"
    model: str = "eleven_monolingual_v1"


class VoiceSynthesisResponse(BaseModel):
    audio_base64: str
    content_type: str = "audio/mpeg"
    voice: str
    model: str
