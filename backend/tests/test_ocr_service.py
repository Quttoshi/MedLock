import pytest
from app.services.ocr_service import _determine_status, _detect_abnormal, NORMAL_RANGES


class TestNormalRanges:
    def test_contains_classic_markers(self):
        expected = {"hemoglobin", "glucose", "cholesterol", "creatinine", "urea", "wbc", "rbc", "platelets", "sodium", "potassium"}
        for marker in expected:
            assert marker in NORMAL_RANGES, f"Missing marker: {marker}"

    def test_contains_tsh(self):
        assert "tsh" in NORMAL_RANGES

    def test_contains_iron(self):
        assert "iron" in NORMAL_RANGES

    def test_all_ranges_are_tuples_of_two_numbers(self):
        for name, rng in NORMAL_RANGES.items():
            assert isinstance(rng, (tuple, list)), f"{name} range is not tuple/list"
            assert len(rng) == 2, f"{name} range does not have 2 elements"
            low, high = rng
            assert isinstance(low, (int, float)), f"{name} low bound is not numeric"
            assert isinstance(high, (int, float)), f"{name} high bound is not numeric"
            assert low < high, f"{name} low >= high"

    def test_tsh_range_values(self):
        low, high = NORMAL_RANGES["tsh"]
        assert low == pytest.approx(0.4)
        assert high == pytest.approx(4.0)

    def test_iron_range_values(self):
        low, high = NORMAL_RANGES["iron"]
        assert low == 60
        assert high == 170


class TestDetermineStatus:
    def test_glucose_high(self):
        _, high = NORMAL_RANGES["glucose"]
        assert _determine_status("glucose", high + 1, None) == "high"

    def test_glucose_low(self):
        low, _ = NORMAL_RANGES["glucose"]
        assert _determine_status("glucose", low - 1, None) == "low"

    def test_glucose_normal(self):
        low, high = NORMAL_RANGES["glucose"]
        mid = (low + high) / 2
        assert _determine_status("glucose", mid, None) == "normal"

    def test_hemoglobin_high(self):
        _, high = NORMAL_RANGES["hemoglobin"]
        assert _determine_status("hemoglobin", high + 1, None) == "high"

    def test_hemoglobin_low(self):
        low, _ = NORMAL_RANGES["hemoglobin"]
        assert _determine_status("hemoglobin", low - 0.1, None) == "low"

    def test_potassium_boundary_high(self):
        _, high = NORMAL_RANGES["potassium"]
        assert _determine_status("potassium", high + 0.1, None) == "high"

    def test_cholesterol_high(self):
        _, high = NORMAL_RANGES["cholesterol"]
        assert _determine_status("cholesterol", high + 5, None) == "high"

    def test_tsh_low(self):
        low, _ = NORMAL_RANGES["tsh"]
        assert _determine_status("tsh", low - 0.1, None) == "low"

    def test_tsh_high(self):
        _, high = NORMAL_RANGES["tsh"]
        assert _determine_status("tsh", high + 1, None) == "high"

    def test_tsh_normal(self):
        assert _determine_status("tsh", 2.0, None) == "normal"

    def test_iron_low(self):
        low, _ = NORMAL_RANGES["iron"]
        assert _determine_status("iron", low - 5, None) == "low"

    def test_iron_high(self):
        _, high = NORMAL_RANGES["iron"]
        assert _determine_status("iron", high + 5, None) == "high"

    def test_creatinine_boundary_normal(self):
        low, high = NORMAL_RANGES["creatinine"]
        assert _determine_status("creatinine", low, None) == "normal"
        assert _determine_status("creatinine", high, None) == "normal"

    def test_unknown_test_falls_back_to_pdf_status(self):
        result = _determine_status("unknown_marker", 999, "high")
        assert result == "high"

    def test_unknown_test_no_pdf_status_returns_normal(self):
        result = _determine_status("unknown_marker", 999, None)
        assert result == "normal"


class TestDetectAbnormal:
    def test_empty_list_returns_empty(self):
        assert _detect_abnormal([]) == []

    def test_all_normal_returns_empty(self):
        items = [
            {"test": "glucose", "value": 90, "status": "normal"},
            {"test": "hemoglobin", "value": 14, "status": "normal"},
        ]
        assert _detect_abnormal(items) == []

    def test_high_status_detected(self):
        items = [{"test": "glucose", "value": 250, "status": "high"}]
        result = _detect_abnormal(items)
        assert len(result) == 1
        assert result[0]["status"] == "high"

    def test_low_status_detected(self):
        items = [{"test": "hemoglobin", "value": 8, "status": "low"}]
        result = _detect_abnormal(items)
        assert len(result) == 1
        assert result[0]["status"] == "low"

    def test_mixed_returns_only_abnormal(self):
        items = [
            {"test": "glucose", "value": 90, "status": "normal"},
            {"test": "cholesterol", "value": 250, "status": "high"},
            {"test": "hemoglobin", "value": 8, "status": "low"},
        ]
        result = _detect_abnormal(items)
        assert len(result) == 2
        statuses = {r["status"] for r in result}
        assert statuses == {"high", "low"}

    def test_multiple_abnormals(self):
        items = [
            {"test": "tsh", "value": 10, "status": "high"},
            {"test": "iron", "value": 20, "status": "low"},
            {"test": "wbc", "value": 20, "status": "high"},
        ]
        assert len(_detect_abnormal(items)) == 3

    def test_item_without_status_excluded(self):
        items = [{"test": "glucose", "value": 999}]
        assert _detect_abnormal(items) == []

    def test_preserves_full_item_dict(self):
        item = {"test": "glucose", "value": 250, "status": "high", "unit": "mg/dL"}
        result = _detect_abnormal([item])
        assert result[0] == item
