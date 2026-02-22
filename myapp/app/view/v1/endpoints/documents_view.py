from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_cached_settings, get_document_service
from app.core.config import Settings
from app.models.schemas.documents import (
    DocumentDownloadResponse,
    DocumentListResponse,
    DocumentUploadRequest,
    DocumentUploadResponse,
)
from app.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/lecture-notes/upload", response_model=DocumentUploadResponse)
def upload_lecture_notes(
    request: DocumentUploadRequest,
    service: DocumentService = Depends(get_document_service),
) -> DocumentUploadResponse:
    try:
        row = service.upload_lecture_note(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return DocumentUploadResponse(document=row)


@router.post("/academic-reports/upload", response_model=DocumentUploadResponse)
def upload_academic_reports(
    request: DocumentUploadRequest,
    service: DocumentService = Depends(get_document_service),
) -> DocumentUploadResponse:
    try:
        row = service.upload_academic_report(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return DocumentUploadResponse(document=row)


@router.get("/lecture-notes", response_model=DocumentListResponse)
def list_lecture_notes(
    user_id: str | None = Query(default=None),
    settings: Settings = Depends(get_cached_settings),
    service: DocumentService = Depends(get_document_service),
) -> DocumentListResponse:
    rows = service.list_lecture_notes(user_id=user_id or settings.default_user_id)
    return DocumentListResponse(count=len(rows), documents=rows)


@router.get("/academic-reports", response_model=DocumentListResponse)
def list_academic_reports(
    user_id: str | None = Query(default=None),
    settings: Settings = Depends(get_cached_settings),
    service: DocumentService = Depends(get_document_service),
) -> DocumentListResponse:
    rows = service.list_academic_reports(user_id=user_id or settings.default_user_id)
    return DocumentListResponse(count=len(rows), documents=rows)


@router.get("/{doc_id}/download", response_model=DocumentDownloadResponse)
def download_document(
    doc_id: str,
    service: DocumentService = Depends(get_document_service),
) -> DocumentDownloadResponse:
    try:
        payload = service.download_document(doc_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return DocumentDownloadResponse(**payload)
