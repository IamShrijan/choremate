"""
Tests for chore and ticket endpoints.
LLM-calling endpoints (generate-house-chores, generate-monthly-tickets) are
tested via mocking — no real Gemini API call is made.
"""

import pytest
from unittest.mock import patch


# ─── Helpers ─────────────────────────────────────────────────────────────────

def create_house(client, auth_headers):
    """Helper: create a test house and return its ID."""
    resp = client.post(
        "/houses/create",
        json={
            "name": "Test House",
            "house_layout": {"rooms": ["kitchen", "bathroom", "bedroom"]},
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["house_id"]


def add_chore(client, auth_headers, **kwargs):
    payload = {
        "name": kwargs.get("name", "Sweep Floor"),
        "description": kwargs.get("description", "Sweep the living room"),
        "difficulty_level": kwargs.get("difficulty_level", 2),
        "chore_frequency": kwargs.get("chore_frequency", "Weekly"),
        "chore_priority": kwargs.get("chore_priority", 2),
        "duration": kwargs.get("duration", 15),
        "notes": kwargs.get("notes", ""),
        "icon": kwargs.get("icon", "🧹"),
    }
    return client.post("/chores/add", json=payload, headers=auth_headers)


# ─── Tests: Add Chore ─────────────────────────────────────────────────────────

class TestAddChore:
    def test_add_chore_success(self, client, auth_headers):
        create_house(client, auth_headers)
        resp = add_chore(client, auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "chore added"
        assert "chore_id" in data

    def test_add_chore_without_house(self, client, auth_headers):
        """User must belong to a house before adding chores."""
        resp = add_chore(client, auth_headers)
        assert resp.status_code == 400
        assert "house" in resp.json()["detail"].lower()

    def test_add_chore_unauthenticated(self, client):
        resp = client.post(
            "/chores/add",
            json={
                "name": "Dishes",
                "description": "Wash them",
                "difficulty_level": 1,
                "chore_frequency": "Daily",
                "chore_priority": 3,
                "duration": 10,
                "notes": "",
                "icon": "🍽️",
            },
        )
        assert resp.status_code in (401, 403)

    def test_add_multiple_chores(self, client, auth_headers):
        create_house(client, auth_headers)
        chores = [
            {
                "name": f"Chore {i}",
                "description": "desc",
                "difficulty_level": 1,
                "chore_frequency": "Weekly",
                "chore_priority": 1,
                "duration": 10,
                "notes": "",
                "icon": "🧹",
            }
            for i in range(3)
        ]
        resp = client.post("/chores/add-chores", json=chores, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["chores_count"] == 3


# ─── Tests: Tickets ──────────────────────────────────────────────────────────

class TestTickets:
    def test_get_my_tickets_empty(self, client, auth_headers):
        create_house(client, auth_headers)
        resp = client.get("/chores/my-tickets", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_update_ticket_not_found(self, client, auth_headers):
        resp = client.patch(
            "/chores/ticket/99999",
            json={"status": "Completed"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_mark_ticket_complete_not_found(self, client, auth_headers):
        resp = client.patch(
            "/chores/ticket/99999/complete",
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ─── Tests: Generate House Chores (mocked) ───────────────────────────────────

class TestGenerateHouseChores:
    @patch("app.api.routes.chores.generate_house_chores")
    def test_generate_chores_queues_task(self, mock_generate, client, auth_headers):
        create_house(client, auth_headers)
        mock_generate.return_value = {
            "status": "success",
            "total_chores_created": 3,
            "chores": [
                {
                    "name": "Dishes",
                    "description": "Wash dishes",
                    "difficulty_level": 1,
                    "chore_frequency": "Daily",
                    "chore_priority": 3,
                    "duration": 10,
                    "notes": "Essential hygiene task",
                    "icon": "🍽️",
                }
            ],
        }
        resp = client.post("/chores/generate-house-chores", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        mock_generate.assert_called_once()

    @patch("app.api.routes.chores.generate_house_chores")
    def test_generate_chores_handles_error(self, mock_generate, client, auth_headers):
        create_house(client, auth_headers)
        mock_generate.return_value = {"status": "error", "message": "AI failed"}
        resp = client.post("/chores/generate-house-chores", headers=auth_headers)
        assert resp.status_code == 400

    def test_generate_chores_no_house(self, client, auth_headers):
        resp = client.post("/chores/generate-house-chores", headers=auth_headers)
        assert resp.status_code == 400
        assert "house" in resp.json()["detail"].lower()
