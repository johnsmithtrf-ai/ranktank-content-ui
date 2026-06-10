#!/usr/bin/env python3
"""Content Queue API — runs on Mac 2, talks directly to task_queue."""
import sys, os, json, sqlite3, time
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY = "content-queue-secret-2026"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

WORKSPACES = {
    "bot1": Path("/Users/mac_mini_pro/.openclaw-content/workspace"),
    "bot2": Path("/Users/mac_mini_pro/.openclaw-content2/workspace"),
}

USERS = {
    "admin":   {"password": "admin2026",  "role": "admin"},
    "sofia":   {"password": "sofia123",   "role": "user"},
    "romant4": {"password": "roman123",   "role": "user"},
    "unit":    {"password": "pass123",    "role": "user"},
    "vlad":    {"password": "vlad123",    "role": "user"},
    "aksana":  {"password": "Content - 2026", "role": "user"},
    "dima":    {"password": "dima2026",   "role": "admin"},
}
DB_PATH = Path("/Users/mac_mini_pro/.openclaw-content/workspace/state/web_tasks.db")

app = FastAPI(title="Content Queue API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()

# ── DB ───────────────────────────────────────────────────────────────────────
def get_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""CREATE TABLE IF NOT EXISTS web_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL DEFAULT 'auto',
        task_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        queue_pos INTEGER,
        result TEXT,
        batch_group_id TEXT,
        batch_index INTEGER DEFAULT 0
    )""")
    # Миграция: добавляем колонки если нет
    for col, coldef in [('batch_group_id', 'TEXT'), ('batch_index', 'INTEGER DEFAULT 0')]:
        try: conn.execute(f'ALTER TABLE web_tasks ADD COLUMN {col} {coldef}')
        except: pass
    conn.commit()
    return conn

# ── Auth ─────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

def create_token(username: str):
    exp = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username or username not in USERS:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": username, "role": USERS[username]["role"]}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/login")
async def login(req: LoginRequest):
    user = USERS.get(req.username)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_token(req.username), "token_type": "bearer",
            "username": req.username, "role": user["role"]}

# ── Queues ───────────────────────────────────────────────────────────────────
def read_queue(ws: Path):
    qf = ws / "state" / "queue.json"
    if not qf.exists(): return []
    return json.loads(qf.read_text())

@app.get("/queues")
async def get_queues(u=Depends(get_current_user)):
    result = {}
    for bot_id, ws in WORKSPACES.items():
        q = read_queue(ws)
        done = [t for t in q if t["status"] == "done"]
        result[bot_id] = {
            "running": [t for t in q if t["status"] == "running"],
            "queued":  [t for t in q if t["status"] == "queued"],
            "recently_done": done[-5:],  # последние 5 выполненных
            "done_count": len(done),
            "total": len(q),
        }
    return result

# ── Add task ─────────────────────────────────────────────────────────────────
class AddTaskRequest(BaseModel):
    bot_id: str = "auto"
    task: dict = None
    # Allow flat format too
    count: int = None
    article_type: str = None
    geo: str = None
    language: str = None
    generation_method: str = "v4"
    model: str = "anthropic/claude-opus-4-6"
    competitors: list = []
    keywords: list = []
    casinos: list = []
    dropbox_folder: str = "/test/"
    output_format: str = None
    word_count: int = None

    def get_task(self) -> dict:
        if self.task:
            return self.task
        # Build task from flat fields
        t = {
            "count": self.count or 1,
            "article_type": self.article_type or "text_review",
            "geo": self.geo or "US",
            "language": self.language or "EN",
            "generation_method": self.generation_method or "v4",
            "model": self.model or "anthropic/claude-opus-4-6",
            "competitors": self.competitors or [],
            "keywords": self.keywords or [],
            "casinos": self.casinos or [],
            "dropbox_folder": self.dropbox_folder or "/test/",
        }
        if self.output_format:
            t["output_format"] = self.output_format
        if self.word_count and self.word_count > 0:
            t["word_count"] = self.word_count
        return t

def add_to_queue(task: dict, bot_id: str, chat_id: str = "200063243") -> int:
    ws = WORKSPACES.get(bot_id, WORKSPACES["bot1"])
    # No os.chdir — not thread-safe in async server
    import importlib.util
    spec = importlib.util.spec_from_file_location("tq_" + bot_id, ws / "task_queue.py")
    tq = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tq)
    pos = tq.add_task(task, chat_id=chat_id)
    return pos

@app.post("/tasks/add")
async def add_task(req: AddTaskRequest, u=Depends(get_current_user)):
    bot_id = req.bot_id
    if bot_id == "auto":
        # Выбираем бота с меньшей очередью
        q1 = read_queue(WORKSPACES["bot1"])
        q2 = read_queue(WORKSPACES["bot2"])
        n1 = sum(1 for t in q1 if t["status"] in ("running","queued"))
        n2 = sum(1 for t in q2 if t["status"] in ("running","queued"))
        bot_id = "bot2" if n2 < n1 else "bot1"

    # Insert into web_tasks first to get the ID
    conn = get_db()
    conn.execute("INSERT INTO web_tasks (bot_id, task_json, created_by, created_at, status, queue_pos) VALUES (?,?,?,?,?,?)",
                 (bot_id, json.dumps(req.get_task()), u["username"], datetime.now(timezone.utc).isoformat(), "queued", 0))
    web_task_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit(); conn.close()

    # Pass web_task_id so queue can save result to a unique file
    task_with_id = req.get_task()
    task_with_id["_web_task_id"] = web_task_id
    pos = add_to_queue(task_with_id, bot_id, chat_id="200063243")
    
    return {"ok": True, "bot_id": bot_id, "queue_position": pos, "task_id": web_task_id}

# ── History ───────────────────────────────────────────────────────────────────
@app.get("/tasks/history")
async def get_history(u=Depends(get_current_user)):
    conn = get_db()
    tasks = conn.execute("SELECT * FROM web_tasks WHERE created_at >= datetime('now', '-5 days') ORDER BY created_at DESC LIMIT 500").fetchall()
    conn.close()
    return [dict(t) for t in tasks]

@app.get("/tasks/batch/{batch_group_id}/links")
async def get_batch_links(batch_group_id: str, batch_index: int = None, u=Depends(get_current_user)):
    """Get all links for a batch group, optionally filtered by batch_index (site)"""
    conn = get_db()
    if batch_index is not None:
        tasks = conn.execute(
            "SELECT id, result, batch_index FROM web_tasks WHERE batch_group_id=? AND batch_index=? AND status='done'",
            (batch_group_id, batch_index)
        ).fetchall()
    else:
        tasks = conn.execute(
            "SELECT id, result, batch_index FROM web_tasks WHERE batch_group_id=? AND status='done' ORDER BY batch_index, id",
            (batch_group_id,)
        ).fetchall()
    conn.close()
    all_links = []
    by_site: dict = {}
    for row in tasks:
        tidx = row[2] if row[2] is not None else 0
        try:
            links = json.loads(row[1] or '{}').get('links', []) if row[1] else []
        except:
            links = []
        real_links = [l for l in links if not l.startswith('local:')]
        all_links.extend(real_links)
        by_site.setdefault(tidx, []).extend(real_links)
    return {"batch_group_id": batch_group_id, "total": len(all_links), "links": all_links, "by_site": by_site}



class BulkTaskRequest(BaseModel):
    """Многостраничный режим — одно ТЗ, несколько страниц/keywords"""
    bot_id: str = "auto"
    geo: str = "US"
    language: str = "EN"
    generation_method: str = "v4"
    model: str = "anthropic/claude-opus-4-6"
    competitors: list = []
    casinos: list = []
    dropbox_folder: str = "/test/"
    article_type: str = "text_review"
    output_format: str = None
    word_count: int = None
    pages: list = []  # [{"keyword": "...", "article_type": "text_review", "count": 1}, ...]

@app.post("/tasks/bulk")
async def add_bulk_tasks(req: BulkTaskRequest, u=Depends(get_current_user)):
    if not req.pages:
        raise HTTPException(400, "pages list is empty")
    results = []
    for page in req.pages:
        if isinstance(page, str):
            keywords = [k.strip() for k in page.split("\n") if k.strip()]
            page_type = req.article_type
        else:
            # Поддерживаем и "keywords" (массив) и "keyword" (строка)
            raw = page.get("keywords", page.get("keyword", ""))
            if isinstance(raw, list):
                keywords = [k.strip() for k in raw if str(k).strip()]
            else:
                keywords = [k.strip() for k in str(raw).split("\n") if k.strip()]
            page_type = page.get("article_type", req.article_type)
        if not keywords:
            continue
        count = 1  # 1 страница = 1 текст, все ключи идут в одну задачу
        bot_id = req.bot_id
        if bot_id == "auto":
            # Пересчитываем очереди для каждой задачи — равномерное распределение
            q1 = read_queue(WORKSPACES["bot1"])
            q2 = read_queue(WORKSPACES["bot2"])
            n1 = sum(1 for t in q1 if t["status"] in ("running","queued"))
            n2 = sum(1 for t in q2 if t["status"] in ("running","queued"))
            # Учитываем уже распределённые в этом запросе
            n1 += sum(1 for r in results if r["bot_id"] == "bot1")
            n2 += sum(1 for r in results if r["bot_id"] == "bot2")
            bot_id = "bot2" if n2 < n1 else "bot1"
        task = {
            "count": count,
            "article_type": page_type,
            "geo": req.geo,
            "language": req.language,
            "generation_method": req.generation_method,
            "model": req.model,
            "competitors": req.competitors,
            "keywords": keywords,
            "casinos": req.casinos,
            "dropbox_folder": req.dropbox_folder,
            "_bulk": True,
        }
        if req.output_format:
            task["output_format"] = req.output_format
        if req.word_count and req.word_count > 0:
            task["word_count"] = req.word_count
        conn = get_db()
        conn.execute("INSERT INTO web_tasks (bot_id, task_json, created_by, created_at, status, queue_pos) VALUES (?,?,?,?,?,?)",
                     (bot_id, json.dumps(task), u["username"], datetime.now(timezone.utc).isoformat(), "queued", 0))
        web_task_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.commit(); conn.close()
        task["_web_task_id"] = web_task_id
        pos = add_to_queue(task, bot_id, chat_id="200063243")
        results.append({"task_id": web_task_id, "bot_id": bot_id, "keywords": keywords, "queue_position": pos})
    return {"ok": True, "created": len(results), "tasks": results}


class BatchTaskRequest(BaseModel):
    """N сайтов по одному (идентичному) ТЗ — последовательно"""
    sites_count: int = 1
    geo: str = "US"
    language: str = "EN"
    generation_method: str = "v4"
    model: str = "anthropic/claude-opus-4-6"
    competitors: list = []
    casinos: list = []
    dropbox_folder: str = "/test/"
    article_type: str = "text_review"
    output_format: str = None
    word_count: int = None
    pages: list = []

@app.post("/tasks/batch")
async def add_batch_tasks(req: BatchTaskRequest, u=Depends(get_current_user)):
    if not req.pages:
        raise HTTPException(400, "pages list is empty")
    if req.sites_count < 1 or req.sites_count > 50:
        raise HTTPException(400, "sites_count must be 1-50")
    import uuid
    batch_group_id = str(uuid.uuid4())[:8]
    all_results = []
    conn = get_db()
    for batch_idx in range(req.sites_count):
        is_first = (batch_idx == 0)
        local_counter = {"bot1": 0, "bot2": 0}
        batch_results = []
        for page in req.pages:
            raw = page.get("keywords", "")
            keywords = [k.strip() for k in (raw if isinstance(raw, list) else str(raw).split("\n")) if str(k).strip()]
            if not keywords:
                continue
            bot_id = "bot1" if local_counter["bot1"] <= local_counter["bot2"] else "bot2"
            local_counter[bot_id] += 1
            task = {
                "count": 1, "article_type": page.get("article_type", req.article_type),
                "geo": req.geo, "language": req.language, "generation_method": req.generation_method,
                "model": req.model, "competitors": req.competitors, "keywords": keywords,
                "casinos": req.casinos, "dropbox_folder": req.dropbox_folder,
                "_batch_group_id": batch_group_id, "_batch_index": batch_idx,
            }
            if req.output_format: task["output_format"] = req.output_format
            if req.word_count and req.word_count > 0: task["word_count"] = req.word_count
            status = "queued" if is_first else "batch_pending"
            conn.execute(
                "INSERT INTO web_tasks (bot_id, task_json, created_by, created_at, status, queue_pos, batch_group_id, batch_index) VALUES (?,?,?,?,?,?,?,?)",
                (bot_id, json.dumps(task), u["username"], datetime.now(timezone.utc).isoformat(), status, 0, batch_group_id, batch_idx)
            )
            web_task_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.commit()
            task["_web_task_id"] = web_task_id
            conn.execute("UPDATE web_tasks SET task_json=? WHERE id=?", (json.dumps(task), web_task_id))
            conn.commit()
            if is_first:
                try:
                    pos = add_to_queue(task, bot_id, chat_id="200063243")
                    conn.execute("UPDATE web_tasks SET queue_pos=? WHERE id=?", (pos, web_task_id))
                    conn.commit()
                except Exception as e:
                    print(f"[batch] Queue error: {e}")
            batch_results.append({"task_id": web_task_id, "bot_id": bot_id, "batch_index": batch_idx})
        all_results.append({"site": batch_idx + 1, "tasks": batch_results})
    conn.close()
    return {"ok": True, "batch_group_id": batch_group_id, "sites_count": req.sites_count,
            "total_tasks": sum(len(b["tasks"]) for b in all_results), "batches": all_results}

def _activate_next_batch(conn, batch_group_id: str, current_batch_index: int):
    """Activate next batch if all tasks in current batch are done."""
    if not batch_group_id:
        return
    # Проверяем что все задачи текущей пачки done
    remaining = conn.execute(
        "SELECT COUNT(*) FROM web_tasks WHERE batch_group_id=? AND batch_index=? AND status != 'done'",
        (batch_group_id, current_batch_index)
    ).fetchone()[0]
    if remaining > 0:
        return  # Ещё не все завершены в текущей пачке
    # Активируем задачи следующей пачки
    next_tasks = conn.execute(
        "SELECT id, bot_id, task_json FROM web_tasks WHERE batch_group_id=? AND batch_index=? AND status='batch_pending'",
        (batch_group_id, current_batch_index + 1)
    ).fetchall()
    if not next_tasks:
        return  # Больше пачек нет
    print(f"[batch] Activating batch {current_batch_index + 1} of group {batch_group_id}: {len(next_tasks)} tasks")
    for row in next_tasks:
        task_id, bot_id, task_json = row[0], row[1], json.loads(row[2])
        task_json["_web_task_id"] = task_id
        conn.execute("UPDATE web_tasks SET status='queued' WHERE id=?", (task_id,))
        try:
            pos = add_to_queue(task_json, bot_id, chat_id="200063243")
            conn.execute("UPDATE web_tasks SET queue_pos=? WHERE id=?", (pos, task_id))
        except Exception as e:
            print(f"[batch] Failed to queue task {task_id}: {e}")

@app.post("/tasks/{task_id}/result")
async def save_task_result(task_id: int, payload: dict):
    conn = get_db()
    # Получаем инфо о задаче до обновления
    row = conn.execute("SELECT batch_group_id, batch_index FROM web_tasks WHERE id=?", (task_id,)).fetchone()
    conn.execute(
        "UPDATE web_tasks SET status=?, result=? WHERE id=?",
        ("done", json.dumps(payload), task_id)
    )
    conn.commit()
    # Проверяем активацию следующей пачки
    if row and row[0]:
        _activate_next_batch(conn, row[0], row[1])
        conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/tasks/{task_id}")
async def get_task_detail(task_id: int, u=Depends(get_current_user)):
    conn = get_db()
    t = conn.execute("SELECT * FROM web_tasks WHERE id=?", (task_id,)).fetchone()
    conn.close()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    return dict(t)


@app.post("/tasks/{bot_id}/{task_id}/stop")
async def stop_task(bot_id: str, task_id: str, u=Depends(get_current_user)):
    """Stop a running task by resetting queue status and killing generate process."""
    import subprocess, signal
    ws = WORKSPACES.get(bot_id)
    if not ws:
        raise HTTPException(400, "Unknown bot_id")
    
    # Reset task status in queue.json
    qf = ws / "state" / "queue.json"
    if qf.exists():
        q = json.loads(qf.read_text())
        for t in q:
            if t["id"] == task_id and t["status"] == "running":
                t["status"] = "failed"
                t["error"] = "Stopped by user"
                t["step_label"] = "⛔ Остановлено"
                import os
                tmp = str(qf) + ".tmp"
                with open(tmp, "w") as f:
                    json.dump(q, f, indent=2, ensure_ascii=False)
                os.replace(tmp, str(qf))
                break
    
    # Remove lock file
    lock = ws / "state" / "queue.lock"
    if lock.exists():
        lock.unlink()
    
    # Kill generate_parallel processes
    try:
        result = subprocess.run(
            ["pkill", "-f", f"generate_parallel"],
            capture_output=True, timeout=5
        )
    except Exception:
        pass
    
    # Update web_tasks if exists
    try:
        conn = get_db()
        conn.execute(
            "UPDATE web_tasks SET status=? WHERE bot_id=? AND status IN (?,?)",
            ("stopped", bot_id, "queued", "processing")
        )
        conn.commit(); conn.close()
    except Exception:
        pass
    
    return {"ok": True, "message": f"Task {task_id} stopped"}


@app.delete("/tasks/{task_id}")
async def delete_task(task_id: int, u=Depends(get_current_user)):
    """Delete task from history."""
    conn = get_db()
    conn.execute("DELETE FROM web_tasks WHERE id=?", (task_id,))
    conn.commit(); conn.close()
    return {"ok": True, "deleted": task_id}

@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

# ── SPA Static Serving (MUST be before __main__ block) ────────
import os as _os
from fastapi.responses import FileResponse as _FileResponse

_DIST_DIR = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'dist')

def _serve_index():
    return _FileResponse(_os.path.join(_DIST_DIR, 'index.html'))

@app.get('/', include_in_schema=False)
async def spa_root():
    return _serve_index()

@app.get('/assets/{file_path:path}', include_in_schema=False)
async def serve_assets(file_path: str):
    fp = _os.path.join(_DIST_DIR, 'assets', file_path)
    if _os.path.isfile(fp):
        return _FileResponse(fp)
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=404, content={"detail": "Not found"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8091, log_level="info")


