"""
Celery tasks for Choremate — async wrappers around LLM-heavy operations.

Each task:
  - Accepts the minimal data needed (IDs, not SQLAlchemy objects)
  - Creates its own DB session
  - Calls the underlying core function
  - Returns a serializable result dict

Routes that previously called core functions synchronously now call
  <task>.delay(...) and return {"task_id": result.id} to the client.
The client polls GET /tasks/{task_id}/status.
"""

import logging
from celery import Task
from .worker import celery_app
from .db.database import SessionLocal

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task class that provides a lazy DB session."""

    _db = None

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None

    @property
    def db(self):
        if self._db is None:
            self._db = SessionLocal()
        return self._db


# ---------------------------------------------------------------------------
# Task: Generate House Chores (LLM call)
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="choremate.generate_house_chores",
    max_retries=2,
    default_retry_delay=60,
)
def generate_house_chores_task(self, house_id: str) -> dict:
    """
    Async wrapper for generate_house_chores().
    Called by POST /chores/generate-house-chores.
    """
    from .core.generate_house_chores import generate_house_chores

    logger.info(f"[Task] Generating house chores for house_id={house_id}")
    try:
        result = generate_house_chores(self.db, house_id)
        if result.get("status") == "error":
            raise ValueError(result["message"])
        return result
    except Exception as exc:
        logger.error(f"[Task] generate_house_chores failed: {exc}")
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Task: Generate Monthly Tickets (LLM call)
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="choremate.generate_monthly_tickets",
    max_retries=2,
    default_retry_delay=60,
)
def generate_monthly_tickets_task(self, house_id: str) -> dict:
    """
    Async wrapper for generate_monthly_tickets().
    Called by POST /chores/generate-monthly-tickets.
    """
    from .core.generate_monthly_tickets import generate_monthly_tickets

    logger.info(f"[Task] Generating monthly tickets for house_id={house_id}")
    try:
        result = generate_monthly_tickets(self.db, house_id)
        if result.get("status") == "error":
            raise ValueError(result["message"])
        return result
    except Exception as exc:
        logger.error(f"[Task] generate_monthly_tickets failed: {exc}")
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Task: Generate Weekly Tickets (LLM call)
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="choremate.generate_weekly_tickets",
    max_retries=2,
    default_retry_delay=60,
)
def generate_weekly_tickets_task(self, house_id: str) -> dict:
    """
    Async wrapper for generate_weekly_tickets().
    Called by POST /chores/generate-weekly-tickets (if applicable).
    """
    from .core.generate_weekly_tickets import generate_weekly_tickets

    logger.info(f"[Task] Generating weekly tickets for house_id={house_id}")
    try:
        result = generate_weekly_tickets(self.db, house_id)
        if result.get("status") == "error":
            raise ValueError(result["message"])
        return result
    except Exception as exc:
        logger.error(f"[Task] generate_weekly_tickets failed: {exc}")
        raise self.retry(exc=exc)
