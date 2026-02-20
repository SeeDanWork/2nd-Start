"""
FastAPI routes for onboarding schedule generation.

Endpoints:
  POST /onboarding/validate   — validate inputs, detect conflicts
  POST /onboarding/options     — generate 3-5 schedule options
  POST /onboarding/explain     — explain a specific option (by profile)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.brain.domain import (
    OnboardingInput,
    OnboardingConfig,
    OnboardingOutput,
    ValidationResult,
    ConflictReport,
)
from app.brain.conflicts import validate_inputs, detect_conflicts

# Try OR-Tools solver first, fall back to heuristic
try:
    from app.brain.solver import generate_options
    SOLVER_AVAILABLE = True
except ImportError:
    SOLVER_AVAILABLE = False

from app.brain.heuristic import generate_options_heuristic


router = APIRouter()


class OptionsRequest(BaseModel):
    inputs: OnboardingInput
    config: Optional[OnboardingConfig] = None


class ValidateRequest(BaseModel):
    inputs: OnboardingInput


class ExplainRequest(BaseModel):
    inputs: OnboardingInput
    profile: str


@router.post("/validate", response_model=ValidationResult)
async def validate(request: ValidateRequest) -> ValidationResult:
    """Validate onboarding inputs for structural correctness."""
    return validate_inputs(request.inputs)


@router.post("/conflicts", response_model=ConflictReport)
async def conflicts(request: ValidateRequest) -> ConflictReport:
    """Detect infeasible constraint combinations."""
    return detect_conflicts(request.inputs)


@router.post("/options", response_model=OnboardingOutput)
async def options(request: OptionsRequest) -> OnboardingOutput:
    """
    Generate 3-5 schedule options.

    Uses OR-Tools CP-SAT solver if available, otherwise falls back
    to a heuristic pattern-based scheduler.
    """
    # Validate first
    validation = validate_inputs(request.inputs)
    if not validation.valid:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Invalid inputs",
                "errors": [e.model_dump() for e in validation.errors],
            },
        )

    if SOLVER_AVAILABLE:
        return generate_options(request.inputs, request.config)
    else:
        return generate_options_heuristic(request.inputs, request.config)


@router.post("/explain")
async def explain(request: ExplainRequest):
    """
    Generate explanation for a single profile.

    Runs the solver for just that profile and returns the explanation.
    """
    config = OnboardingConfig(profiles=[request.profile])

    if SOLVER_AVAILABLE:
        result = generate_options(request.inputs, config)
    else:
        result = generate_options_heuristic(request.inputs, config)

    if not result.options:
        raise HTTPException(
            status_code=400,
            detail="No feasible schedule for this profile.",
        )

    option = result.options[0]
    return {
        "profile": option.profile,
        "name": option.name,
        "explanation": option.explanation.model_dump(),
        "stats": option.stats.model_dump(),
    }
