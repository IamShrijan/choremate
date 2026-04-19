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


# ---------------------------------------------------------------------------
# Task: Process Chatbot Message (Async, Mockable)
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="choremate.process_chat_message",
    max_retries=1,
)
def process_chat_message_task(self, user_id: str, message_text: str, conversation_id: str = None, force_mock: bool = False) -> dict:
    """
    Worker task for processing the AI Chatbot message.
    Supports a mock mode (USE_MOCK_LLM) to bypass the actual Gemini call and save money/time.
    """
    import os
    import time
    from .models.model import User
    from .api.routes.chatbot import _process_chat_sync, save_message
    from .core.notifications_bus import publish_notification_from_worker

    logger.info(f"[Task] Processing chat message for user_id={user_id}")

    user = self.db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"status": "error", "message": "User not found"}

    use_mock = force_mock or os.getenv("USE_MOCK_LLM", "false").lower() == "true"

    try:
        if use_mock:
            # 1. Simulate 3-second LLM delay
            time.sleep(3)

            # 2. Hardcode a dummy response
            mock_resp_text = f"Beep boop! This is a mock simulated response to: '{message_text}'. The LLM API is successfully bypassed."

            # 3. Save to database directly
            save_message(self.db, user_id, "ai", mock_resp_text)

            # 4. We skip returning actual proposals in mock mode to keep it simple,
            # or could return a dummy ChatResponse structure.
            result = {"status": "success", "response": mock_resp_text, "action_required": False}
        else:
            # Execute the real generation logic
            chat_response = _process_chat_sync(self.db, user, message_text, conversation_id)

            # Extract primitive types for celery Return
            result = {
                "status": "success",
                "response": chat_response.response,
                "proposed_action": chat_response.proposed_action.model_dump() if chat_response.proposed_action else None
            }

        # Push SSE notification via synchronous Redis publish
        # (publish_notification_sync requires FastAPI's event loop — unavailable in Celery)
        publish_notification_from_worker(user_id)

        return result

    except Exception as exc:
        logger.error(f"[Task] process_chat_message failed: {exc}")
        # Save error message so the user isn't stuck waiting forever
        save_message(self.db, user_id, "ai", "Sorry, an internal error occurred while processing your message.")
        publish_notification_from_worker(user_id)
        raise self.retry(exc=exc)
