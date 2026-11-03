import pytest
from fastapi.testclient import TestClient

from app.dependencies import model_manager
from app.main import app
from tests.conftest import FakeEncoder, make_internship, make_student


@pytest.fixture
def client(monkeypatch):
    async def fake_load():
        model_manager.skill_encoder = FakeEncoder()
        model_manager.ranker = None

    monkeypatch.setattr(model_manager, "load_models", fake_load)
    monkeypatch.setattr("app.middleware.auth.settings.API_KEY", "test-key")
    with TestClient(app) as c:
        yield c


def rank_body(**overrides):
    body = {
        "student": make_student().model_dump(mode="json"),
        "internships": [
            make_internship(internship_id="a").model_dump(mode="json"),
            make_internship(internship_id="b", location="Chennai").model_dump(mode="json"),
        ],
        "max_matches": 5,
    }
    body.update(overrides)
    return body


def test_health_and_ready_are_public(client):
    assert client.get("/api/v1/health").status_code == 200
    ready = client.get("/api/v1/ready")
    assert ready.status_code == 200
    assert ready.json()["encoder_loaded"] is True


def test_matching_requires_api_key(client):
    assert client.post("/api/v1/matching/rank", json=rank_body()).status_code == 422  # header missing
    res = client.post("/api/v1/matching/rank", json=rank_body(), headers={"X-API-Key": "wrong"})
    assert res.status_code == 401


def test_rank_returns_ordered_matches_and_echoes_correlation_id(client):
    res = client.post(
        "/api/v1/matching/rank",
        json=rank_body(),
        headers={"X-API-Key": "test-key", "X-Correlation-ID": "abc123"},
    )
    assert res.status_code == 200
    assert res.headers["X-Correlation-ID"] == "abc123"
    data = res.json()
    assert data["student_id"] == "s1"
    assert data["total_matches"] == 2
    scores = [m["overall_score"] for m in data["matches"]]
    assert scores == sorted(scores, reverse=True)
    assert data["matches"][0]["internship_id"] == "a"  # location match wins


def test_rank_honours_min_score(client):
    res = client.post(
        "/api/v1/matching/rank",
        json=rank_body(min_score=0.999),
        headers={"X-API-Key": "test-key"},
    )
    assert res.status_code == 200
    assert res.json()["total_matches"] == 0


def test_rank_validates_payload(client):
    body = rank_body()
    body["student"]["cgpa"] = 42
    res = client.post("/api/v1/matching/rank", json=body, headers={"X-API-Key": "test-key"})
    assert res.status_code == 422
