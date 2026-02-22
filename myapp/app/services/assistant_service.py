from google import genai

from app.models.persistence.assistant_repo import AssistantConversationRepository
from app.models.persistence.job_repo import JobRepository
from app.models.persistence.task_repo import TaskRepository


class AssistantService:
    def __init__(
        self,
        model: str,
        api_key: str,
        enable_live: bool,
        conversation_repo: AssistantConversationRepository,
        job_repo: JobRepository,
        task_repo: TaskRepository,
    ) -> None:
        self.model = model
        self.enable_live = bool(enable_live and api_key.strip())
        self.client = genai.Client(api_key=api_key) if self.enable_live else None
        self.conversation_repo = conversation_repo
        self.job_repo = job_repo
        self.task_repo = task_repo

    def _generate_text(self, prompt: str) -> str:
        if self.client is None:
            raise ValueError("Live Gemini is disabled")

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={"temperature": 0.3},
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

    def _context_snapshot(self) -> str:
        tasks = self.task_repo.list_tasks(limit=5)
        jobs = self.job_repo.list_jobs(limit=5)

        task_lines = [
            f"- {task.title} | due={task.due_at or 'n/a'} | completed={bool(task.completed)}"
            for task in tasks
        ]
        if not task_lines:
            task_lines = ["- No tasks yet"]

        job_lines = [
            f"- {job.title} | module={job.module} | due={job.due_at or 'n/a'}"
            for job in jobs
        ]
        if not job_lines:
            job_lines = ["- No jobs yet"]

        return (
            "Recent tasks:\n"
            + "\n".join(task_lines)
            + "\n\nRecent jobs:\n"
            + "\n".join(job_lines)
        )

    def _history_text(self, conversation_id: str) -> str:
        history = self.conversation_repo.list_messages(conversation_id=conversation_id, limit=8)
        if not history:
            return "No prior messages."
        return "\n".join([f"{row['role']}: {row['text']}" for row in history])

    def _fallback_reply(self, message: str, context_page: str) -> str:
        return (
            f"Beacon assistant is in fallback mode. On {context_page}, I received: '{message}'. "
            "I can still help with scheduling, documents, jobs, and study planning once Gemini is enabled."
        )

    def chat(self, conversation_id: str, message: str, context_page: str) -> dict:
        self.conversation_repo.add_message(
            conversation_id=conversation_id,
            role="user",
            text=message,
            context_page=context_page,
        )

        prompt = (
            "You are Beacon, a concise student assistant.\n"
            f"Current page: {context_page}\n\n"
            "Use this context to answer helpfully and briefly.\n\n"
            f"{self._context_snapshot()}\n\n"
            "Conversation history:\n"
            f"{self._history_text(conversation_id)}\n\n"
            f"Latest user message: {message}"
        )

        fallback = False
        try:
            reply = self._generate_text(prompt)
        except Exception:
            reply = self._fallback_reply(message=message, context_page=context_page)
            fallback = True

        self.conversation_repo.add_message(
            conversation_id=conversation_id,
            role="assistant",
            text=reply,
            context_page=context_page,
        )
        return {
            "conversation_id": conversation_id,
            "reply": reply,
            "model": self.model,
            "fallback": fallback,
        }
