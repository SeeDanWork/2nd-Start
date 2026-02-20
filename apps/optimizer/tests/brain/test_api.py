"""
Integration tests for the onboarding FastAPI routes.

Tests the full HTTP request/response cycle using httpx.AsyncClient.
"""

import pytest
import json
from pathlib import Path

try:
    from httpx import AsyncClient, ASGITransport
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

pytestmark = pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")

from app.main import app


EXAMPLES_DIR = Path(__file__).parent.parent.parent / "examples"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
class TestHealthEndpoint:
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


@pytest.mark.anyio
class TestValidateEndpoint:
    async def test_validate_cooperative(self, client):
        payload = json.loads(
            (EXAMPLES_DIR / "cooperative_planners_input.json").read_text()
        )
        resp = await client.post("/onboarding/validate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True

    async def test_validate_infeasible(self, client):
        payload = json.loads(
            (EXAMPLES_DIR / "infeasible_input.json").read_text()
        )
        resp = await client.post("/onboarding/validate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        # Structurally valid even if infeasible
        assert data["valid"] is True


@pytest.mark.anyio
class TestConflictsEndpoint:
    async def test_conflicts_cooperative(self, client):
        payload = json.loads(
            (EXAMPLES_DIR / "cooperative_planners_input.json").read_text()
        )
        resp = await client.post("/onboarding/conflicts", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["feasible"] is True

    async def test_conflicts_infeasible(self, client):
        payload = json.loads(
            (EXAMPLES_DIR / "infeasible_input.json").read_text()
        )
        resp = await client.post("/onboarding/conflicts", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["conflicts"]) > 0


@pytest.mark.anyio
class TestOptionsEndpoint:
    async def test_options_cooperative(self, client):
        payload = json.loads(
            (EXAMPLES_DIR / "cooperative_planners_input.json").read_text()
        )
        resp = await client.post("/onboarding/options", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["options"]) >= 1
        assert data["solve_time_ms"] > 0

        # Each option should have required fields
        for option in data["options"]:
            assert "id" in option
            assert "name" in option
            assert "profile" in option
            assert "schedule" in option
            assert "stats" in option
            assert "explanation" in option
            assert len(option["schedule"]) == 14  # 14 days

    async def test_options_shift_work(self, client):
        payload = json.loads(
            (EXAMPLES_DIR / "shift_work_input.json").read_text()
        )
        resp = await client.post("/onboarding/options", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["options"]) >= 1

    async def test_options_parallel(self, client):
        payload = json.loads(
            (EXAMPLES_DIR / "parallel_parenting_input.json").read_text()
        )
        resp = await client.post("/onboarding/options", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["options"]) >= 1


@pytest.mark.anyio
class TestExplainEndpoint:
    async def test_explain_stability(self, client):
        payload = json.loads(
            (EXAMPLES_DIR / "cooperative_planners_input.json").read_text()
        )
        payload["profile"] = "stability_first"
        resp = await client.post("/onboarding/explain", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["profile"] == "stability_first"
        assert "explanation" in data
        assert len(data["explanation"]["bullets"]) >= 1
