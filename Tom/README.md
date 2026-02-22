# Tom - Member 4 Task Runner (React)

Basic React UI to run Member 4 hackathon tasks from `idea.pdf`:
- Moodle sync
- Career sync / JSON inject
- Data cleaning + schema mapping
- LLM priority scoring (due date + module weighting)
- Golden-path demo seed

## Quick Start

```bash
cd Tom
npm install
npm run dev
```

## Node Integration Bridge (Recommended)

This project now uses a Node bridge that keeps the existing `/member4/*` routes for the React app and forwards to the FastAPI backend in `../myapp`.

1. Create env file:

```bash
cd Tom
cp .env.example .env
```

2. Configure `.env`:
- `PORT=8010`
- `FASTAPI_BASE_URL=http://127.0.0.1:8000`
- `GEMINI_API_KEY=...`

3. Run FastAPI backend (terminal 1):

```bash
cd Tom
npm run dev:myapp
```

4. Run Node bridge (terminal 2):

```bash
cd Tom
npm run dev:backend
```

5. Run frontend in another terminal:

```bash
cd Tom
npm run dev
```

6. In UI, set `Backend API Base URL` to:
- `http://127.0.0.1:8010`

Health check:

```bash
curl http://127.0.0.1:8010/health
```

## LinkedIn Jobs via Gemini (`Load Jobs`)

`Load Jobs` now uses Gemini directly to return LinkedIn-style job results in structured JSON.

1. Set `GEMINI_API_KEY` in `Tom/.env` (or `myapp/.env`).
2. Optionally set `GEMINI_JOB_SEARCH_MODEL` in `Tom/.env`.
3. Restart `npm run dev:backend`.
4. Click `Load Jobs`.

## Hackathon Structure Choice

This project uses **MVVM (feature-first)** because it keeps UI speed high while staying organized:

- `views/` for screen components
- `viewmodels/` for state + action logic
- `services/` for API calls + mock fallback
- `models/` for task metadata and shared shapes

This is practical in a hackathon because:
- UI can ship fast with mock data first
- backend can plug in later by replacing service endpoints
- team members can work in parallel without stepping on each other

## Folder Layout

```txt
Tom/
  backend/
    server.mjs
  src/
    features/
      member4/
        models/
          member4Tasks.js
        services/
          member4Service.js
        viewmodels/
          useMember4ViewModel.js
        views/
          Member4Dashboard.jsx
    shared/
      components/
        TaskCard.jsx
    App.jsx
    main.jsx
    styles.css
```

## API Endpoints Expected (optional)

If you provide a backend base URL, these POST routes are used:
- `/member4/moodle-sync`
- `/member4/career-sync`
- `/member4/clean-map`
- `/member4/llm-priority`
- `/member4/demo-seed`

Node bridge in `backend/server.mjs` currently implements:
- `GET /health`
- `GET /member4/llm-priority/file`
- `POST /member4/load-data`
- `POST /member4/load-jobs`
- `POST /member4/llm-priority`
- `POST /member4/moodle-sync`
- `POST /member4/career-sync`
- `POST /member4/clean-map`
- `POST /member4/demo-seed`

These routes normalize payloads and forward to FastAPI endpoints under `/api/v1/*`.

If any call fails, the UI automatically switches to mock mode so demo flow still works.

## New One-Click Actions

- `Load Data`: loads `backend/pipeline_mock_data.json` and runs FastAPI `/api/v1/workflow/run`.
- `Load Jobs`: uses Gemini API to return LinkedIn job data from query fields (keywords, location, limit).
- If Gemini fails (for example missing API key), the backend returns an error with setup hints.

## LLM Priority Tuning

The dashboard includes controls for:
- Model name
- Temperature
- Custom prompt
- Rubric weights (`deadlineWeight`, `moduleWeight`, `effortWeight`)

You can run through:
- Backend proxy (`/member4/llm-priority`) - recommended
- Direct browser Gemini API call with your own key - useful for rapid hackathon experiments

## Why This Backend Route

- Keeps frontend contract stable (`/member4/*`) while backend evolves in FastAPI.
- Allows Node/React team to move independently from Python service internals.
- Persists latest output to `backend/data/llm_priority_latest.json` for easy frontend extraction.
