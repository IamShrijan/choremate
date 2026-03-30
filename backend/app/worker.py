"""
Celery application definition for Choremate async task queue.

Uses SQS as the broker (in AWS) or Redis/in-memory for local dev.
Workers are launched by the same Docker image with WORKER_MODE=true.
"""

import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Broker configuration
# In AWS: broker_url = "sqs://" — uses boto3 credentials (via LabRole)
# Locally: set CELERY_BROKER_URL=sqla+sqlite:///celery.db or redis://...
# ---------------------------------------------------------------------------
BROKER_URL = os.getenv("CELERY_BROKER_URL", "sqs://")
SQS_QUEUE_NAME = os.getenv("SQS_QUEUE_NAME", "choremate-tasks")

# AWS region for SQS (only needed when broker is SQS)
AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

celery_app = Celery(
    "choremate",
    broker=BROKER_URL,
    include=["app.tasks"],
)

celery_app.conf.update(
    # SQS-specific broker transport options
    broker_transport_options={
        "region": AWS_REGION,
        "predefined_queues": {
            SQS_QUEUE_NAME: {
                "url": os.getenv("SQS_QUEUE_URL", ""),
            }
        },
    },
    # Task routing — all tasks go to the choremate-tasks queue
    task_default_queue=SQS_QUEUE_NAME,
    # Result backend: store results in the same DB as the app.
    # In production: postgresql://... (from SSM DATABASE_URL env var)
    # In local dev: falls back to SQLite (same as the app)
    result_backend=os.getenv(
        "CELERY_RESULT_BACKEND",
        os.getenv("DATABASE_URL", "db+sqlite:///./choremate_celery.db"),
    ),
    result_expires=3600,  # Results expire after 1 hour
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_max_retries=3,
    task_default_retry_delay=30,
    # Worker settings
    worker_prefetch_multiplier=1,  # Process one message at a time (LLM calls can be slow)
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks to prevent memory leaks
)
