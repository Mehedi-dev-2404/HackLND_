from pydantic import BaseModel, Field


class JobDiscoveryRequest(BaseModel):
    query: str = Field(default="software engineer internship")
    location: str = Field(default="London")
    limit: int = Field(default=10, ge=1, le=30)


class JobSchema(BaseModel):
    job_id: str
    title: str
    module: str
    due_at: str | None = None
    module_weight_percent: int
    estimated_hours: int
    notes: str = ""
    company: str | None = None
    location: str | None = None
    source_url: str | None = None
    match_score: int | None = None
    discovered_at: str | None = None


class JobsListResponse(BaseModel):
    count: int
    jobs: list[JobSchema]
    last_refreshed_at: str | None = None


class JobDiscoveryResponse(BaseModel):
    query: str
    location: str
    jobs_added: int
    jobs_updated: int
    sources: list[str]
    jobs: list[JobSchema]
    last_refreshed_at: str
