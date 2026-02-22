#!/usr/bin/env python3
"""Create LinkedIn session cookies file via manual login."""

import asyncio


async def create_session_file(
    session_path: str = "linkedin_session.json",
    timeout_ms: int = 300_000,
) -> str:
    """Open LinkedIn login and persist a session file after manual auth."""
    print("=" * 60)
    print("LinkedIn Session Creator")
    print("=" * 60)
    print("A browser window will open. Log in manually to save a reusable session.")
    print(f"Target output: {session_path}")
    print(f"Timeout: {timeout_ms} ms")

    try:
        from linkedin_scraper.core.browser import BrowserManager
        try:
            from linkedin_scraper import wait_for_manual_login
        except Exception:
            from linkedin_scraper.utils import wait_for_manual_login
    except Exception as exc:
        raise RuntimeError(
            "Missing LinkedIn session dependencies. Install with: "
            "pip install linkedin-jobs-scraper playwright && playwright install chromium"
        ) from exc

    async with BrowserManager(headless=False) as browser:
        print("Opening LinkedIn login page...")
        await browser.page.goto("https://www.linkedin.com/login")
        print("Waiting for manual login completion...")
        await wait_for_manual_login(browser.page, timeout=timeout_ms)
        print(f"Saving session to {session_path}...")
        await browser.save_session(session_path)

    print("Session created successfully.")
    return session_path


async def create_session() -> None:
    """Backward-compatible wrapper."""
    try:
        await create_session_file()
    except Exception as exc:
        print(f"Session creation failed: {exc}")


if __name__ == "__main__":
    asyncio.run(create_session())
