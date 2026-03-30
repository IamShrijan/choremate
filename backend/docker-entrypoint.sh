#!/bin/sh
set -e

# If WORKER_MODE is set to "true", start the Celery worker
if [ "$WORKER_MODE" = "true" ]; then
  echo "Starting Celery worker..."
  exec celery -A app.worker worker \
    --loglevel=info \
    --concurrency=4 \
    -Q choremate-tasks
else
  echo "Starting FastAPI server..."
  exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 2
fi
