"""Pydantic models for the bootstrap scheduling module."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.models.requests import ParentRole
from app.models.responses import ScheduleResponse


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RecurringPatternType(str, Enum):
    WEEKENDS = "weekends"
    WEEKDAYS = "weekdays"
    SPECIFIC_DAYS = "specific_days"
    ALTERNATING_WEEKS = "alternating_weeks"


class LockedRange(BaseModel):
    parent: ParentRole
    start_date: str
    end_date: str
    confidence: float = 1.0
    source_phrase: str = ""


class RecurringPattern(BaseModel):
    parent: ParentRole
    pattern_type: RecurringPatternType
    days_of_week: list[int] = []  # JS-style 0=Sun..6=Sat
    confidence: float = 1.0
    source_phrase: str = ""


class ExchangeAnchor(BaseModel):
    day_of_week: int  # JS-style DOW
    location: str = ""
    confidence: float = 1.0
    source_phrase: str = ""


class BootstrapFacts(BaseModel):
    current_parent: Optional[ParentRole] = None
    current_parent_confidence: float = 0.0
    current_parent_source: str = ""
    locked_ranges: list[LockedRange] = []
    recurring_patterns: list[RecurringPattern] = []
    exchange_anchors: list[ExchangeAnchor] = []
    target_split_pct: Optional[int] = None
    target_split_confidence: float = 0.0
    target_split_source: str = ""


class ClarificationPrompt(BaseModel):
    id: str
    field: str
    reason: str
    options: list[str] = []
    priority: int = 0


class ConflictDescription(BaseModel):
    conflict_type: str
    description: str
    involved_facts: list[str]
    clarification: ClarificationPrompt


class DiscoveryQuestion(BaseModel):
    id: str
    question_key: str
    display_text: str
    options: list[str] = []
    priority: int = 0


class StabilizationSuggestion(BaseModel):
    template_id: str
    template_name: str
    adherence_score: float
    recommendation: str


class BootstrapScheduleRequest(BaseModel):
    reference_date: str
    horizon_start: Optional[str] = None
    horizon_end: Optional[str] = None
    facts: BootstrapFacts
    already_asked: list[str] = []
    season_mode: str = "school_year"
    max_solutions: int = 3
    timeout_seconds: int = 30


class BootstrapScheduleResponse(BaseModel):
    schedule: ScheduleResponse
    clarifications: list[ClarificationPrompt] = []
    conflicts: list[ConflictDescription] = []
    discovery_questions: list[DiscoveryQuestion] = []
    stabilization: Optional[StabilizationSuggestion] = None
    applied_facts_count: int = 0
    ignored_facts_count: int = 0
