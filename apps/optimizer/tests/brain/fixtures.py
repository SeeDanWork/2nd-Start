"""
Test fixtures for the onboarding brain.

Four scenarios:
  1. Cooperative planners with school exchange (50/50, locked Tue for Parent A)
  2. Shift-work parent with irregular locked nights
  3. Parallel parenting with 'no in-person exchanges'
  4. Infeasible case (both parents locked every night)
"""

from app.brain.domain import (
    OnboardingInput,
    ParentProfile,
    ParentAvailability,
    ParentPreferences,
    ParentConstraints,
    SharedConstraints,
    SchoolSchedule,
    DaycareSchedule,
)


def cooperative_planners() -> OnboardingInput:
    """
    Scenario 1: Cooperative planners with school exchange.
    - 50/50 split
    - Parent A locked on Tuesday (JS 2)
    - School Mon-Fri, exchange at school
    - One school-age child
    """
    return OnboardingInput(
        number_of_children=1,
        children_age_bands=["5-10"],
        school_schedule=SchoolSchedule(
            school_days=[1, 2, 3, 4, 5],
            school_start_time="08:00",
            school_end_time="15:00",
        ),
        preferred_exchange_location="school",
        parent_a=ParentProfile(
            parent_id="parent_a_coop",
            availability=ParentAvailability(locked_nights=[2]),  # Tuesday
            preferences=ParentPreferences(
                target_share_pct=50.0,
                max_handoffs_per_week=3,
                max_consecutive_nights_away=5,
            ),
            constraints=ParentConstraints(),
        ),
        parent_b=ParentProfile(
            parent_id="parent_b_coop",
            availability=ParentAvailability(locked_nights=[]),
            preferences=ParentPreferences(
                target_share_pct=50.0,
                max_handoffs_per_week=3,
                max_consecutive_nights_away=5,
            ),
            constraints=ParentConstraints(),
        ),
        shared=SharedConstraints(
            start_date="2026-03-02",  # Monday
            horizon_days=14,
        ),
    )


def shift_work_parent() -> OnboardingInput:
    """
    Scenario 2: Shift-work parent with irregular locked nights.
    - Parent B works Wed/Thu/Fri nights (JS 3, 4, 5) — cannot do overnights
    - 60/40 split favoring Parent A
    - One infant child
    """
    return OnboardingInput(
        number_of_children=1,
        children_age_bands=["0-4"],
        school_schedule=SchoolSchedule(
            school_days=[1, 2, 3, 4, 5],
        ),
        daycare_schedule=DaycareSchedule(
            daycare_days=[1, 2, 3, 4, 5],
        ),
        preferred_exchange_location="daycare",
        parent_a=ParentProfile(
            parent_id="parent_a_shift",
            availability=ParentAvailability(locked_nights=[]),
            preferences=ParentPreferences(
                target_share_pct=60.0,
                max_handoffs_per_week=4,
                max_consecutive_nights_away=3,
            ),
            constraints=ParentConstraints(),
        ),
        parent_b=ParentProfile(
            parent_id="parent_b_shift",
            availability=ParentAvailability(
                locked_nights=[3, 4, 5],  # Wed, Thu, Fri
            ),
            preferences=ParentPreferences(
                target_share_pct=40.0,
                max_handoffs_per_week=4,
                max_consecutive_nights_away=3,
            ),
            constraints=ParentConstraints(),
        ),
        shared=SharedConstraints(
            start_date="2026-03-02",
            horizon_days=14,
        ),
    )


def parallel_parenting() -> OnboardingInput:
    """
    Scenario 3: Parallel parenting with no in-person exchanges.
    - Parents cannot exchange in person
    - All exchanges must happen at school/daycare
    - Teen child, longer blocks preferred
    - 50/50 target
    """
    return OnboardingInput(
        number_of_children=1,
        children_age_bands=["11-17"],
        school_schedule=SchoolSchedule(
            school_days=[1, 2, 3, 4, 5],
        ),
        preferred_exchange_location="school",
        parent_a=ParentProfile(
            parent_id="parent_a_parallel",
            availability=ParentAvailability(locked_nights=[]),
            preferences=ParentPreferences(
                target_share_pct=50.0,
                max_handoffs_per_week=2,
                max_consecutive_nights_away=7,
            ),
            constraints=ParentConstraints(
                cannot_do_exchanges_in_person=True,
            ),
        ),
        parent_b=ParentProfile(
            parent_id="parent_b_parallel",
            availability=ParentAvailability(locked_nights=[]),
            preferences=ParentPreferences(
                target_share_pct=50.0,
                max_handoffs_per_week=2,
                max_consecutive_nights_away=7,
            ),
            constraints=ParentConstraints(
                cannot_do_exchanges_in_person=True,
            ),
        ),
        shared=SharedConstraints(
            start_date="2026-03-02",
            horizon_days=14,
            no_contact_preference=True,
        ),
    )


def infeasible_case() -> OnboardingInput:
    """
    Scenario 4: Infeasible — both parents lock the same nights.
    Both parents lock Mon, Tue, Wed (JS 1, 2, 3).
    """
    return OnboardingInput(
        number_of_children=1,
        children_age_bands=["5-10"],
        school_schedule=SchoolSchedule(),
        preferred_exchange_location="school",
        parent_a=ParentProfile(
            parent_id="parent_a_infeasible",
            availability=ParentAvailability(
                locked_nights=[1, 2, 3],  # Mon, Tue, Wed
            ),
            preferences=ParentPreferences(target_share_pct=50.0),
            constraints=ParentConstraints(),
        ),
        parent_b=ParentProfile(
            parent_id="parent_b_infeasible",
            availability=ParentAvailability(
                locked_nights=[1, 2, 3],  # Mon, Tue, Wed — overlaps!
            ),
            preferences=ParentPreferences(target_share_pct=50.0),
            constraints=ParentConstraints(),
        ),
        shared=SharedConstraints(
            start_date="2026-03-02",
            horizon_days=14,
        ),
    )


def single_parent_onboarding() -> OnboardingInput:
    """
    Scenario 5: Single-parent onboarding (Parent B not yet registered).
    Parent A locked on Wednesday (JS 3).
    """
    return OnboardingInput(
        number_of_children=2,
        children_age_bands=["5-10", "0-4"],
        school_schedule=SchoolSchedule(
            school_days=[1, 2, 3, 4, 5],
        ),
        daycare_schedule=DaycareSchedule(
            daycare_days=[1, 2, 3, 4, 5],
        ),
        preferred_exchange_location="school",
        parent_a=ParentProfile(
            parent_id="parent_a_solo",
            availability=ParentAvailability(locked_nights=[3]),  # Wednesday
            preferences=ParentPreferences(
                target_share_pct=55.0,
                max_handoffs_per_week=3,
                max_consecutive_nights_away=4,
            ),
            constraints=ParentConstraints(),
        ),
        parent_b=None,
        shared=SharedConstraints(
            start_date="2026-03-02",
            horizon_days=14,
        ),
    )
