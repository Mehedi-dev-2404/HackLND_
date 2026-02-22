from pydantic import BaseModel, Field


class DocumentUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1)
    content_type: str = Field(default="application/pdf")
    data_base64: str = Field(..., min_length=1)
    title: str = ""
    module: str = "General"
    report_type: str = "academic_report"
    user_id: str = ""


class DocumentSchema(BaseModel):
    doc_id: str
    doc_type: str
    user_id: str
    title: str
    filename: str
    content_type: str
    file_id: str
    module: str | None = None
    report_type: str | None = None
    pages: int = 0
    extracted_text: str = ""
    summary: str = ""
    highlights: list[str] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class DocumentListResponse(BaseModel):
    count: int
    documents: list[DocumentSchema]


class DocumentUploadResponse(BaseModel):
    document: DocumentSchema


class DocumentDownloadResponse(BaseModel):
    filename: str
    content_type: str
    data_base64: str
