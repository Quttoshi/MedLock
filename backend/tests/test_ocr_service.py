import cv2
import numpy as np
import pytest
from app.services.ocr_service import (
    _attach_ocr_confidence,
    _determine_status,
    _detect_abnormal,
    _estimate_skew,
    _group_rows,
    _has_text_layer,
    _is_flat,
    _order_corners,
    _parse_structured_from_text,
    _rotate_bound,
    NORMAL_RANGES,
)


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
    def test_known_values_without_report_evidence_are_unverified(self):
        assert _determine_status("glucose", 999, None) == "unverified"
        assert _determine_status("hemoglobin", 8, None) == "unverified"
        assert _determine_status("tsh", 2.0, None) == "unverified"

    def test_unknown_test_falls_back_to_pdf_status(self):
        result = _determine_status("unknown_marker", 999, "high")
        assert result == "high"

    def test_unknown_test_no_pdf_status_returns_normal(self):
        result = _determine_status("unknown_marker", 999, None)
        assert result == "unverified"

    def test_known_test_without_report_range_is_unverified(self):
        result = _determine_status("hemoglobin", 8, None)
        assert result == "unverified"

    def test_report_reference_range_determines_status(self):
        result = _determine_status("neutrophils", 66, None, (50, 70))
        assert result == "normal"


class TestDetectAbnormal:
    def test_empty_list_returns_empty(self):
        assert _detect_abnormal([]) == []

    def test_all_normal_returns_empty(self):
        items = [
            {"test": "glucose", "value": 90, "status": "normal", "flag_source": "report_reference_range"},
            {"test": "hemoglobin", "value": 14, "status": "normal", "flag_source": "report_reference_range"},
        ]
        assert _detect_abnormal(items) == []

    def test_high_status_detected(self):
        items = [{"test": "glucose", "value": 250, "status": "high", "flag_source": "report_reference_range"}]
        result = _detect_abnormal(items)
        assert len(result) == 1
        assert result[0]["status"] == "high"

    def test_low_status_detected(self):
        items = [{"test": "hemoglobin", "value": 8, "status": "low", "flag_source": "explicit_report_flag"}]
        result = _detect_abnormal(items)
        assert len(result) == 1
        assert result[0]["status"] == "low"

    def test_mixed_returns_only_abnormal(self):
        items = [
            {"test": "glucose", "value": 90, "status": "normal", "flag_source": "report_reference_range"},
            {"test": "cholesterol", "value": 250, "status": "high", "flag_source": "report_reference_range"},
            {"test": "hemoglobin", "value": 8, "status": "low", "flag_source": "explicit_report_flag"},
        ]
        result = _detect_abnormal(items)
        assert len(result) == 2
        statuses = {r["status"] for r in result}
        assert statuses == {"high", "low"}

    def test_multiple_abnormals(self):
        items = [
            {"test": "tsh", "value": 10, "status": "high", "flag_source": "report_reference_range"},
            {"test": "iron", "value": 20, "status": "low", "flag_source": "report_reference_range"},
            {"test": "wbc", "value": 20, "status": "high", "flag_source": "explicit_report_flag"},
        ]
        assert len(_detect_abnormal(items)) == 3

    def test_item_without_status_excluded(self):
        items = [{"test": "glucose", "value": 999}]
        assert _detect_abnormal(items) == []

    def test_preserves_full_item_dict(self):
        item = {"test": "glucose", "value": 250, "status": "high", "unit": "mg/dL", "flag_source": "report_reference_range"}
        result = _detect_abnormal([item])
        assert result[0] == item

    def test_borderline_status_detected(self):
        items = [{"test": "Platelet Count", "value": 150000, "status": "borderline", "flag_source": "explicit_report_flag"}]
        result = _detect_abnormal(items)
        assert len(result) == 1

    def test_high_without_source_is_not_reported_abnormal(self):
        items = [{"test": "glucose", "value": 250, "status": "high"}]
        assert _detect_abnormal(items) == []


class TestStructuredTextParser:
    def test_parses_cbc_pdf_text_lines(self):
        text = """
        Hemoglobin (Hb) 12.5 Low 13.0 - 17.0 g/dL
        Total RBC count 5.2 4.5 - 5.5 mill/cumm
        Packed Cell Volume (PCV) 57.5 High 40 - 50 %
        Mean Corpuscular Volume (MCV) 87.75 83 - 101 fL
        MCH 27.2 27 - 32 pg
        MCHC 32.8 32.5 - 34.5 g/dL
        RDW 13.6 11.6 - 14.0 %
        Total WBC count 9000 4000-11000 cumm
        Neutrophils 60 50 - 62 %
        Lymphocytes 31 20 - 40 %
        Platelet Count 150000 Borderline 150000 - 410000 cumm
        """

        result = _parse_structured_from_text(text)
        names = {item["test"] for item in result}

        assert "Hemoglobin" in names
        assert "RBC Count" in names
        assert "Hct" in names
        assert "Platelet Count" in names
        assert len(result) >= 10

    def test_parses_units_and_status(self):
        result = _parse_structured_from_text("Hemoglobin (Hb) 12.5 Low 13.0 - 17.0 g/dL")

        assert result[0]["value"] == pytest.approx(12.5)
        assert result[0]["unit"].lower() == "g/dl"
        assert result[0]["status"] == "low"
        assert result[0]["normal_range"]
        assert result[0]["flag_source"] == "explicit_report_flag"
        assert result[0]["report_flag"] == "L"
        assert "Hemoglobin" in result[0]["source_text"]
        assert "13.0 - 17.0" in result[0]["reference_text"]

    def test_biochemistry_rows_do_not_slide_into_reference_range(self):
        text = """
        Creatinine, Serum 0.83 mg/dL 0.66 - 1.25
        Urea L 18.0 mg/dL 19.3 - 43.0
        Blood Urea Nitrogen L 8.41 mg/dL 9.0 - 20.0
        Uric Acid 4.90 mg/dL 3.5 - 8.5
        SGPT 48.0 U/L 0 - 50
        """

        result = _parse_structured_from_text(text)
        by_name = {item["test"]: item for item in result}

        assert by_name["Creatinine, Serum"]["value"] == pytest.approx(0.83)
        assert by_name["Creatinine, Serum"]["status"] == "normal"
        assert by_name["Creatinine, Serum"]["normal_range"] == "0.66 - 1.25"
        assert by_name["Urea"]["value"] == pytest.approx(18.0)
        assert by_name["Urea"]["status"] == "low"
        assert by_name["Urea"]["report_flag"] == "L"
        assert by_name["Blood Urea Nitrogen"]["value"] == pytest.approx(8.41)
        assert by_name["Blood Urea Nitrogen"]["status"] == "low"
        assert by_name["Blood Urea Nitrogen"]["report_flag"] == "L"
        assert by_name["Uric Acid"]["status"] == "normal"
        assert by_name["SGPT"]["unit"] == "U/L"

    def test_protein_and_bilirubin_rows_parse_from_report_ranges(self):
        text = """
        Total Protein 7.00 g/dL 6.3 - 8.2
        Albumin 4.20 g/dL 3.5 - 5.0
        Globulin 2.80 g/dL 2.3 - 3.5
        A/G Ratio 1.50 1.3 - 1.7
        Total Bilirubin 0.70 mg/dL 0.2 - 1.3
        Conjugated Bilirubin 0.30 mg/dL 0.0 - 0.3
        Unconjugated Bilirubin 0.20 mg/dL 0.0 - 1.1
        Delta Bilirubin 0.20 mg/dL 0.0 - 0.2
        """

        result = _parse_structured_from_text(text)
        by_name = {item["test"]: item for item in result}

        assert by_name["Total Protein"]["value"] == pytest.approx(7.0)
        assert by_name["Total Protein"]["status"] == "normal"
        assert by_name["A/G Ratio"]["normal_range"] == "1.3 - 1.7"
        assert by_name["Total Bilirubin"]["unit"] == "mg/dL"
        assert by_name["Delta Bilirubin"]["flag_source"] == "report_reference_range"
        assert by_name["Delta Bilirubin"]["source_text"] == "Delta Bilirubin 0.20 mg/dL 0.0 - 0.2"


def _word(text, left, top, conf=90.0, height=20, line_key=(1, 1, 1)):
    return {"text": text, "conf": conf, "left": left, "top": top, "height": height, "line_key": line_key}


class TestReviewFlags:
    def test_dropped_decimal_point_needs_review(self):
        # "4.1" misread as "41" against the report's own 3.5 - 5.2 range
        result = _parse_structured_from_text("Albumin 41 g/dL 3.5 - 5.2")
        assert result[0]["needs_review"] is True
        assert "possible_decimal_misread" in result[0]["review_reasons"]

    def test_genuine_extreme_value_is_not_flagged_as_misread(self):
        result = _parse_structured_from_text("Glucose 600 mg/dL 70 - 100")
        assert result[0]["status"] == "high"
        assert "needs_review" not in result[0]

    def test_zero_based_and_one_sided_ranges_are_not_flagged_as_misread(self):
        crp = _parse_structured_from_text("Direct LDL 30 mg/dL 0 - 5")
        cholesterol = _parse_structured_from_text("Cholesterol 250 mg/dL <= 200")
        assert "needs_review" not in crp[0]
        assert "needs_review" not in cholesterol[0]

    def test_plausible_abnormal_value_is_not_flagged(self):
        result = _parse_structured_from_text("Creatinine 1.9 mg/dL 0.6 - 1.2")
        assert result[0]["status"] == "high"
        assert "needs_review" not in result[0]

    def test_low_ocr_confidence_needs_review(self):
        items = [{"test": "Potassium", "value": 3.0, "source_text": "Potassium 3.0 mmol/L"}]
        _attach_ocr_confidence(items, {"Potassium 3.0 mmol/L": 32.0})
        assert items[0]["ocr_confidence"] == 32.0
        assert items[0]["review_reasons"] == ["low_ocr_confidence"]

    def test_high_ocr_confidence_is_not_flagged(self):
        items = [{"test": "Urea", "value": 35.0, "source_text": "Urea 35 mg/dL"}]
        _attach_ocr_confidence(items, {"Urea 35 mg/dL": 94.0})
        assert items[0]["ocr_confidence"] == 94.0
        assert "needs_review" not in items[0]


class TestTextLayer:
    def test_digital_pdf_text_layer_is_detected(self):
        assert _has_text_layer("Hemoglobin 13.5 g/dL 12.0 - 17.5\n" * 10, page_count=1)

    def test_scanned_pdf_has_no_text_layer(self):
        assert not _has_text_layer("", page_count=2)
        assert not _has_text_layer("  \n ", page_count=1)


class TestRowGrouping:
    def test_columns_split_by_tesseract_are_rejoined_into_one_row(self):
        words = [
            _word("Hemoglobin", 100, 200, line_key=(1, 1, 1)),
            _word("10.8", 700, 203, line_key=(2, 1, 1)),
            _word("g/dL", 980, 199, line_key=(3, 1, 1)),
            _word("Urea", 100, 310, line_key=(1, 1, 2)),
            _word("35", 700, 312, line_key=(2, 1, 2)),
        ]
        rows = _group_rows(words)
        assert [[w["text"] for w in row] for row in rows] == [["Hemoglobin", "10.8", "g/dL"], ["Urea", "35"]]

    def test_words_in_a_row_are_ordered_left_to_right(self):
        rows = _group_rows([_word("mg/dL", 900, 100), _word("Urea", 100, 100), _word("35", 600, 101)])
        assert [w["text"] for w in rows[0]] == ["Urea", "35", "mg/dL"]


class TestGeometry:
    def test_corners_are_ordered_clockwise_from_top_left(self):
        shuffled = np.float32([[900, 1200], [50, 40], [80, 1150], [950, 60]])
        ordered = _order_corners(shuffled)
        assert ordered.tolist() == [[50, 40], [950, 60], [900, 1200], [80, 1150]]

    def test_upright_page_is_flat(self):
        quad = np.float32([[0, 0], [999, 0], [999, 1399], [0, 1399]])
        assert _is_flat(quad, 1000, 1400)

    def test_perspective_page_is_not_flat(self):
        quad = np.float32([[150, 100], [900, 180], [820, 1300], [60, 1220]])
        assert not _is_flat(quad, 1000, 1400)

    def test_skew_angle_is_recovered(self):
        page = np.full((1400, 1000), 255, np.uint8)
        for y in range(150, 1300, 60):
            cv2.rectangle(page, (100, y), (900, y + 18), 0, -1)
        tilted = _rotate_bound(page, 4.0)
        # Deskewing rotates back by the estimated angle, so it should be about -4 degrees.
        assert _estimate_skew(tilted) == pytest.approx(-4.0, abs=0.3)

    def test_blank_page_is_not_rotated(self):
        assert _estimate_skew(np.full((1400, 1000), 255, np.uint8)) == 0.0

    def test_page_with_a_single_word_is_not_rotated(self):
        page = np.full((1400, 1000), 255, np.uint8)
        cv2.rectangle(page, (200, 200), (320, 230), 0, -1)
        assert _estimate_skew(page) == 0.0
