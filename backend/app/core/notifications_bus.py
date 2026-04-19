from typing import Optional
"""
notifications_bus.py — In-process SSE notification signal bus.

Controlled by NOTIFICATION_BACKEND env var:
  "memory"  (default) — asyncio queues, works for a single server process
  "redis"             — Redis pub/sub fanout, works across multiple ECS instances
                        Requires REDIS_URL env var (e.g. redis://localhost:6379/0)

Usage (in route handlers):
    from app.core.notifications_bus import publish_notification_sync
    publish_notification_sync(user_id)          # from sync def handlers
    await publish_notification_async(user_id)   # from async def handlers

Usage (in the SSE stream endpoint):
    from app.core.notifications_bus import sse_listener
    async with sse_listener(user_id) as queue:
        signal = await queue.get()   # blocks until a notification arrives
"""

import asyncio
import os
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

NOTIFICATION_BACKEND = os.getenv("NOTIFICATION_BACKEND", "memory")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ─────────────────────────────────────────────────────────────────────────────
# In-memory backend
# Each user_id maps to a set of asyncio.Queue objects (one per browser tab).
# ─────────────────────────────────────────────────────────────────────────────

_memory_subs: dict[str, set[asyncio.Queue]] = {}

# Reference to the main event loop — set once at FastAPI startup so sync
# handlers (running in thread-pool threads) can schedule coroutines on it.
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Called from app lifespan startup to store the running event loop."""
    global _main_loop
    _main_loop = loop


def _memory_add(user_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _memory_subs.setdefault(user_id, set()).add(q)
    return q


def _memory_remove(user_id: str, q: asyncio.Queue) -> None:
    if user_id in _memory_subs:
        _memory_subs[user_id].discard(q)
        if not _memory_subs[user_id]:
            del _memory_subs[user_id]


async def _memory_publish(user_id: str) -> None:
    for q in list(_memory_subs.get(user_id, [])):
        try:
            q.put_nowait("ping")
        except asyncio.QueueFull:
            pass  # slow client — skip; they'll refresh on reconnect


# ─────────────────────────────────────────────────────────────────────────────
# Redis backend
# ─────────────────────────────────────────────────────────────────────────────


async def _redis_publish(user_id: str) -> None:
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        await r.publish(f"notif:{user_id}", "ping")
        await r.aclose()
    except Exception as e:
        logger.warning(f"[NotifBus] Redis publish failed for {user_id}: {e}")


@asynccontextmanager
async def _redis_listener(user_id: str):
    """
    Async context manager that yields an asyncio.Queue fed by Redis pub/sub.

    Uses the SYNCHRONOUS redis client running in a daemon thread, bridged back
    to asyncio via loop.call_soon_threadsafe(). This avoids the redis.asyncio
    connection issues seen with some ElastiCache / proxy configurations where
    the async client fails to subscribe while the sync client works fine.
    """
    import threading
    import redis as sync_redis

    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    loop = asyncio.get_event_loop()
    stop_event = threading.Event()

    def _reader_thread():
        """Runs in a background thread — blocks on pubsub.listen()."""
        try:
            r = sync_redis.from_url(REDIS_URL, decode_responses=True)
            pubsub = r.pubsub()
            pubsub.subscribe(f"notif:{user_id}")
            for msg in pubsub.listen():
                if stop_event.is_set():
                    break
                if msg and msg.get("type") == "message":
                    try:
                        loop.call_soon_threadsafe(q.put_nowait, "ping")
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"[NotifBus] Redis listener thread error for {user_id}: {e}")
        finally:
            try:
                pubsub.unsubscribe(f"notif:{user_id}")
                r.close()
            except Exception:
                pass

    thread = threading.Thread(target=_reader_thread, daemon=True, name=f"sse-redis-{user_id[:8]}")
    thread.start()

    try:
        yield q
    finally:
        stop_event.set()
        # Give the thread a moment to exit cleanly (it blocks on listen() so
        # setting stop_event won't interrupt it mid-block; joining briefly is enough)
        thread.join(timeout=1)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


async def publish_notification_async(user_id: str) -> None:
    """
    Publish a 'new notification' signal to all SSE subscribers for this user.
    Call from async route handlers / background tasks.
    """
    try:
        if NOTIFICATION_BACKEND == "redis":
            await _redis_publish(user_id)
        else:
            await _memory_publish(user_id)
    except Exception as e:
        logger.warning(f"[NotifBus] publish failed for {user_id}: {e}")


def publish_notification_sync(user_id: str) -> None:
    """
    Fire-and-forget publish from synchronous route handlers.
    Uses the main event loop stored at startup.
    Best-effort — never raises.
    NOTE: this only works inside the FastAPI/uvicorn process.
          From a Celery worker use publish_notification_from_worker() instead.
    """
    try:
        if _main_loop and _main_loop.is_running():
            _main_loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(
                    publish_notification_async(user_id), loop=_main_loop
                )
            )
        else:
            logger.warning(
                "[NotifBus] publish_notification_sync called before event loop was set"
            )
    except Exception as e:
        logger.warning(f"[NotifBus] sync publish failed for {user_id}: {e}")


def publish_notification_from_worker(user_id: str) -> None:
    """
    Synchronous Redis publish for use inside Celery worker tasks.

    Celery tasks run outside the FastAPI process — there is no asyncio event
    loop and _main_loop is never set.  We bypass all of that and call the
    synchronous redis client directly.

    Requires NOTIFICATION_BACKEND=redis (set in the worker ECS task definition).
    Falls back to a best-effort asyncio.run() for local/memory mode.
    """
    try:
        if NOTIFICATION_BACKEND == "redis":
            import redis as sync_redis  # synchronous client, no event loop needed
            r = sync_redis.from_url(REDIS_URL, decode_responses=True)
            r.publish(f"notif:{user_id}", "ping")
            r.close()
        else:
            # Memory backend: spin up a throwaway event loop (single-process dev only)
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(_memory_publish(user_id))
            finally:
                loop.close()
    except Exception as e:
        logger.warning(f"[NotifBus] worker publish failed for {user_id}: {e}")


@asynccontextmanager
async def sse_listener(user_id: str):
    """
    Async context manager that yields an asyncio.Queue.
    Put a 'ping' on by publish_notification_async/sync whenever a new
    notification is available for this user.

    Usage:
        async with sse_listener(user_id) as q:
            signal = await asyncio.wait_for(q.get(), timeout=25)
    """
    if NOTIFICATION_BACKEND == "redis":
        async with _redis_listener(user_id) as q:
            yield q
    else:
        q = _memory_add(user_id)
        try:
            yield q
        finally:
            _memory_remove(user_id, q)
