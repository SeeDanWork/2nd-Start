from pydantic import BaseModel
from typing import Optional


class AssignmentDay(BaseModel):
    date: str
    parent: str
    is_transition: bool


class SolutionMetrics(BaseModel):
    parent_a_overnights: int
    parent_b_overnights: int
    parent_a_weekend_nights: int
    parent_b_weekend_nights: int
    total_transitions: int
    transitions_per_week: float
    max_consecutive_a: int
    max_consecutive_b: int
    school_night_consistency_pct: float
    weekend_fragmentation_count: int


class PenaltyBreakdown(BaseModel):
    fairness_deviation: float
    total_transitions: float
    non_daycare_handoffs: float
    weekend_fragmentation: float
    school_night_disruption: float
    total: float


class Solution(BaseModel):
    rank: int
    assignments: list[AssignmentDay]
    metrics: SolutionMetrics
    penalties: PenaltyBreakdown


class ConflictingConstraint(BaseModel):
    description: str
    suggestion: str


class ScheduleResponse(BaseModel):
    status: str
    solutions: list[Solution] = []
    solve_time_ms: float
    conflicting_constraints: list[ConflictingConstraint] = []
    message: Optional[str] = None


class CalendarDiff(BaseModel):
    date: str
    old_parent: str
    new_parent: str


class FairnessImpact(BaseModel):
    overnight_delta: int
    weekend_delta: int
    window_weeks: int


class StabilityImpact(BaseModel):
    transitions_delta: int
    max_streak_change: int
    school_night_changes: int


class HandoffImpact(BaseModel):
    new_handoffs: int
    removed_handoffs: int
    non_daycare_handoffs: int


class ProposalOption(BaseModel):
    rank: int
    label: Optional[str] = None
    assignments: list[AssignmentDay]
    calendar_diff: list[CalendarDiff]
    fairness_impact: FairnessImpact
    stability_impact: StabilityImpact
    handoff_impact: HandoffImpact
    penalty_score: float
    is_auto_approvable: bool = False


class ProposalResponse(BaseModel):
    status: str
    options: list[ProposalOption] = []
    solve_time_ms: float
    conflicting_constraints: list[ConflictingConstraint] = []
    message: Optional[str] = None
