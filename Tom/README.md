# Tom - Member 4 Task Runner (React)

Basic React UI to run Member 4 hackathon tasks from `idea.pdf`:
- Moodle sync
- Career sync / JSON inject
- Data cleaning + schema mapping
- Golden-path demo seed

## Quick Start

```bash
cd Tom
npm install
npm run dev
```

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
- `/member4/demo-seed`

If any call fails, the UI automatically switches to mock mode so demo flow still works.
