# Beacon

**Beacon** is an AI-powered student operating system built for UK university students. It combines Socratic tutoring, career preparation, and intelligent task management into a single platform — helping students navigate academic pressure and graduate scheme deadlines without burning out.

---

## What It Does

### Socratic Mirror
An AI tutor that asks questions instead of giving answers. Built on the Feynman technique and Socratic method, it generates targeted questions to deepen understanding, checks for academic integrity violations, and simulates mock Viva Voce exams with voice synthesis.

### Career CRM
Analyses job descriptions to extract required technical skills, tools, cognitive abilities, and experience levels. Scrapes LinkedIn and graduate job boards to surface relevant opportunities and map them against a student's current skill profile.

### Assignment Pipeline
Scrapes Moodle and other university portals to extract assignment metadata (title, due date, module weight), then uses an LLM to rank tasks by urgency, importance, and estimated effort — producing a living, prioritised task list.

### Voice Synthesis
Converts AI tutor responses to speech using ElevenLabs, with British professional voices for a localised experience.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python), Uvicorn |
| Frontend | React 18, Vite |
| Bridge | Node.js proxy server |
| AI / LLM | Google Gemini 1.5 Pro |
| Voice | ElevenLabs |
| Database | MongoDB Atlas |
| Scraping | Custom HTTP + browser scrapers |
| Validation | Pydantic |

---

## Project Structure

```
beacon/
├── myapp/                  # Main FastAPI backend (production)
│   └── app/
│       ├── core/           # Config, logging, dependency injection
│       ├── models/         # Domain models and MongoDB repositories
│       ├── services/       # LLM, scraping, Socratic, workflow logic
│       └── view/v1/        # API routes
├── Tom/                    # React frontend + Node bridge server
│   ├── src/                # React application
│   └── backend/            # Node.js proxy (server.mjs)
├── Mehedi/                 # AI intelligence and voice modules
│   ├── intelligence/       # Gemini-powered tutoring and career analysis
│   └── voice/              # ElevenLabs integration
├── Rahul/                  # Simplified FastAPI + MongoDB backend
└── Mohammed/               # Static HTML UI shell
```

---

## API Endpoints

### Health
```
GET  /api/v1/health                     Health check with dependency status
GET  /api/v1/health/ui                  HTML shell
```

### Socratic Engine
```
POST /api/v1/socratic/question          Generate a Socratic question
POST /api/v1/socratic/integrity-check   Detect academic integrity violations
POST /api/v1/socratic/career-analysis   Extract skills from a job description
POST /api/v1/socratic/voice             Text-to-speech synthesis
POST /api/v1/socratic/chunk             Split text into chunks
```

### Scraping & Workflow
```
POST /api/v1/scrape                     Scrape a URL or HTML for assignments
POST /api/v1/llm/rate-tasks             LLM-based task prioritisation
POST /api/v1/workflow/run               Full pipeline: scrape → rank → persist
```

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB Atlas account
- Google AI Studio API key (Gemini)
- ElevenLabs API key

### Environment Variables

Create `myapp/.env`:

```env
APP_NAME=Beacon API
APP_VERSION=0.1.0
APP_ENV=development

GEMINI_API_KEY=<your Gemini API key>
ELEVEN_LABS_API_KEY=<your ElevenLabs API key>

MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
DB_NAME=aura_jobs
TASKS_DB_NAME=aura_tasks

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
UI_HTML_PATH=../Mohammed/code.html
ENABLE_LIVE_LLM=true
```

### Running Locally

```bash
# Terminal 1 — FastAPI backend
cd myapp
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Node bridge (optional, for frontend proxying)
cd Tom
node backend/server.mjs

# Terminal 3 — React frontend
cd Tom
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` and the API at `http://localhost:8000`.

---

## Team

| Member | Role |
|---|---|
| Mehedi | AI intelligence, voice synthesis, Socratic prompting |
| Rahul | Backend infrastructure, MongoDB integration |
| Tom | React frontend, data pipeline, web scraping |
| Mohammed | UI design, static HTML shell |

---

Built at HackLondon.
