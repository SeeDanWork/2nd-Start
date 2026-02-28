from pydantic import BaseModel
from enum import Enum
from typing import Optional


class ParentRole(str, Enum):
    PARENT_A = "parent_a"
    PARENT_B = "parent_b"


class SolverWeights(BaseModel):
    fairness_deviation: int = 100
    total_transitions: int = 50
    non_daycare_handoffs: int = 30
    weekend_fragmentation: int = 40
    school_night_disruption: int = 60


class LockedNight(BaseModel):
    parent: ParentRole
    days_of_week: list[int]  # 0=Sun, 6=Sat


class MaxConsecutive(BaseModel):
    parent: ParentRole
    max_nights: int


class WeekendSplit(BaseModel):
    target_pct_parent_a: int = 50
    tolerance_pct: int = 10


class BonusWeek(BaseModel):
    parent: ParentRole
    start_date: str
    end_date: str


class HolidayEntry(BaseModel):
    date: str
    daycare_closed: bool = False


class DisruptionLock(BaseModel):
    parent: ParentRole
    date: str
    source: str = "disruption"


class ScheduleRequest(BaseModel):
    horizon_start: str
    horizon_end: str
    locked_nights: list[LockedNight] = []
    max_consecutive: list[MaxConsecutive] = []
    max_transitions_per_week: int = 3
    weekend_definition: str = "fri_sat"
    weekend_split: Optional[WeekendSplit] = None
    daycare_exchange_days: list[int] = [1, 2, 3, 4, 5]
    school_night_consistency: bool = False
    bonus_weeks: list[BonusWeek] = []
    holidays: list[HolidayEntry] = []
    weights: SolverWeights = SolverWeights()
    max_solutions: int = 10
    timeout_seconds: int = 30
    weekend_split_window_weeks: int = 8
    disruption_locks: list[DisruptionLock] = []


class FrozenAssignment(BaseModel):
    date: str
    parent: ParentRole


class RequestConstraint(BaseModel):
    type: str  # need_coverage, want_time, bonus_week, swap_date
    dates: list[str]
    parent: ParentRole
    swap_target_dates: list[str] = []


class ProposalRequest(BaseModel):
    horizon_start: str
    horizon_end: str
    frozen_assignments: list[FrozenAssignment] = []
    request_constraints: list[RequestConstraint] = []
    locked_nights: list[LockedNight] = []
    max_consecutive: list[MaxConsecutive] = []
    max_transitions_per_week: int = 3
    weekend_definition: str = "fri_sat"
    weekend_split: Optional[WeekendSplit] = None
    daycare_exchange_days: list[int] = [1, 2, 3, 4, 5]
    school_night_consistency: bool = False
    bonus_weeks: list[BonusWeek] = []
    holidays: list[HolidayEntry] = []
    weights: SolverWeights = SolverWeights()
    max_solutions: int = 10
    timeout_seconds: int = 30
    current_schedule_hint: list[FrozenAssignment] = []
    disruption_locks: list[DisruptionLock] = []
