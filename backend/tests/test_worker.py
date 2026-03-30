"""
Unit tests for Celery task definitions in app/tasks.py.
All DB calls and core functions are mocked so no real DB or LLM is used.
"""

import pytest
from unittest.mock import MagicMock, patch


class TestGenerateHouseChoresTask:
    @patch("app.tasks.generate_house_chores")
    def test_task_success(self, mock_generate_chores):
        from app.tasks import generate_house_chores_task

        mock_generate_chores.return_value = {
            "status": "success",
            "total_chores_created": 2,
            "chores": [],
        }

        # Run the task synchronously (eager mode)
        result = generate_house_chores_task.run("house-uuid-123")

        assert result["status"] == "success"
        assert result["total_chores_created"] == 2
        mock_generate_chores.assert_called_once()

    @patch("app.tasks.generate_house_chores")
    def test_task_retries_on_error(self, mock_generate_chores):
        from app.tasks import generate_house_chores_task
        from celery.exceptions import Retry

        mock_generate_chores.return_value = {
            "status": "error",
            "message": "House not found",
        }

        with pytest.raises((Retry, ValueError)):
            generate_house_chores_task.run("bad-house-id")


class TestGenerateMonthlyTicketsTask:
    @patch("app.tasks.generate_monthly_tickets")
    def test_task_success(self, mock_generate_tickets):
        from app.tasks import generate_monthly_tickets_task

        mock_generate_tickets.return_value = {
            "status": "success",
            "tickets_created": 10,
        }

        result = generate_monthly_tickets_task.run("house-uuid-456")

        assert result["status"] == "success"
        assert result["tickets_created"] == 10
        mock_generate_tickets.assert_called_once()

    @patch("app.tasks.generate_monthly_tickets")
    def test_task_handles_llm_error(self, mock_generate_tickets):
        from app.tasks import generate_monthly_tickets_task
        from celery.exceptions import Retry

        mock_generate_tickets.return_value = {
            "status": "error",
            "message": "Gemini API error",
        }

        with pytest.raises((Retry, ValueError)):
            generate_monthly_tickets_task.run("house-uuid-456")


class TestWorkerConfiguration:
    def test_celery_app_is_configured(self):
        from app.worker import celery_app

        assert celery_app.main == "choremate"
        assert celery_app.conf.task_serializer == "json"
        assert celery_app.conf.result_serializer == "json"
        assert celery_app.conf.worker_prefetch_multiplier == 1

    def test_tasks_are_registered(self):
        """Verify all expected tasks are registered in the Celery app."""
        from app.worker import celery_app
        import app.tasks  # noqa: F401 — register tasks

        registered = celery_app.tasks.keys()
        assert "choremate.generate_house_chores" in registered
        assert "choremate.generate_monthly_tickets" in registered
        assert "choremate.generate_weekly_tickets" in registered
