from fastapi import APIRouter

from app.models.requests import ProposalRequest, ScheduleRequest
from app.models.responses import ProposalResponse, ScheduleResponse
from app.solver.base_schedule import generate_base_schedule
from app.solver.proposals import generate_proposals

router = APIRouter()


@router.post("/base-schedule", response_model=ScheduleResponse)
async def create_base_schedule(request: ScheduleRequest):
    return generate_base_schedule(request)


@router.post("/proposals", response_model=ProposalResponse)
async def create_proposals(request: ProposalRequest):
    return generate_proposals(request)
