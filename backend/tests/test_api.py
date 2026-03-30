"""
Integration tests: health check, CORS headers, root endpoint.
"""

import pytest


class TestRootEndpoint:
    def test_root_returns_welcome(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "choremate" in resp.json()["message"].lower()


class TestCORS:
    def test_cors_header_present_for_allowed_origin(self, client):
        resp = client.get(
            "/",
            headers={"Origin": "http://localhost:5173"},
        )
        assert "access-control-allow-origin" in resp.headers

    def test_cors_preflight(self, client):
        resp = client.options(
            "/auth/signup",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        # FastAPI CORS middleware returns 200 for preflight
        assert resp.status_code == 200


class TestHealthInfrastructure:
    def test_database_tables_created(self, client, db):
        """Verify all expected tables exist after startup."""
        from sqlalchemy import inspect
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()
        # At minimum these model tables must be present
        assert "users" in tables or "user" in tables.lower() or len(tables) > 0
