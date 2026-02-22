from app.models.domain.job import Job
from app.models.persistence.db import MongoDB
from app.utils.time import utc_now_iso


class JobRepository:
    _INDEXES = [
        {"keys": [("job_id", 1)], "options": {"unique": True, "name": "uq_job_id"}},
        {
            "keys": [("source_url", 1)],
            "options": {"unique": True, "sparse": True, "name": "uq_source_url_sparse"},
        },
        {"keys": [("discovered_at", 1)], "options": {"name": "idx_discovered_at_asc"}},
        {"keys": [("created_at", 1)], "options": {"name": "idx_created_at_asc"}},
        {"keys": [("updated_at", 1)], "options": {"name": "idx_updated_at_asc"}},
    ]

    def __init__(
        self,
        mongo_uri: str,
        db_name: str,
        mongodb: MongoDB | None = None,
        collection_name: str = "jobs",
        collection=None,
    ) -> None:
        self.mongodb = mongodb or MongoDB(
            mongo_uri=mongo_uri,
            db_name=db_name,
            collection_name=collection_name,
        )
        if collection is None:
            self.mongodb.ensure_indexes(self._INDEXES)
            self.collection = self.mongodb.collection
        else:
            self.collection = collection

    def _to_doc(self, job: Job, now_iso: str) -> dict:
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
            "discovered_at": job.discovered_at or now_iso,
            "updated_at": now_iso,
        }

    def _to_job(self, row: dict) -> Job:
        return Job(
            id=row.get("job_id") or row.get("id", ""),
            title=row.get("title", ""),
            module=row.get("module", "General"),
            due_at=row.get("due_at"),
            module_weight_percent=int(row.get("module_weight_percent", 0)),
            estimated_hours=int(row.get("estimated_hours", 0)),
            notes=row.get("notes", ""),
            company=row.get("company"),
            location=row.get("location"),
            source_url=row.get("source_url"),
            match_score=row.get("match_score"),
            discovered_at=row.get("discovered_at"),
        )

    def list_jobs(self, limit: int = 200) -> list[Job]:
        cursor = (
            self.collection.find({}, {"_id": 0})
            .sort("created_at", -1)
            .limit(max(1, int(limit)))
        )
        return [self._to_job(row) for row in cursor]

    def upsert_jobs(self, jobs: list[Job]) -> int:
        if not jobs:
            return 0

        now_iso = utc_now_iso()
        for job in jobs:
            self.collection.update_one(
                {"job_id": job.id},
                {
                    "$set": self._to_doc(job, now_iso=now_iso),
                    "$setOnInsert": {"created_at": now_iso},
                },
                upsert=True,
            )
        return len(jobs)

    def replace_jobs(self, jobs: list[Job]) -> int:
        return self.upsert_jobs(jobs)
