import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import Settings
from app.create_db import create_database

# Point the whole app at the test database before app.database builds its engine.
TEST_DATABASE_URL = Settings().test_database_url
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
create_database(TEST_DATABASE_URL)

from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:  # runs the lifespan, which creates the tables
        yield test_client


@pytest.fixture(autouse=True)
def clean_tables(client):
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE expenses RESTART IDENTITY"))


@pytest.fixture
def make_expense(client):
    def _make(**overrides):
        payload = {"amount": 10, "category": "food", "spent_on": "2026-01-15", **overrides}
        response = client.post("/expenses", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make
