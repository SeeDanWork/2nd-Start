"""
Domain models for onboarding schedule generation.

All day-of-week values use JS convention: 0=Sun, 1=Mon ... 6=Sat.
Internally the solver converts to Python convention (0=Mon ... 6=Sun).
"""

from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional


# ── Enums ──────────────────────────────────────────────────────────────

class AgeBand(str, Enum):
    INFANT = "0-4"
    SCHOOL_AGE = "5-10"
    TEEN = "11-17"


class ExchangeLocation(str, Enum):
    SCHOOL = "school"
    DAYCARE = "daycare"
    HOME = "home"
    OTHER = "other"


class LivingArrangement(str, Enum):
    SHARED = "shared"
    PRIMARY_VISITS = "primary_visits"
    UNDECIDED = "undecided"


class WeekendPreference(str, Enum):
    ALTERNATE = "alternate"
    FIXED = "fixed"
    FLEXIBLE = "flexible"


class OptionProfile(str, Enum):
    STABILITY = "stability_first"
    FAIRNESS = "fairness_first"
    LOGISTICS = "logistics_first"
    WEEKEND_PARITY = "weekend_parity_first"
    CHILD_ROUTINE = "child_routine_first"


# ── Input Models ───────────────────────────────────────────────────────

class SchoolSchedule(BaseModel):
    school_days: list[int] = Field(
        default=[1, 2, 3, 4, 5],
        description="JS-style days (0=Sun..6=Sat). Default Mon-Fri.",
    )
    school_start_time: str = Field(default="08:00")
    school_end_time: str = Field(default="15:00")


class DaycareSchedule(BaseModel):
    daycare_days: list[int] = Field(
        default=[1, 2, 3, 4, 5],
        description="JS-style days (0=Sun..6=Sat). Default Mon-Fri.",
    )
    daycare_start_time: str = Field(default="07:30")
    daycare_end_time: str = Field(default="17:30")


class ParentAvailability(BaseModel):
    locked_nights: list[int] = Field(
        default_factory=list,
        description="JS-style days parent CANNOT have child overnight.",
    )
    locked_mornings: list[int] = Field(default_factory=list)
    locked_evenings: list[int] = Field(default_factory=list)
    work_shifts: Optional[list[dict]] = Field(
        default=None,
        description="Optional irregular work patterns.",
    )


class ParentPreferences(BaseModel):
    target_share_pct: float = Field(
        default=50.0,
        ge=0.0,
        le=100.0,
        description="Desired percentage of overnights for this parent.",
    )
    max_handoffs_per_week: int = Field(
        default=3,
        ge=1,
        description="Soft cap on handoffs per 7-day window.",
    )
    max_consecutive_nights_away: int = Field(
        default=5,
        ge=1,
        description="Soft/hard cap on consecutive nights without child.",
    )
    weekend_preference: WeekendPreference = Field(
        default=WeekendPreference.ALTERNATE,
    )
    holiday_handling: Optional[str] = Field(
        default=None,
        description="Future: rotate, split, attach-to-weekend-parent.",
    )


class ParentConstraints(BaseModel):
    minimum_nights_per_2_weeks: Optional[int] = Field(default=None)
    cannot_do_exchanges_in_person: bool = Field(default=False)
    commute_minutes_to_school: Optional[int] = Field(default=None)


class ParentProfile(BaseModel):
    parent_id: str
    availability: ParentAvailability = Field(default_factory=ParentAvailability)
    preferences: ParentPreferences = Field(default_factory=ParentPreferences)
    constraints: ParentConstraints = Field(default_factory=ParentConstraints)
    willingness_accept_non_school_handoffs: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="0=strongly prefers school-only, 1=flexible.",
    )


class SharedConstraints(BaseModel):
    distance_between_homes_minutes: Optional[int] = Field(default=None)
    no_contact_preference: bool = Field(
        default=False,
        description="If true, prefer school/daycare-only exchanges.",
    )
    start_date: str = Field(
        description="ISO date for schedule start, e.g. '2026-03-02'.",
    )
    horizon_days: int = Field(
        default=14,
        ge=7,
        le=56,
        description="Planning window in days. Default 14 (2-week pattern).",
    )
    horizon_weeks_fairness: int = Field(
        default=8,
        description="Lookback window for fairness scoring.",
    )


class OnboardingInput(BaseModel):
    """Top-level input for the onboarding brain."""

    number_of_children: int = Field(default=1, ge=1)
    children_age_bands: list[AgeBand] = Field(
        default_factory=lambda: [AgeBand.SCHOOL_AGE],
    )
    school_schedule: SchoolSchedule = Field(default_factory=SchoolSchedule)
    daycare_schedule: Optional[DaycareSchedule] = Field(default=None)
    preferred_exchange_location: ExchangeLocation = Field(
        default=ExchangeLocation.SCHOOL,
    )

    living_arrangement: LivingArrangement = Field(
        default=LivingArrangement.SHARED,
        description="How children's time is divided between homes.",
    )

    parent_a: ParentProfile
    parent_b: Optional[ParentProfile] = Field(
        default=None,
        description="None for single-parent onboarding.",
    )
    shared: SharedConstraints
    season_mode: Optional[str] = None

    class Config:
        use_enum_values = True


class OnboardingConfig(BaseModel):
    """Controls for option generation."""

    profiles: list[OptionProfile] = Field(
        default_factory=lambda: list(OptionProfile),
        description="Which profiles to generate. Default: all 5.",
    )
    timeout_seconds: int = Field(default=30, ge=5, le=120)
    min_diversity_distance: int = Field(
        default=2,
        ge=0,
        description="Minimum Hamming distance between options.",
    )

    class Config:
        use_enum_values = True


# ── Output Models ──────────────────────────────────────────────────────

class ScheduleDay(BaseModel):
    date: str
    day_of_week: int = Field(description="JS-style 0=Sun..6=Sat.")
    assigned_to: str = Field(description="'parent_a' or 'parent_b'.")
    is_transition: bool = Field(
        default=False,
        description="True if custody changes from previous day.",
    )


class HandoffInfo(BaseModel):
    date: str
    time: Optional[str] = Field(default=None)
    location_type: str = Field(description="school, daycare, home, other.")
    from_parent: str
    to_parent: str


class ScheduleStats(BaseModel):
    parent_a_overnights: int
    parent_b_overnights: int
    parent_a_weekend_nights: int
    parent_b_weekend_nights: int
    transitions_count: int
    non_school_handoffs: int
    stability_score: float = Field(
        description="1.0 = most stable (fewest transitions). Normalized.",
    )
    fairness_score: float = Field(
        description="1.0 = perfectly fair. Drops with imbalance.",
    )
    weekend_parity_score: float = Field(
        description="1.0 = perfectly balanced weekends.",
    )


class ConstraintApplied(BaseModel):
    name: str = Field(description="Constraint name, e.g. 'locked_night_parent_a'.")
    type: str = Field(description="Constraint type (hard/soft).")
    satisfied: bool = Field(description="Whether this constraint is satisfied.")
    detail: str = Field(default="", description="Additional detail.")


class DisruptionImpact(BaseModel):
    event_type: str = Field(description="Disruption event type.")
    action_taken: str = Field(description="Overlay action taken.")
    affected_dates: list[str] = Field(default_factory=list)
    compensation_days: int = Field(default=0)


class StabilityMetricsExplanation(BaseModel):
    transitions_per_week: float
    max_consecutive_nights: int
    school_night_consistency_pct: float


class FairnessMetricsExplanation(BaseModel):
    overnight_split_pct: float = Field(description="Parent A share as percentage.")
    weekend_split_pct: float = Field(description="Parent A weekend share as percentage.")
    deviation_from_target: float


class Explanation(BaseModel):
    bullets: list[str] = Field(
        description="3-6 human-readable summary bullets.",
    )
    respected_constraints: list[str] = Field(
        description="Which locked nights / hard constraints are met.",
    )
    tradeoffs: list[str] = Field(
        description="Explicit tradeoff callouts.",
    )
    assumptions: list[str] = Field(
        default_factory=list,
        description="Assumptions made (especially for 1-parent mode).",
    )
    profile_used: str = Field(
        default="",
        description="Which solver profile was used.",
    )
    primary_objective: str = Field(
        default="",
        description="Primary optimization objective.",
    )
    key_constraints_applied: list[ConstraintApplied] = Field(
        default_factory=list,
        description="Key constraints and whether they were satisfied.",
    )
    disruption_impacts: list[DisruptionImpact] = Field(
        default_factory=list,
        description="How disruption events affected the schedule.",
    )
    stability_metrics: Optional[StabilityMetricsExplanation] = Field(
        default=None,
        description="Stability metrics for this option.",
    )
    fairness_metrics: Optional[FairnessMetricsExplanation] = Field(
        default=None,
        description="Fairness metrics for this option.",
    )


class ScheduleOption(BaseModel):
    id: str
    name: str
    profile: str
    schedule: list[ScheduleDay]
    handoffs: list[HandoffInfo]
    stats: ScheduleStats
    explanation: Explanation
    similarity_score: float = 0.0


class ConflictDetail(BaseModel):
    description: str
    involved_constraints: list[str]
    suggested_relaxation: str


class ConflictReport(BaseModel):
    feasible: bool
    conflicts: list[ConflictDetail] = Field(default_factory=list)


class OnboardingOutput(BaseModel):
    options: list[ScheduleOption]
    conflict_report: Optional[ConflictReport] = Field(default=None)
    solve_time_ms: float
    is_partial: bool = Field(
        default=False,
        description="True if only one parent provided input.",
    )


class ValidationError(BaseModel):
    field: str
    message: str


class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationError] = Field(default_factory=list)


# ── Re-optimization Models (future adjustments) ───────────────────────

class ExistingAssignment(BaseModel):
    date: str
    assigned_to: str
    is_locked: bool = Field(
        default=False,
        description="If true, this day cannot be changed (hard lock).",
    )


class AdjustmentRequest(BaseModel):
    """Request to re-optimize with an existing schedule."""

    current_schedule: list[ExistingAssignment]
    delta_constraints: Optional[OnboardingInput] = Field(default=None)
    preserve_weight: float = Field(
        default=200.0,
        description="Penalty per changed day from existing schedule.",
    )
    exception_dates: list[str] = Field(
        default_factory=list,
        description="Dates that may be changed without penalty.",
    )
