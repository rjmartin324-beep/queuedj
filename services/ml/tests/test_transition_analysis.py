"""
Unit tests for the Vibe Guardrail scoring functions in transition_analysis.py.

These are pure functions (no DB, no Redis) so they're fast and fully deterministic.
Run with: pytest (from services/ml/)
"""

import pytest
from workers.transition_analysis import (
    camelot_score,
    bpm_score,
    energy_score,
    normalize_bpm,
    recommend_transition,
)


# ─── camelot_score ────────────────────────────────────────────────────────────

class TestCamelotScore:
    def test_exact_match_returns_1(self):
        assert camelot_score(5, "A", 5, "A") == 1.0

    def test_adjacent_same_mode_returns_0_8(self):
        assert camelot_score(5, "A", 6, "A") == 0.8
        assert camelot_score(6, "A", 5, "A") == 0.8  # symmetric

    def test_two_steps_same_mode_returns_0_4(self):
        assert camelot_score(5, "A", 7, "A") == 0.4

    def test_three_or_more_steps_same_mode_returns_0_1(self):
        assert camelot_score(1, "A", 6, "A") == 0.1

    def test_same_key_relative_major_minor_returns_0_7(self):
        assert camelot_score(5, "A", 5, "B") == 0.7
        assert camelot_score(5, "B", 5, "A") == 0.7

    def test_cross_mode_different_key_returns_0_1(self):
        assert camelot_score(1, "A", 7, "B") == 0.1

    def test_wheel_wraps_key_12_to_1_is_adjacent(self):
        # On the Camelot wheel, 12A and 1A are adjacent
        score = camelot_score(12, "A", 1, "A")
        assert score == 0.8

    def test_wheel_wraps_key_1_to_12_is_adjacent(self):
        score = camelot_score(1, "A", 12, "A")
        assert score == 0.8

    def test_score_is_symmetric(self):
        for key in range(1, 13):
            assert camelot_score(key, "A", key, "B") == camelot_score(key, "B", key, "A")


# ─── bpm_score ────────────────────────────────────────────────────────────────

class TestBpmScore:
    def test_identical_bpm_returns_1(self):
        assert bpm_score(128.0, 128.0) == 1.0

    def test_within_2_bpm_returns_1(self):
        assert bpm_score(128.0, 129.5) == 1.0
        assert bpm_score(128.0, 126.5) == 1.0

    def test_3_to_8_bpm_delta_returns_0_85(self):
        assert bpm_score(120.0, 126.0) == 0.85

    def test_9_to_15_bpm_delta_returns_0_6(self):
        assert bpm_score(120.0, 132.0) == 0.6

    def test_16_to_25_bpm_delta_returns_0_35(self):
        assert bpm_score(100.0, 122.0) == 0.35

    def test_26_to_40_bpm_delta_returns_0_15(self):
        assert bpm_score(90.0, 125.0) == 0.15

    def test_over_40_bpm_delta_returns_0(self):
        assert bpm_score(60.0, 180.0) == 0.0

    def test_half_time_scores_well(self):
        # 128 BPM ↔ 64 BPM: same groove at half speed — normalized delta is small
        assert bpm_score(128.0, 64.0) > 0.8

    def test_double_time_scores_well(self):
        assert bpm_score(64.0, 128.0) > 0.8

    def test_score_is_symmetric(self):
        assert bpm_score(120.0, 140.0) == bpm_score(140.0, 120.0)


# ─── energy_score ─────────────────────────────────────────────────────────────

class TestEnergyScore:
    def test_identical_energy_returns_1(self):
        assert energy_score(0.7, 0.7) == 1.0

    def test_delta_within_0_1_returns_1(self):
        assert energy_score(0.7, 0.75) == 1.0
        assert energy_score(0.5, 0.59) == 1.0

    def test_delta_within_0_2_returns_0_8(self):
        assert energy_score(0.5, 0.65) == 0.8

    def test_delta_within_0_35_returns_0_5(self):
        assert energy_score(0.3, 0.60) == 0.5

    def test_delta_within_0_5_returns_0_3(self):
        assert energy_score(0.1, 0.55) == 0.3

    def test_delta_over_0_5_returns_0_1(self):
        assert energy_score(0.1, 0.9) == 0.1

    def test_score_is_symmetric(self):
        assert energy_score(0.3, 0.7) == energy_score(0.7, 0.3)


# ─── normalize_bpm ────────────────────────────────────────────────────────────

class TestNormalizeBpm:
    def test_already_canonical_unchanged(self):
        assert normalize_bpm(110.0) == pytest.approx(110.0)
        assert normalize_bpm(60.0)  == pytest.approx(60.0)
        assert normalize_bpm(120.0) == pytest.approx(120.0)

    def test_high_bpm_halved_into_range(self):
        assert normalize_bpm(200.0) == pytest.approx(100.0)  # 200 / 2

    def test_very_high_bpm_halved_twice(self):
        assert normalize_bpm(240.0) == pytest.approx(120.0)  # 240 / 2 / 2? no: 240→120 (one halve)

    def test_low_bpm_doubled_into_range(self):
        assert normalize_bpm(55.0) == pytest.approx(110.0)  # 55 * 2

    def test_very_low_bpm_doubled_twice(self):
        assert normalize_bpm(30.0) == pytest.approx(120.0)  # 30 * 2 * 2

    def test_result_always_in_60_to_120(self):
        test_values = [40, 60, 80, 100, 120, 140, 160, 200, 240]
        for bpm in test_values:
            result = normalize_bpm(float(bpm))
            assert 60.0 <= result <= 120.0, f"normalize_bpm({bpm}) = {result} out of range"


# ─── recommend_transition ─────────────────────────────────────────────────────

class TestRecommendTransition:
    def test_tight_bpm_and_strong_key_match_gives_harmonic_blend(self):
        assert recommend_transition(1.0, 0.9, 0.05) == "harmonic_blend"

    def test_moderate_bpm_good_key_gives_crossfade(self):
        assert recommend_transition(8.0, 0.75, 0.1) == "crossfade"

    def test_large_energy_delta_gives_echo_out(self):
        assert recommend_transition(5.0, 0.5, 0.5) == "echo_out"

    def test_large_bpm_delta_gives_bridge(self):
        # > 20 BPM delta with poor key and non-extreme energy → bridge
        assert recommend_transition(25.0, 0.3, 0.2) == "bridge"
