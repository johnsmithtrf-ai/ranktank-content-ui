#!/usr/bin/env python3
"""
Task Queue для generate_parallel.py
- Зберігає ТЗ в queue.json
- Обробляє паралельно (MAX_PARALLEL потоков)
- Надсилає результат в потрібний Telegram чат
"""
import json, os, time, subprocess, sys, threading
from pathlib import Path
from datetime import datetime

WORKSPACE = Path(__file__).parent
QUEUE_FILE = WORKSPACE / "state" / "queue.json"
LOCK_FILE = WORKSPACE / "state" / "queue.lock"
TASK_FILE = WORKSPACE / "task.json"
RESULT_FILE = WORKSPACE / "result.txt"
MAX_PARALLEL = 3  # Максимальное количество параллельных задач
BOT_TOKEN = ""  # Disabled — use web UI only
GROUP_CHAT_ID = "-5225581427"  # Группа Контент_Pro

QUEUE_FILE.parent.mkdir(exist_ok=True)


def load_queue():
    if QUEUE_FILE.exists():
        return json.loads(QUEUE_FILE.read_text())
    return []


def save_queue(q):
    QUEUE_FILE.write_text(json.dumps(q, indent=2, ensure_ascii=False))


def is_locked():
    if not LOCK_FILE.exists():
        return False
    # Lock older than 2 hours = stale
    age = time.time() - LOCK_FILE.stat().st_mtime
    if age > 7200:
        LOCK_FILE.unlink()
        return False
    return True


def lock():
    LOCK_FILE.write_text(str(os.getpid()))


def unlock():
    LOCK_FILE.unlink(missing_ok=True)


def tg_send(*args, **kwargs):  # TG disabled
    pass  # Disabled — use web UI at content.startmyonlinecourses.com


def _is_duplicate(task: dict, q: list, minutes: int = 10) -> bool:
    """Check if same task was added in last N minutes."""
    import time as _t
    cutoff = _t.time() - minutes * 60
    geo = task.get("geo", "")
    count = task.get("count", 0)
    kw = tuple(sorted(task.get("keywords", [])[:3]))
    for t in q:
        if t.get("status") in ("queued", "running"):  # Only block if already in queue
            try:
                added = __import__("datetime").datetime.fromisoformat(t.get("added_at","")).timestamp()
                if added < cutoff:
                    continue
            except:
                continue
            tt = t.get("task", {})
            if (tt.get("geo","") == geo and
                tt.get("count",0) == count and
                tuple(sorted(tt.get("keywords",[])[:3])) == kw):
                return True
    return False

def add_task(task: dict, chat_id: str, format_html: bool = False):
    """Add task to queue via inbox folder — race-condition free."""
    import time as _t
    # Dedup check
    _q = load_queue()
    if _is_duplicate(task, _q, minutes=15):
        print(f"DEDUP: skipping duplicate task {task.get('geo')} x{task.get('count')}")
        return len(_q)
    inbox_dir = QUEUE_FILE.parent / "inbox"
    inbox_dir.mkdir(exist_ok=True)
    entry = {
        "task": task,
        "chat_id": str(chat_id),
        "format_html": format_html,
        "added_at": datetime.now().isoformat(),
    }
    fname = f"task_{int(_t.time()*1000)}_{os.getpid()}.json"
    tmp = inbox_dir / (fname + ".tmp")
    tmp.write_text(json.dumps(entry, ensure_ascii=False))
    os.replace(tmp, inbox_dir / fname)

    # Estimate position
    pending = len(list(inbox_dir.glob("task_*.json")))
    running = [t for t in load_queue() if t["status"] in ("running", "queued")]
    pos = len(running) + pending

    geo = task.get("geo", "?")
    count = task.get("count", "?")
    q_after = load_queue()
    queued_n = sum(1 for t in q_after if t["status"] == "queued")
    running_n = sum(1 for t in q_after if t["status"] == "running")
    msg = f"\U0001f4e5 Задача #{pos}: {geo} x{count}"
    if running_n:
        msg += f"\n\U0001f504 Выполняется: {running_n}"
    if queued_n > 1:
        msg += f"\n\u23f3 В очереди ещё: {queued_n - 1}"
    try:
        print("[TG disabled]")
    except Exception:
        pass
    return pos


def _flush_inbox():
    """Move inbox files into queue.json one by one (atomic, no race condition)."""
    inbox_dir = QUEUE_FILE.parent / "inbox"
    if not inbox_dir.exists():
        return
    for inbox_file in sorted(inbox_dir.glob("task_*.json")):
        try:
            entry_data = json.loads(inbox_file.read_text())
            q = load_queue()
            entry = {
                "id": f"task_{int(time.time())}_{len(q)}",
                "task": entry_data["task"],
                "chat_id": entry_data.get("chat_id", ""),
                "format_html": entry_data.get("format_html", False),
                "added_at": entry_data.get("added_at", datetime.now().isoformat()),
                "status": "queued",
            }
            q.append(entry)
            save_queue(q)
            inbox_file.unlink()
        except Exception as e:
            print(f"inbox flush error {inbox_file}: {e}")

_queue_lock = threading.Lock()

def _run_task_worker(entry_id: str):
    """Run one task in a worker thread. Each worker gets its own task/result files."""
    with _queue_lock:
        q = load_queue()
        entry = next((t for t in q if t["id"] == entry_id), None)
        if not entry or entry["status"] != "queued":
            return
        entry["status"] = "running"
        entry["started_at"] = datetime.now().isoformat()
        save_queue(q)

    task = entry.get("task", entry)
    count = task.get("count", 1)
    web_task_id = task.get("_web_task_id")

    # Уникальные файлы для этого воркера
    slot = entry_id.replace("task_", "")
    task_file = WORKSPACE / f"state/task_{slot}.json"
    result_file = WORKSPACE / f"state/result_tmp_{slot}.txt"

    print(f"[{entry_id}] Starting: {count} texts")
    try:
        task_with_status = dict(task)
        task_with_status["status"] = "running"
        if not task_with_status.get("model"):
            task_with_status["model"] = "anthropic/claude-opus-4-6"
        task_file.write_text(json.dumps(task_with_status, indent=2, ensure_ascii=False))

        gen_method = task.get("generation_method", "v1").lower()
        if gen_method == "v5":   gen_script = "generate_parallel_v5.py"
        elif gen_method == "v4": gen_script = "generate_parallel_v4.py"
        elif gen_method == "v3": gen_script = "generate_parallel_v3.py"
        elif gen_method == "v2": gen_script = "generate_parallel_v2.py"
        else:                    gen_script = "generate_parallel.py"

        print(f"[{entry_id}] Method: {gen_method} → {gen_script}")
        env = os.environ.copy()
        env["TASK_FILE_OVERRIDE"] = str(task_file)
        env["RESULT_FILE_OVERRIDE"] = str(result_file)

        result = subprocess.run(
            [sys.executable, str(WORKSPACE / gen_script)],
            capture_output=True, text=True, timeout=3600, cwd=str(WORKSPACE), env=env
        )

        # Сохраняем result
        if result_file.exists() and web_task_id:
            unique_result = WORKSPACE / "state" / f"result_{web_task_id}.txt"
            unique_result.write_text(result_file.read_text(encoding="utf-8"), encoding="utf-8")
            print(f"  [{entry_id}] Result saved: result_{web_task_id}.txt")

        # Обновляем БД
        if web_task_id:
            try:
                import urllib.request
                task_data = json.loads(task_file.read_text()) if task_file.exists() else {}
                links = task_data.get("links", [])
                payload = json.dumps({"links": links}).encode()
                req = urllib.request.Request(
                    f"http://127.0.0.1:8091/tasks/{web_task_id}/result",
                    data=payload, headers={"Content-Type": "application/json"}, method="POST"
                )
                with urllib.request.urlopen(req, timeout=5):
                    print(f"  [{entry_id}] DB updated, links: {len(links)}")
            except Exception as _e:
                print(f"  [{entry_id}] DB update failed: {_e}")

        with _queue_lock:
            q = load_queue()
            e = next((t for t in q if t["id"] == entry_id), None)
            if e:
                e["status"] = "done"
                e["finished_at"] = datetime.now().isoformat()
                save_queue(q)

    except subprocess.TimeoutExpired:
        with _queue_lock:
            q = load_queue()
            e = next((t for t in q if t["id"] == entry_id), None)
            if e: e["status"] = "timeout"; e["finished_at"] = datetime.now().isoformat(); save_queue(q)
    except Exception as ex:
        with _queue_lock:
            q = load_queue()
            e = next((t for t in q if t["id"] == entry_id), None)
            if e: e["status"] = "error"; e["error"] = str(ex); e["finished_at"] = datetime.now().isoformat(); save_queue(q)
        print(f"  [{entry_id}] Error: {ex}")
    finally:
        # Чистим временные файлы
        for f in [task_file, result_file]:
            try: f.unlink(missing_ok=True)
            except: pass

def process_next():
    """Start next queued task if slots available. Returns True if started something."""
    _flush_inbox()

    with _queue_lock:
        q = load_queue()
        running_count = sum(1 for t in q if t["status"] == "running")
        if running_count >= MAX_PARALLEL:
            return False
        pending = [t for t in q if t["status"] == "queued"]
        if not pending:
            return False
        entry = pending[0]
        entry_id = entry["id"]

    # Запускаем в отдельном потоке
    t = threading.Thread(target=_run_task_worker, args=(entry_id,), daemon=True)
    t.start()
    return True

def _LEGACY_process_next():
    """Legacy single-task runner — kept for reference."""
    _flush_inbox()
    if is_locked():
        print("Queue is locked (another task running)")
        return False

    q = load_queue()
    pending = [t for t in q if t["status"] == "queued"]
    if not pending:
        return False

    entry = pending[0]
    entry["status"] = "running"
    entry["started_at"] = datetime.now().isoformat()
    save_queue(q)
    lock()

    chat_id = entry["chat_id"]
    task = entry["task"]
    count = task.get("count", 1)

    print(f"Starting generation: {count} texts")

    try:
        # Write task.json with status=running (prevents watchdog from interfering)
        task["status"] = None
        task_with_status = dict(task); task_with_status["status"] = "running"
        # Inject default model if not specified in task
        if not task_with_status.get("model"):
            task_with_status["model"] = "anthropic/claude-opus-4-6"
        TASK_FILE.write_text(json.dumps(task_with_status, indent=2, ensure_ascii=False))

        # Write format.txt if needed
        fmt_file = WORKSPACE / "format.txt"
        if entry.get("format_html") or task.get("output_format") == "html_txt":
            fmt_file.write_text("html_txt")
        elif fmt_file.exists():
            fmt_file.unlink()

        # Run generator — choose v1 or v2 based on generation_method
        gen_method = task.get("generation_method", "v1").lower()
        if gen_method == "v5":
            gen_script = "generate_parallel_v5.py"
        elif gen_method == "v4":
            gen_script = "generate_parallel_v4.py"
        elif gen_method == "v3":
            gen_script = "generate_parallel_v3.py"
        elif gen_method == "v2":
            gen_script = "generate_parallel_v2.py"
        else:
            gen_script = "generate_parallel.py"
        print(f"Generation method: {gen_method} → {gen_script}")
        result = subprocess.run(
            [sys.executable, str(WORKSPACE / gen_script)],
            capture_output=True, text=True, timeout=3600, cwd=str(WORKSPACE)
        )

        # Сохраняем result.txt под уникальным именем по web_task_id
        web_task_id = task.get("_web_task_id")
        if RESULT_FILE.exists() and web_task_id:
            unique_result = WORKSPACE / "state" / f"result_{web_task_id}.txt"
            unique_result.write_text(RESULT_FILE.read_text(encoding="utf-8"), encoding="utf-8")
            print(f"  ✅ Result saved: {unique_result.name}")

        # Обновляем web_tasks БД через content_api
        if web_task_id:
            try:
                import urllib.request
                task_data = json.loads(TASK_FILE.read_text()) if TASK_FILE.exists() else {}
                links = task_data.get("links", [])
                payload = json.dumps({"links": links}).encode()
                req = urllib.request.Request(
                    f"http://127.0.0.1:8091/tasks/{web_task_id}/result",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    print(f"  ✅ DB result updated for task #{web_task_id}, links: {len(links)}")
            except Exception as _e:
                print(f"  ⚠️ DB result update failed: {_e}")

        entry["status"] = "done"
        # Mark task.json as done so watchdog does not restart
        try:
            t = json.loads(TASK_FILE.read_text())
            t["status"] = "done"
            TASK_FILE.write_text(json.dumps(t, indent=2, ensure_ascii=False))
        except:
            pass

    except subprocess.TimeoutExpired:
        entry["status"] = "timeout"
        print("[TG disabled]")
    except Exception as e:
        entry["status"] = "error"
        entry["error"] = str(e)
        print("[TG disabled]")
    finally:
        entry["finished_at"] = datetime.now().isoformat()
        save_queue(q)
        unlock()

    return True


def queue_status():
    q = load_queue()
    running = [t for t in q if t["status"] == "running"]
    pending = [t for t in q if t["status"] == "queued"]
    done = [t for t in q if t["status"] == "done"]
    return {
        "running": len(running),
        "pending": len(pending),
        "done": len(done),
        "total": len(q),
        "locked": is_locked()
    }


if __name__ == "__main__":
    print(f"Task Queue processor started (MAX_PARALLEL={MAX_PARALLEL})")
    # Сбрасываем зависшие running при старте
    _q = load_queue()
    _stuck = [t for t in _q if t["status"] == "running"]
    if _stuck:
        for t in _stuck:
            t["status"] = "queued"
            t.pop("started_at", None)
        save_queue(_q)
        unlock()
        print(f"Reset {len(_stuck)} stuck task(s) to queued")
    while True:
        try:
            # Запускаем столько новых задач, сколько влезет в MAX_PARALLEL
            started = 0
            while process_next():
                started += 1
            if started == 0:
                time.sleep(3)
        except KeyboardInterrupt:
            print("Stopped")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(10)
