from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_socratic_agent, get_voice_service
from app.models.schemas.socratic import (
    AnswerEvaluationRequest,
    AnswerEvaluationResponse,
    CareerAnalysisRequest,
    CareerAnalysisResponse,
    ChunkRequest,
    ChunkResponse,
    IntegrityCheckRequest,
    IntegrityCheckResponse,
    SocraticQuestionRequest,
    SocraticQuestionResponse,
    VoiceSynthesisRequest,
    VoiceSynthesisResponse,
)
from app.services.socratic.agent import SocraticAgentService
from app.services.socratic.voice import ElevenLabsVoiceService

router = APIRouter(prefix="/socratic", tags=["socratic"])


@router.post("/question", response_model=SocraticQuestionResponse)
def generate_question(
    request: SocraticQuestionRequest,
    agent: SocraticAgentService = Depends(get_socratic_agent),
) -> SocraticQuestionResponse:
    payload = agent.socratic_viva(
        topic=request.topic,
        previous_answer=request.previous_answer,
        student_query=request.student_query,
    )
    return SocraticQuestionResponse(**payload)


@router.post("/evaluate-answer", response_model=AnswerEvaluationResponse)
def evaluate_answer(
    request: AnswerEvaluationRequest,
    agent: SocraticAgentService = Depends(get_socratic_agent),
) -> AnswerEvaluationResponse:
    payload = agent.evaluate_answer(
        topic=request.topic,
        question=request.question,
        answer=request.answer,
        reference_text=request.reference_text,
    )
    return AnswerEvaluationResponse(**payload)


@router.post("/integrity-check", response_model=IntegrityCheckResponse)
def integrity_check(
    request: IntegrityCheckRequest,
    agent: SocraticAgentService = Depends(get_socratic_agent),
) -> IntegrityCheckResponse:
    payload = agent.check_academic_integrity(request.query)
    return IntegrityCheckResponse(**payload)


@router.post("/career-analysis", response_model=CareerAnalysisResponse)
def career_analysis(
    request: CareerAnalysisRequest,
    agent: SocraticAgentService = Depends(get_socratic_agent),
) -> CareerAnalysisResponse:
    payload = agent.analyze_career_match(job_text=request.job_text)
    return CareerAnalysisResponse(**payload)


@router.post("/chunk", response_model=ChunkResponse)
def chunk_text_for_agent(
    request: ChunkRequest,
    agent: SocraticAgentService = Depends(get_socratic_agent),
) -> ChunkResponse:
    chunks: list[str]
    if request.strategy == "sentences":
        chunks = agent.chunk_by_sentences(
            text=request.text, sentences_per_chunk=request.sentences_per_chunk
        )
    elif request.strategy == "paragraphs":
        chunks = agent.chunk_by_paragraphs(
            text=request.text, max_paragraphs=request.max_paragraphs
        )
    else:
        chunks = agent.chunk_text(
            text=request.text,
            max_chunk_size=request.max_chunk_size,
            overlap=request.overlap,
        )

    return ChunkResponse(count=len(chunks), chunks=chunks)


@router.post("/voice", response_model=VoiceSynthesisResponse)
def synthesize_voice(
    request: VoiceSynthesisRequest,
    service: ElevenLabsVoiceService = Depends(get_voice_service),
) -> VoiceSynthesisResponse:
    try:
        payload = service.synthesize_base64(
            text=request.text,
            voice=request.voice,
            model=request.model,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice synthesis failed: {exc}") from exc
    return VoiceSynthesisResponse(**payload)
