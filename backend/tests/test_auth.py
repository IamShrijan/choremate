"""
Tests for authentication endpoints: /auth/signup, /auth/login, /auth/logout
"""

import pytest


class TestSignup:
    def test_signup_success(self, client):
        resp = client.post(
            "/auth/signup",
            json={
                "name": "Alice",
                "email": "alice@example.com",
                "password": "SecurePass1!",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "alice@example.com"
        assert data["name"] == "Alice"
        assert "id" in data

    def test_signup_duplicate_email(self, client):
        payload = {
            "name": "Bob",
            "email": "bob@example.com",
            "password": "SecurePass1!",
        }
        client.post("/auth/signup", json=payload)
        resp = client.post("/auth/signup", json=payload)
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"].lower()

    def test_signup_missing_fields(self, client):
        resp = client.post("/auth/signup", json={"email": "x@example.com"})
        assert resp.status_code == 422  # Unprocessable Entity


class TestLogin:
    def test_login_success(self, client, registered_user):
        resp = client.post(
            "/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, registered_user):
        resp = client.post(
            "/auth/login",
            json={"email": registered_user["email"], "password": "WrongPass!"},
        )
        assert resp.status_code == 401

    def test_login_unknown_email(self, client):
        resp = client.post(
            "/auth/login",
            json={"email": "nobody@example.com", "password": "pass"},
        )
        assert resp.status_code == 401


class TestLogout:
    def test_logout_success(self, client, auth_headers):
        resp = client.post("/auth/logout", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

    def test_logout_without_token(self, client):
        resp = client.post("/auth/logout")
        assert resp.status_code in (401, 403)

    def test_reuse_token_after_logout(self, client, auth_headers):
        """Token should be blacklisted and rejected after logout."""
        client.post("/auth/logout", headers=auth_headers)
        # Try to use the same token again
        resp = client.post("/auth/logout", headers=auth_headers)
        assert resp.status_code in (401, 403)
