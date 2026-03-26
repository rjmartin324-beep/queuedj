"""
Unit tests for taste_graph._weighted_avg and _weighted_variance.

These are the math helpers that underpin every style profile — a bug here
silently shifts every recommendation toward wrong BPM/genre targets.
Run with: pytest (from services/ml/)
"""

import pytest
from workers.taste_graph import _weighted_avg, _weighted_variance


# ─── _weighted_avg ────────────────────────────────────────────────────────────

class TestWeightedAvg:
    def test_equal_weights_returns_simple_mean(self):
        assert _weighted_avg([100.0, 120.0], [1.0, 1.0]) == pytest.approx(110.0)

    def test_skewed_weights_pull_toward_heavy_value(self):
        # Weight of 0.9 on 200 should dominate
        result = _weighted_avg([100.0, 200.0], [0.1, 0.9])
        assert result == pytest.approx(190.0)

    def test_single_value_returns_that_value(self):
        assert _weighted_avg([128.0], [1.0]) == pytest.approx(128.0)

    def test_empty_returns_zero(self):
        assert _weighted_avg([], []) == 0.0

    def test_zero_total_weight_falls_back_to_simple_mean(self):
        # Degenerate: all weights are 0 → simple mean
        result = _weighted_avg([100.0, 200.0], [0.0, 0.0])
        assert result == pytest.approx(150.0)

    def test_high_weight_on_first_value(self):
        result = _weighted_avg([80.0, 160.0], [0.95, 0.05])
        assert result == pytest.approx(84.0)

    def test_three_values(self):
        # Manually: (60*1 + 90*2 + 120*3) / (1+2+3) = (60+180+360)/6 = 100
        result = _weighted_avg([60.0, 90.0, 120.0], [1.0, 2.0, 3.0])
        assert result == pytest.approx(100.0)


# ─── _weighted_variance ───────────────────────────────────────────────────────

class TestWeightedVariance:
    def test_single_value_has_zero_variance(self):
        assert _weighted_variance([120.0], [1.0], 120.0) == 0.0

    def test_fewer_than_two_values_returns_zero(self):
        assert _weighted_variance([], [], 0.0) == 0.0

    def test_symmetric_values_equal_weights(self):
        # variance = ((90-100)^2 * 1 + (110-100)^2 * 1) / (1+1) = (100+100)/2 = 100
        result = _weighted_variance([90.0, 110.0], [1.0, 1.0], 100.0)
        assert result == pytest.approx(100.0)

    def test_identical_values_have_zero_variance(self):
        result = _weighted_variance([128.0, 128.0], [0.5, 0.5], 128.0)
        assert result == pytest.approx(0.0)

    def test_zero_total_weight_returns_zero(self):
        result = _weighted_variance([100.0, 120.0], [0.0, 0.0], 110.0)
        assert result == 0.0

    def test_high_weight_on_outlier_raises_variance(self):
        # Mean = 100, outlier at 200 with weight 0.9 → variance should be large
        mean = _weighted_avg([100.0, 200.0], [0.1, 0.9])  # 190
        result = _weighted_variance([100.0, 200.0], [0.1, 0.9], mean)
        assert result > 0.0

    def test_variance_is_non_negative(self):
        import random
        random.seed(42)
        values  = [random.uniform(60, 160) for _ in range(20)]
        weights = [random.random() for _ in range(20)]
        mean    = _weighted_avg(values, weights)
        assert _weighted_variance(values, weights, mean) >= 0.0
