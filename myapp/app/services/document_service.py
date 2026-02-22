import base64
from io import BytesIO
from typing import Any
from datetime import UTC, datetime

from google import genai
from pypdf import PdfReader

from app.models.persistence.document_repo import DocumentRepository
from app.utils.hashing import sha256_text


class DocumentService:
    def __init__(
        self,
        document_repo: DocumentRepository,
        default_user_id: str,
        max_upload_mb: int,
        model: str,
        api_key: str,
        enable_live: bool,
    ) -> None:
        self.document_repo = document_repo
        self.default_user_id = default_user_id
        self.max_upload_bytes = max(1, int(max_upload_mb)) * 1024 * 1024
        self.model = model
        self.enable_live = bool(enable_live and api_key.strip())
        self.client = genai.Client(api_key=api_key) if self.enable_live else None

    def _decode_pdf_bytes(self, data_base64: str, filename: str, content_type: str) -> bytes:
        if content_type.lower() != "application/pdf" and not filename.lower().endswith(".pdf"):
            raise ValueError("Only PDF uploads are supported")
        try:
            payload = base64.b64decode(data_base64, validate=True)
        except Exception as exc:
            raise ValueError("Invalid base64 file payload") from exc

        if not payload:
            raise ValueError("Uploaded file is empty")
        if len(payload) > self.max_upload_bytes:
            raise ValueError(
                f"File exceeds max upload size of {self.max_upload_bytes // (1024 * 1024)} MB"
            )
        return payload

    def _extract_pdf_text(self, file_bytes: bytes) -> tuple[str, int]:
        reader = PdfReader(BytesIO(file_bytes))
        pages: list[str] = []
        for page in reader.pages:
            pages.append((page.extract_text() or "").strip())
        text = "\n\n".join(part for part in pages if part).strip()
        if not text:
            text = "No extractable text found in PDF."
        return text[:12000], len(reader.pages)

    def _generate_text(self, prompt: str) -> str:
        if self.client is None:
            raise ValueError("Live Gemini is disabled")

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={"temperature": 0.2},
        )
        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                value = getattr(part, "text", None)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        raise ValueError("Gemini response did not include text")

    def _lecture_summary(self, title: str, module: str, extracted_text: str) -> str:
        if not self.enable_live:
            snippet = extracted_text[:280].replace("\n", " ").strip()
            return f"{module}: {title}. Preview: {snippet}"

        prompt = (
            "Summarize these lecture notes in 3 concise bullets for a student.\n"
            f"Module: {module}\n"
            f"Title: {title}\n"
            f"Content:\n{extracted_text[:8000]}"
        )
        try:
            return self._generate_text(prompt)
        except Exception:
            snippet = extracted_text[:280].replace("\n", " ").strip()
            return f"{module}: {title}. Preview: {snippet}"

    def _report_highlights(self, title: str, report_type: str, extracted_text: str) -> list[str]:
        if not self.enable_live:
            lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]
            return lines[:3] if lines else [f"Uploaded report: {title} ({report_type})"]

        prompt = (
            "Extract 3 short highlights from this academic report. "
            "Return plain lines only, no markdown.\n"
            f"Report type: {report_type}\n"
            f"Title: {title}\n"
            f"Content:\n{extracted_text[:8000]}"
        )
        try:
            text = self._generate_text(prompt)
            highlights = [line.strip("- \t") for line in text.splitlines() if line.strip()]
            return highlights[:3] if highlights else [f"Uploaded report: {title} ({report_type})"]
        except Exception:
            lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]
            return lines[:3] if lines else [f"Uploaded report: {title} ({report_type})"]

    def _build_doc_id(self, user_id: str, filename: str, title: str, doc_type: str) -> str:
        now_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        return f"doc-{sha256_text(f'{user_id}|{filename}|{title}|{doc_type}|{now_iso}')[:16]}"

    def upload_lecture_note(self, payload: dict[str, Any]) -> dict:
        filename = str(payload.get("filename") or "").strip()
        content_type = str(payload.get("content_type") or "application/pdf")
        data_base64 = str(payload.get("data_base64") or "")
        title = str(payload.get("title") or filename or "Lecture Note")
        module = str(payload.get("module") or "General")
        user_id = str(payload.get("user_id") or self.default_user_id)

        file_bytes = self._decode_pdf_bytes(data_base64, filename=filename, content_type=content_type)
        extracted_text, pages = self._extract_pdf_text(file_bytes)
        summary = self._lecture_summary(title=title, module=module, extracted_text=extracted_text)

        metadata = {
            "doc_id": self._build_doc_id(user_id=user_id, filename=filename, title=title, doc_type="lecture_note"),
            "doc_type": "lecture_note",
            "user_id": user_id,
            "module": module,
            "title": title,
            "filename": filename,
            "content_type": content_type,
            "pages": pages,
            "extracted_text": extracted_text,
            "summary": summary,
            "highlights": [],
            "report_type": None,
        }
        return self.document_repo.create_document(metadata=metadata, file_bytes=file_bytes)

    def upload_academic_report(self, payload: dict[str, Any]) -> dict:
        filename = str(payload.get("filename") or "").strip()
        content_type = str(payload.get("content_type") or "application/pdf")
        data_base64 = str(payload.get("data_base64") or "")
        title = str(payload.get("title") or filename or "Academic Report")
        report_type = str(payload.get("report_type") or "academic_report")
        user_id = str(payload.get("user_id") or self.default_user_id)

        file_bytes = self._decode_pdf_bytes(data_base64, filename=filename, content_type=content_type)
        extracted_text, pages = self._extract_pdf_text(file_bytes)
        highlights = self._report_highlights(
            title=title,
            report_type=report_type,
            extracted_text=extracted_text,
        )

        metadata = {
            "doc_id": self._build_doc_id(user_id=user_id, filename=filename, title=title, doc_type="academic_report"),
            "doc_type": "academic_report",
            "user_id": user_id,
            "module": None,
            "title": title,
            "filename": filename,
            "content_type": content_type,
            "pages": pages,
            "extracted_text": extracted_text,
            "summary": "",
            "highlights": highlights,
            "report_type": report_type,
        }
        return self.document_repo.create_document(metadata=metadata, file_bytes=file_bytes)

    def list_lecture_notes(self, user_id: str) -> list[dict]:
        return self.document_repo.list_documents(doc_type="lecture_note", user_id=user_id)

    def list_academic_reports(self, user_id: str) -> list[dict]:
        return self.document_repo.list_documents(doc_type="academic_report", user_id=user_id)

    def download_document(self, doc_id: str) -> dict:
        row = self.document_repo.get_document(doc_id)
        if row is None:
            raise ValueError(f"Document not found: {doc_id}")
        file_bytes = self.document_repo.read_file_bytes(row["file_id"])
        return {
            "filename": row["filename"],
            "content_type": row.get("content_type", "application/pdf"),
            "data_base64": base64.b64encode(file_bytes).decode("utf-8"),
        }
