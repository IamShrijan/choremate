"""
pytest configuration and shared fixtures for the Choremate backend test suite.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.database import Base, get_db

# ─── In-memory SQLite DB for tests ───────────────────────────────────────────
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db():
    """Provide a clean DB session for a test."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def override_get_db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client():
    """FastAPI test client with the test DB injected."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ─── Convenience fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def registered_user(client):
    """Register a user and return their credentials."""
    payload = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "TestPassword123!",
    }
    resp = client.post("/auth/signup", json=payload)
    assert resp.status_code == 201
    return payload


@pytest.fixture
def auth_headers(client, registered_user):
    """Return Authorization headers for a logged-in user."""
    resp = client.post(
        "/auth/login",
        json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        },
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
