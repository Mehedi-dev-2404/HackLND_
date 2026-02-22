from fastapi.testclient import TestClient

from app.core.dependencies import (
    get_assistant_service,
    get_document_service,
    get_job_discovery_service,
    get_scheduler_service,
)
from app.main import app


client = TestClient(app)


class FakeSchedulerService:
    def list_events(self, start_at=None, end_at=None):
        return [
            {
                "event_id": "evt-task-1",
                "task_id": "task-1",
                "title": "DB Revision",
                "start_at": "2026-02-22T10:00:00Z",
                "end_at": "2026-02-22T11:00:00Z",
                "source": "ai_scheduler",
                "status": "scheduled",
            }
        ]

    def add_task(self, **kwargs):
        task = type(
            "Task",
            (),
            {
                "id": "task-1",
                "title": kwargs["title"],
                "module": kwargs["module"],
                "due_at": kwargs.get("due_at"),
                "estimated_hours": kwargs.get("estimated_hours", 1),
                "completed": False,
            },
        )
        return task, self.list_events()

    def patch_task(self, task_id, patch):
        task = type(
            "Task",
            (),
            {
                "id": task_id,
                "title": patch.get("title") or "Patched",
                "module": patch.get("module") or "General",
                "due_at": patch.get("due_at"),
                "estimated_hours": patch.get("estimated_hours") or 1,
                "completed": bool(patch.get("completed", False)),
            },
        )
        return task, self.list_events()

    def reschedule(self):
        return self.list_events()


class FakeDocumentService:
    def upload_lecture_note(self, payload):
        return {
            "doc_id": "doc-1",
            "doc_type": "lecture_note",
            "user_id": "demo-user",
            "title": payload.get("title") or "Lecture",
            "filename": payload["filename"],
            "content_type": payload.get("content_type", "application/pdf"),
            "file_id": "abc123",
            "module": payload.get("module") or "General",
            "report_type": None,
            "pages": 3,
            "extracted_text": "Extracted",
            "summary": "Summary",
            "highlights": [],
        }

    def upload_academic_report(self, payload):
        return {
            "doc_id": "doc-2",
            "doc_type": "academic_report",
            "user_id": "demo-user",
            "title": payload.get("title") or "Report",
            "filename": payload["filename"],
            "content_type": payload.get("content_type", "application/pdf"),
            "file_id": "def456",
            "module": None,
            "report_type": payload.get("report_type") or "academic_report",
            "pages": 2,
            "extracted_text": "Extracted",
            "summary": "",
            "highlights": ["h1", "h2"],
        }

    def list_lecture_notes(self, user_id):
        return [self.upload_lecture_note({"filename": "lecture.pdf", "title": "Lecture"})]

    def list_academic_reports(self, user_id):
        return [self.upload_academic_report({"filename": "report.pdf", "title": "Report"})]

    def download_document(self, doc_id):
        return {
            "filename": "file.pdf",
            "content_type": "application/pdf",
            "data_base64": "ZmFrZQ==",
        }


class FakeAssistantService:
    def chat(self, conversation_id, message, context_page):
        return {
            "conversation_id": conversation_id,
            "reply": f"Echo: {message}",
            "model": "gemini-test",
            "fallback": True,
        }


class FakeJobDiscoveryService:
    def discover(self, query, location, limit):
        return {
            "query": query,
            "location": location,
            "jobs_added": 1,
            "jobs_updated": 0,
            "sources": ["https://www.linkedin.com/jobs/view/1"],
            "jobs": [
                {
                    "job_id": "job-1",
                    "title": "Software Engineer Intern",
                    "module": "Career",
                    "due_at": None,
                    "module_weight_percent": 30,
                    "estimated_hours": 4,
                    "notes": "Mock",
                    "company": "LinkedIn",
                    "location": location,
                    "source_url": "https://www.linkedin.com/jobs/view/1",
                    "match_score": 88,
                    "discovered_at": "2026-02-22T00:00:00Z",
                }
            ],
            "last_refreshed_at": "2026-02-22T00:00:00Z",
        }

    def list_jobs(self, auto_refresh=True):
        payload = self.discover("software engineer internship", "London", 10)
        return {
            "count": len(payload["jobs"]),
            "jobs": payload["jobs"],
            "last_refreshed_at": payload["last_refreshed_at"],
        }


def test_scheduler_add_task_endpoint() -> None:
    app.dependency_overrides[get_scheduler_service] = lambda: FakeSchedulerService()
    payload = {
        "title": "Finish DB schema",
        "module": "Databases",
        "due_at": "2026-02-25T16:00:00Z",
        "module_weight_percent": 40,
        "estimated_hours": 3,
        "notes": "Focus indexes",
    }
    response = client.post("/api/v1/scheduler/tasks", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == "task-1"
    assert len(body["events"]) == 1
    app.dependency_overrides.pop(get_scheduler_service, None)


def test_documents_upload_endpoint() -> None:
    app.dependency_overrides[get_document_service] = lambda: FakeDocumentService()
    payload = {
        "filename": "lecture.pdf",
        "content_type": "application/pdf",
        "data_base64": "ZmFrZQ==",
        "title": "Variables",
        "module": "Programming",
    }
    response = client.post("/api/v1/documents/lecture-notes/upload", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["document"]["doc_type"] == "lecture_note"
    app.dependency_overrides.pop(get_document_service, None)


def test_assistant_chat_endpoint() -> None:
    app.dependency_overrides[get_assistant_service] = lambda: FakeAssistantService()
    payload = {
        "conversation_id": "conv-1",
        "message": "What should I do first?",
        "context_page": "dashboard",
    }
    response = client.post("/api/v1/assistant/chat", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["conversation_id"] == "conv-1"
    assert "Echo" in body["reply"]
    app.dependency_overrides.pop(get_assistant_service, None)


def test_jobs_discover_endpoint() -> None:
    app.dependency_overrides[get_job_discovery_service] = lambda: FakeJobDiscoveryService()
    payload = {
        "query": "software engineer internship",
        "location": "London",
        "limit": 10,
    }
    response = client.post("/api/v1/jobs/discover", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["jobs_added"] == 1
    assert len(body["jobs"]) == 1
    app.dependency_overrides.pop(get_job_discovery_service, None)
