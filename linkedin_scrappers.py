#!/usr/bin/env python3
"""LinkedIn job finder utility with optional session bootstrap."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from create_sessions import create_session_file


def _job_to_dict(job: Any, index: int, url: str) -> dict:
    return {
        "id": f"linkedin-{index}",
        "title": getattr(job, "job_title", None) or "Unknown Title",
        "company": getattr(job, "company", None) or "Unknown Company",
        "location": getattr(job, "location", None) or "",
        "postedDate": getattr(job, "posted_date", None) or "",
        "applicantCount": getattr(job, "applicant_count", None) or "",
        "url": url,
        "description": getattr(job, "job_description", None) or "",
    }


async def find_jobs(
    keywords: str,
    location: str,
    limit: int = 5,
    session_path: str = "linkedin_session.json",
    headless: bool = True,
    auto_create_session: bool = False,
) -> dict:
    try:
        from linkedin_scraper.core.browser import BrowserManager
        from linkedin_scraper.scrapers.job import JobScraper
        from linkedin_scraper.scrapers.job_search import JobSearchScraper
    except Exception as exc:
        raise RuntimeError(
            "Missing LinkedIn scraper dependencies. Install with: "
            "pip install linkedin-jobs-scraper playwright && playwright install chromium"
        ) from exc

    normalized_limit = max(1, int(limit))
    session_file = Path(session_path)

    if not session_file.exists():
        if not auto_create_session:
            raise FileNotFoundError(
                f"LinkedIn session file not found: {session_path}. "
                "Run create_sessions.py first."
            )
        await create_session_file(session_path=session_path)

    jobs: list[dict] = []
    last_error: Exception | None = None
    for current_headless in ([headless, False] if headless else [headless]):
        try:
            async with BrowserManager(headless=current_headless) as browser:
                await browser.load_session(session_path)
                search_scraper = JobSearchScraper(browser.page)
                job_urls = await search_scraper.search(
                    keywords=keywords,
                    location=location,
                    limit=normalized_limit,
                )

                job_scraper = JobScraper(browser.page)
                for index, job_url in enumerate(job_urls[:normalized_limit], start=1):
                    job = await job_scraper.scrape(job_url)
                    jobs.append(_job_to_dict(job=job, index=index, url=job_url))
            break
        except Exception as exc:
            last_error = exc
            jobs = []
            if not current_headless:
                break

    if last_error is not None and not jobs:
        raise RuntimeError(str(last_error))

    return {
        "source": "linkedin",
        "keywords": keywords,
        "location": location,
        "jobCount": len(jobs),
        "jobs": jobs,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LinkedIn job finder")
    parser.add_argument("--keywords", default="software engineer")
    parser.add_argument("--location", default="Toronto")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--session-path", default="linkedin_session.json")
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--auto-create-session", action="store_true")
    parser.add_argument("--json", action="store_true", help="print JSON only")
    return parser.parse_args()


async def _main_async(args: argparse.Namespace) -> int:
    payload = await find_jobs(
        keywords=args.keywords,
        location=args.location,
        limit=args.limit,
        session_path=args.session_path,
        headless=not args.headed,
        auto_create_session=args.auto_create_session,
    )

    if args.json:
        print(json.dumps(payload))
    else:
        print(json.dumps(payload, indent=2))
    return 0


def main() -> int:
    args = parse_args()
    try:
        return asyncio.run(_main_async(args))
    except Exception as exc:
        if args.json:
            print(
                json.dumps(
                    {
                        "source": "linkedin",
                        "error": str(exc),
                        "jobCount": 0,
                        "jobs": [],
                    }
                )
            )
            return 1
        raise


if __name__ == "__main__":
    raise SystemExit(main())
