# RankTank — ContentQueue

Content generation dashboard for managing AI text generation bots.

## Architecture

```
content.startmyonlinecourses.com  →  CF Pages (dist/)
content-api.startmyonlinecourses.com  →  CF Tunnel → localhost:8091 → content_api.py
```

## Frontend (`src/`)

React + TypeScript + Vite

### Components
- **App.tsx** — main layout, login, routing
- **BotCard.tsx** — bot status card (running/queued tasks)
- **SingleTaskForm.tsx** — single task form (count, method V1-V5, model, geo, lang, keywords, casinos, competitors, word_count, html format)
- **MultiTaskForm.tsx** — multi-page / batch mode (N pages × M sites, sequential batches)
- **History.tsx** — task history with batch grouping, copy links, repeat

### Build & Deploy
```bash
cd src/../  # frontend dir
npm run build        # builds to ../dist/
# Deploy to CF Pages via wrangler
```

## Backend (`backend/`)

### `content_api.py`
FastAPI server on `localhost:8091`

Key endpoints:
- `POST /login` — JWT auth
- `GET /queues` — bot queue status
- `POST /tasks/add` — single task
- `POST /tasks/bulk` — multi-page (1 site)
- `POST /tasks/batch` — multi-page × N sites (sequential batches)
- `GET /tasks/batch/{id}/links` — all links for a batch group
- `POST /tasks/{id}/result` — called by task_queue when done
- `GET /tasks/history` — last 5 days

Users: admin, sofia, romant4, unit, vlad, aksana, dima

### `task_queue_bot1.py` / `task_queue_bot2.py`
Queue daemon — runs generate_parallel scripts.

**MAX_PARALLEL=3** — up to 3 concurrent tasks per bot via threading.
Each worker gets isolated `TASK_FILE_OVERRIDE` / `RESULT_FILE_OVERRIDE` env vars.

LaunchAgents:
- `ai.openclaw.content.taskqueue` → bot1
- `ai.openclaw.content2.taskqueue` → bot2

### `generate_parallel_v{1-5}_bot{1,2}.py`
Generation scripts. Method selection:
- V1 — basic
- V2 — enhanced H2/H3
- V3 — SERP analysis + uniquification
- V4 — V3 + Originality.ai check (auto-regen if <80%)
- V5 — V4 + real PAA questions + E-E-A-T

Reads task from `TASK_FILE_OVERRIDE` env var (or `task.json` fallback).
Writes result to `RESULT_FILE_OVERRIDE` env var (or `result.txt` fallback).

### Batch sequential logic
1. `POST /tasks/batch` creates N×M tasks: site 0 → `queued`, sites 1..N-1 → `batch_pending`
2. When task completes → `POST /tasks/{id}/result` → `_activate_next_batch()`
3. If all tasks in batch_index=K are done → tasks with batch_index=K+1 get queued

## Restore

1. Restore `content_api.py` → `~/.openclaw-content/workspace/`
2. Restore `task_queue_bot1.py` → `~/.openclaw-content/workspace/task_queue.py`
3. Restore `task_queue_bot2.py` → `~/.openclaw-content2/workspace/task_queue.py`
4. Restore `generate_parallel*_bot1.py` → `~/.openclaw-content/workspace/`
5. Restore `generate_parallel*_bot2.py` → `~/.openclaw-content2/workspace/`
6. Rebuild frontend: `cd frontend && npm install && npm run build`
7. Deploy dist to CF Pages project `content-ui`

## Key paths
- Bot1 workspace: `~/.openclaw-content/workspace/`
- Bot2 workspace: `~/.openclaw-content2/workspace/`
- DB: `~/.openclaw-content/workspace/state/web_tasks.db`
- CF Pages project: `content-ui` (account: startmyonlinecourses.com)
- API tunnel: `ai.openclaw.content.cf-tunnel` → localhost:8091
