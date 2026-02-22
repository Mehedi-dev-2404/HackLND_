from dataclasses import dataclass


@dataclass
class Job:
    id: str
    title: str
    module: str
    due_at: str | None
    module_weight_percent: int
    estimated_hours: int
    notes: str = ""
    company: str | None = None
    location: str | None = None
    source_url: str | None = None
    match_score: int | None = None
    discovered_at: str | None = None
