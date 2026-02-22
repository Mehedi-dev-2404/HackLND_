# Beacon

An AI-powered student OS that combines Socratic tutoring, career preparation, and intelligent task management — helping students manage academic pressure and graduate scheme deadlines.

## Features

- **Socratic Mirror** — AI tutor that asks questions instead of giving answers, with academic integrity checking and voice synthesis
- **Career CRM** — Analyses job descriptions to extract skills and maps them against your profile
- **Assignment Pipeline** — Scrapes Moodle and ranks tasks by urgency, module weight, and effort

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python |
| Frontend | HTML, Tailwind CSS |
| AI / LLM | Google Gemini 1.5 Pro |
| Voice | ElevenLabs |
| Database | MongoDB Atlas |

## Running Locally

```bash
# Terminal 1 — FastAPI backend
cd myapp && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Open frontend
# Open Mohammed/code.html in your browser
```

Requires `myapp/.env` with `GEMINI_API_KEY`, `ELEVEN_LABS_API_KEY`, and `MONGO_URI`.

## Team

| Member | Role |
|---|---|
| Mehedi | AI intelligence, Socratic prompting |
| Rahul | Backend infrastructure, MongoDB |
| Tom | React frontend, data pipeline, web scraping |
| Mohammed | UI design |

Built at HackLondon.
