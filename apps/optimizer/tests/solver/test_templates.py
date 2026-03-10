"""Tests for the custody pattern template library."""

import pytest

from app.solver.templates import (
    TEMPLATES,
    TemplateDefinition,
    get_template,
    get_eligible_templates,
)


ALL_TEMPLATE_IDS = [
    "223", "223_daytime", "3443", "43", "2255",
    "7on7off", "7on7off_midweek",
    "52_weekday_weekend", "alt_weekends_midweek", "primary_plus_midweek",
    "every_other_weekend", "primary_weekends", "2week_blocks",
]


class TestTemplateDefinitions:
    """All 13 templates present with valid data."""

    def test_all_13_templates_present(self):
        assert len(TEMPLATES) == 13

    def test_all_expected_ids_present(self):
        for tid in ALL_TEMPLATE_IDS:
            assert tid in TEMPLATES, f"Missing template: {tid}"

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_pattern14_values_are_0_or_1(self, tid):
        t = TEMPLATES[tid]
        for val in t.pattern14:
            assert val in (0, 1), f"Template {tid} has invalid value {val} in pattern14"

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_cycle_length_matches_pattern(self, tid):
        t = TEMPLATES[tid]
        assert len(t.pattern14) == t.cycle_length, (
            f"Template {tid}: len(pattern14)={len(t.pattern14)} != cycle_length={t.cycle_length}"
        )

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_nights_sum_equals_cycle(self, tid):
        t = TEMPLATES[tid]
        assert t.nights_a + t.nights_b == t.cycle_length, (
            f"Template {tid}: nights_a({t.nights_a}) + nights_b({t.nights_b}) != cycle_length({t.cycle_length})"
        )

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_nights_match_pattern(self, tid):
        t = TEMPLATES[tid]
        actual_a = sum(1 for v in t.pattern14 if v == 0)
        actual_b = sum(1 for v in t.pattern14 if v == 1)
        assert actual_a == t.nights_a, f"Template {tid}: counted {actual_a} A nights, expected {t.nights_a}"
        assert actual_b == t.nights_b, f"Template {tid}: counted {actual_b} B nights, expected {t.nights_b}"

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_id_matches_key(self, tid):
        t = TEMPLATES[tid]
        assert t.id == tid

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_is_frozen_dataclass(self, tid):
        t = TEMPLATES[tid]
        assert isinstance(t, TemplateDefinition)
        with pytest.raises(AttributeError):
            t.id = "hacked"

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_handoffs_nonnegative(self, tid):
        t = TEMPLATES[tid]
        assert t.handoffs_per_2weeks >= 0

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_min_age_nonnegative(self, tid):
        t = TEMPLATES[tid]
        assert t.min_age_months >= 0

    @pytest.mark.parametrize("tid", ALL_TEMPLATE_IDS)
    def test_split_ratio_valid(self, tid):
        t = TEMPLATES[tid]
        assert t.split_ratio in ("50/50", "57/43", "71/29", "86/14", "daytime")


class TestGetTemplate:
    """get_template lookup."""

    def test_returns_correct_template(self):
        t = get_template("223")
        assert t is not None
        assert t.id == "223"
        assert t.name == "2-2-3 Rotation"

    def test_returns_none_for_unknown(self):
        assert get_template("nonexistent") is None

    def test_returns_none_for_empty(self):
        assert get_template("") is None


class TestGetEligibleTemplates:
    """get_eligible_templates filtering by age and arrangement."""

    def test_age_0_returns_only_daytime(self):
        eligible = get_eligible_templates(0, "undecided")
        # Only 223_daytime has min_age_months=0
        ids = [t.id for t in eligible]
        assert "223_daytime" in ids
        # Templates with min_age > 0 should not be present
        assert "223" not in ids  # min_age=18
        assert "7on7off" not in ids  # min_age=72

    def test_age_18_includes_223(self):
        eligible = get_eligible_templates(18, "undecided")
        ids = [t.id for t in eligible]
        assert "223" in ids
        assert "223_daytime" in ids

    def test_age_36_includes_several(self):
        eligible = get_eligible_templates(36, "undecided")
        ids = [t.id for t in eligible]
        for expected in ["223", "3443", "43", "every_other_weekend"]:
            assert expected in ids

    def test_shared_arrangement_filters_correctly(self):
        eligible = get_eligible_templates(200, "shared")
        for t in eligible:
            assert t.split_ratio in ("50/50", "57/43"), (
                f"Template {t.id} has ratio {t.split_ratio} but should be shared"
            )

    def test_primary_visits_arrangement(self):
        eligible = get_eligible_templates(200, "primary_visits")
        for t in eligible:
            assert t.split_ratio in ("71/29", "86/14"), (
                f"Template {t.id} has ratio {t.split_ratio} but should be primary"
            )

    def test_undecided_returns_all_age_eligible(self):
        eligible = get_eligible_templates(200, "undecided")
        assert len(eligible) == 13  # All 13 templates, all have min_age <= 200

    def test_sorted_by_handoffs_ascending(self):
        eligible = get_eligible_templates(200, "undecided")
        handoffs = [t.handoffs_per_2weeks for t in eligible]
        assert handoffs == sorted(handoffs)

    def test_daytime_excluded_from_shared(self):
        eligible = get_eligible_templates(200, "shared")
        ids = [t.id for t in eligible]
        assert "223_daytime" not in ids

    def test_daytime_excluded_from_primary(self):
        eligible = get_eligible_templates(200, "primary_visits")
        ids = [t.id for t in eligible]
        assert "223_daytime" not in ids


class TestSpecificPatterns:
    """Verify key user-requested patterns."""

    def test_223_pattern(self):
        t = get_template("223")
        assert t.pattern14 == (0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1)

    def test_3443_pattern(self):
        t = get_template("3443")
        assert t.pattern14 == (0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1)

    def test_7on7off_pattern(self):
        t = get_template("7on7off")
        assert t.pattern14 == (0,) * 7 + (1,) * 7

    def test_2255_pattern(self):
        t = get_template("2255")
        assert t.pattern14 == (0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1)

    def test_every_other_weekend_pattern(self):
        t = get_template("every_other_weekend")
        assert t.pattern14 == (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0)

    def test_2week_blocks_pattern(self):
        t = get_template("2week_blocks")
        assert t.pattern14 == (0,) * 14 + (1,) * 14
        assert t.cycle_length == 28
