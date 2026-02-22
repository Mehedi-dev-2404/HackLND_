import json
import re
import ssl
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen

from google import genai

from app.models.domain.job import Job
from app.models.persistence.job_repo import JobRepository
from app.utils.hashing import sha256_text


class JobDiscoveryService:
    def __init__(
        self,
        job_repo: JobRepository,
        model: str,
        gemini_api_key: str,
        enable_live: bool,
        serpapi_key: str,
    ) -> None:
        self.job_repo = job_repo
        self.model = model
        self.enable_live = bool(enable_live and gemini_api_key.strip())
        self.client = genai.Client(api_key=gemini_api_key) if self.enable_live else None
        self.serpapi_key = serpapi_key.strip()
        self.last_refreshed_at: str | None = None

    def _build_ssl_context(self) -> ssl.SSLContext:
        try:
            import certifi

            return ssl.create_default_context(cafile=certifi.where())
        except Exception:
            return ssl.create_default_context()

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

    def _extract_json(self, text: str) -> Any:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        match = re.search(r"(\{.*\}|\[.*\])", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("Could not parse JSON")
        return json.loads(match.group(1))

    def _search_serpapi(self, query: str, location: str, limit: int) -> list[dict]:
        if not self.serpapi_key:
            raise ValueError("SERPAPI_KEY is missing")

        q = f"site:linkedin.com/jobs {query} {location}".strip()
        params = {
            "engine": "google",
            "q": q,
            "num": max(1, min(int(limit), 20)),
            "api_key": self.serpapi_key,
        }
        url = "https://serpapi.com/search.json?" + urlencode(params)
        context = self._build_ssl_context()
        with urlopen(url, timeout=15, context=context) as response:
            payload = json.loads(response.read().decode("utf-8"))

        results = payload.get("organic_results", [])
        normalized = []
        for item in results:
            link = str(item.get("link") or "")
            title = str(item.get("title") or "")
            snippet = str(item.get("snippet") or "")
            if "linkedin.com/jobs" not in link.lower():
                continue
            if not title:
                continue
            normalized.append(
                {
                    "title": title,
                    "source_url": link,
                    "snippet": snippet,
                }
            )
            if len(normalized) >= limit:
                break
        return normalized

    def _fallback_jobs(self, rows: list[dict], location: str) -> list[dict]:
        jobs: list[dict] = []
        for index, row in enumerate(rows, start=1):
            title = row.get("title") or f"LinkedIn Role {index}"
            source_url = row.get("source_url")
            due_at = (
                datetime.now(UTC) + timedelta(days=10 + index)
            ).isoformat().replace("+00:00", "Z")
            jobs.append(
                {
                    "title": title,
                    "company": "LinkedIn",
                    "location": location,
                    "source_url": source_url,
                    "notes": row.get("snippet", "Discovered via SerpAPI"),
                    "module": "Career",
                    "due_at": due_at,
                    "module_weight_percent": 30,
                    "estimated_hours": 4,
                    "match_score": max(60, 95 - index * 3),
                }
            )
        return jobs

    def _normalize_with_gemini(self, rows: list[dict], query: str, location: str) -> list[dict]:
        if not rows:
            return []
        if not self.enable_live:
            return self._fallback_jobs(rows=rows, location=location)

        sources = "\n".join(
            [
                f"- title={item['title']} | url={item['source_url']} | snippet={item['snippet']}"
                for item in rows
            ]
        )
        prompt = (
            "Normalize these LinkedIn job search results to JSON array.\n"
            "Each item must include fields: title, company, location, source_url, notes, "
            "module, due_at, module_weight_percent, estimated_hours, match_score.\n"
            f"User query: {query}\n"
            f"Location: {location}\n"
            "module should usually be 'Career'.\n"
            "due_at must be ISO8601 UTC with Z suffix.\n"
            f"Results:\n{sources}"
        )
        try:
            raw = self._generate_text(prompt)
            parsed = self._extract_json(raw)
            if isinstance(parsed, dict):
                parsed = parsed.get("jobs", [])
            if not isinstance(parsed, list):
                return self._fallback_jobs(rows=rows, location=location)

            output: list[dict] = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                output.append(
                    {
                        "title": str(item.get("title") or "LinkedIn Job"),
                        "company": str(item.get("company") or "Unknown"),
                        "location": str(item.get("location") or location),
                        "source_url": str(item.get("source_url") or ""),
                        "notes": str(item.get("notes") or "Discovered via Gemini"),
                        "module": str(item.get("module") or "Career"),
                        "due_at": str(item.get("due_at") or ""),
                        "module_weight_percent": int(item.get("module_weight_percent") or 30),
                        "estimated_hours": int(item.get("estimated_hours") or 4),
                        "match_score": int(item.get("match_score") or 75),
                    }
                )
            return output if output else self._fallback_jobs(rows=rows, location=location)
        except Exception:
            return self._fallback_jobs(rows=rows, location=location)

    def _to_job(self, row: dict, position: int) -> Job:
        source_url = str(row.get("source_url") or "")
        title = str(row.get("title") or f"Job {position}")
        job_id = f"job-{sha256_text(source_url or title)[:16]}"

        due_at = str(row.get("due_at") or "").strip() or None
        discovered_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        return Job(
            id=job_id,
            title=title,
            module=str(row.get("module") or "Career"),
            due_at=due_at,
            module_weight_percent=max(0, min(100, int(row.get("module_weight_percent") or 30))),
            estimated_hours=max(1, min(20, int(row.get("estimated_hours") or 4))),
            notes=str(row.get("notes") or ""),
            company=str(row.get("company") or "Unknown"),
            location=str(row.get("location") or ""),
            source_url=source_url or None,
            match_score=max(0, min(100, int(row.get("match_score") or 75))),
            discovered_at=discovered_at,
        )

    def discover(self, query: str, location: str, limit: int) -> dict:
        serp_rows = self._search_serpapi(query=query, location=location, limit=limit)
        normalized = self._normalize_with_gemini(rows=serp_rows, query=query, location=location)

        existing_ids = {job.id for job in self.job_repo.list_jobs(limit=5000)}
        jobs = [self._to_job(item, index) for index, item in enumerate(normalized, start=1)]

        added = sum(1 for job in jobs if job.id not in existing_ids)
        updated = len(jobs) - added
        self.job_repo.upsert_jobs(jobs)

        self.last_refreshed_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        return {
            "query": query,
            "location": location,
            "jobs_added": added,
            "jobs_updated": updated,
            "sources": [row.get("source_url", "") for row in serp_rows if row.get("source_url")],
            "jobs": [self._job_to_schema(job) for job in self.job_repo.list_jobs(limit=max(limit, 50))[:limit]],
            "last_refreshed_at": self.last_refreshed_at,
        }

    def _job_to_schema(self, job: Job) -> dict:
        return {
            "job_id": job.id,
            "title": job.title,
            "module": job.module,
            "due_at": job.due_at,
            "module_weight_percent": int(job.module_weight_percent),
            "estimated_hours": int(job.estimated_hours),
            "notes": job.notes,
            "company": job.company,
            "location": job.location,
            "source_url": job.source_url,
            "match_score": job.match_score,
            "discovered_at": job.discovered_at,
        }

    def list_jobs(self, auto_refresh: bool = True) -> dict:
        now = datetime.now(UTC)
        should_refresh = False
        if auto_refresh:
            if self.last_refreshed_at is None:
                should_refresh = True
            else:
                try:
                    parsed = datetime.fromisoformat(self.last_refreshed_at.replace("Z", "+00:00"))
                    should_refresh = (now - parsed) >= timedelta(hours=24)
                except Exception:
                    should_refresh = True

        if should_refresh and self.serpapi_key:
            try:
                self.discover(
                    query="software engineer internship",
                    location="London",
                    limit=10,
                )
            except Exception:
                pass

        jobs = self.job_repo.list_jobs(limit=200)
        if self.last_refreshed_at is None:
            self.last_refreshed_at = now.isoformat().replace("+00:00", "Z")
        return {
            "count": len(jobs),
            "jobs": [self._job_to_schema(job) for job in jobs],
            "last_refreshed_at": self.last_refreshed_at,
        }
