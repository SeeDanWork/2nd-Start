"""FastAPI routes for bootstrap scheduling."""

from fastapi import APIRouter

from app.bootstrap.models import BootstrapScheduleRequest, BootstrapScheduleResponse
from app.bootstrap.orchestrator import process_bootstrap_request

router = APIRouter()


@router.post("/schedule", response_model=BootstrapScheduleResponse)
async def create_bootstrap_schedule(request: BootstrapScheduleRequest):
    """Create a schedule from natural language bootstrap facts."""
    return process_bootstrap_request(request)
