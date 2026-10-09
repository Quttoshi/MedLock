import json
from datetime import date

import pytest

from app.services import extraction_evaluation as ev
from app.services import ocr_service as ocr
from app.services import sample_reports as samples
from app.services.lab_results_service import normalize_item

TODAY = date(2026, 10, 9)


def _read(line: str, sex=None):
    item = ocr._parse_result_line(ocr._normalize_ocr_line(line))
    return item and normalize_item(item, sex, "pdfplumber")


class TestParserReadsCatalogTests:
    @pytest.mark.parametrize("line, code, value", [
        ("HbA1c 6.4 % 4.0 - 5.6", "hba1c", 6.4),
        ("TLC 7.2 x10^9/L 4.0 - 11.0", "wbc", 7.2),
        ("Total Leucocyte Count 7200 /cumm 4000 - 11000", "wbc", 7.2),
        ("Platelets 2.5 Lac/cumm 1.5 - 4.0", "platelets", 250),
        ("Glucose Fasting 112 mg/dL 70 - 99", "glucose_fasting", 112),
        ("Fasting Blood Sugar 6.2 mmol/L 3.9 - 5.5", "glucose_fasting", 111.7),
        ("Alkaline Phosphatase 98 U/L 44 - 147", "alp", 98),        # contains "ph", must not become pH
        ("ALT (SGPT) 34 U/L 7 - 56", "alt", 34),
        ("Vitamin D (25-OH) 14.2 ng/mL 30 - 100", "vitamin_d", 14.2),
        ("TSH 2.1 mIU/L 0.4 - 4.0", "tsh", 2.1),                     # mIU/L, not U/L
        ("Serum Creatinine 0.92 mg/dL 0.5 - 1.1", "creatinine", 0.92),
        ("Creatinine 76 µmol/L 45 - 90", "creatinine", 0.86),
        ("WBC 7.2 x10³/µL 4.0 - 11.0", "wbc", 7.2),
        ("RDW-CV 16.2 % 11.5 - 14.5", "rdw", 16.2),
    ])
    def test_line(self, line, code, value):
        result = _read(line, "female")
        assert result["test_code"] == code
        assert result["value"] == pytest.approx(value, abs=0.01)
        assert result["confidence"] == "high"

    def test_converted_lab_ranges_are_rounded(self):
        result = _read("Fasting Blood Sugar 6.2 mmol/L 3.9 - 5.5")
        assert (result["ref_low"], result["ref_high"]) == (70.26, 99.09)


class TestSampleReports:
    def test_a_year_from_three_labs(self):
        reports = samples.year_of_results("female", TODAY)
        assert len(reports) >= 10
        assert {r.lab for r in reports} == {"chughtai", "excel", "idc"}
        dates = [r.collected_on for r in reports]
        assert dates == sorted(dates) and dates[-1] <= TODAY and (TODAY - dates[0]).days >= 360
        assert all(r.filename.startswith(samples.SAMPLE_PREFIX) for r in reports)

    def test_printed_units_differ_by_lab_but_answers_do_not(self):
        reports = samples.year_of_results("female", TODAY)
        excel = next(r for r in reports if r.lab == "excel" and any(row.code == "platelets" for row in r.rows))
        platelets = next(row for row in excel.rows if row.code == "platelets")
        assert platelets.unit == "Lac/cumm" and platelets.expected == 295

    def test_men_have_higher_haemoglobin(self):
        hb = lambda sex: samples.year_of_results(sex, TODAY)[0].expected_results()["hemoglobin"]
        assert hb("male") == hb("female") + 1.5


class TestEvaluation:
    def test_every_synthetic_report_is_read_correctly(self):
        outcomes = [ev.evaluate_case(c) for c in ev.synthetic_cases(TODAY)]
        summary = ev.summarize(outcomes)
        assert summary["recall"] == 1.0 and summary["precision"] == 1.0
        assert summary["wrong_but_trusted"] == 0
        for name in ("document_kind", "collected_on", "lab_name"):
            assert summary[name]["rate"] == 1.0

    def test_wrong_answers_are_reported(self):
        case = ev.synthetic_cases(TODAY)[0]
        case.results["hemoglobin"] += 1      # the answer file disagrees with the report
        case.results["ferritin"] = 20        # a test the report does not have
        del case.results["mcv"]              # a value read but not in the answers
        outcome = ev.evaluate_case(case)
        assert [w["test"] for w in outcome["wrong"]] == ["hemoglobin"]
        assert outcome["missed"] == ["ferritin"]
        assert [x["test"] for x in outcome["extra"]] == ["mcv"]
        assert len(outcome["wrong_but_trusted"]) == 2   # read from a digital PDF, so high confidence

    def test_gold_folder(self, tmp_path):
        report = samples.year_of_results("female", TODAY)[0]
        (tmp_path / "cbc.pdf").write_bytes(samples.render_pdf(report, "A Patient", 41, "female"))
        (tmp_path / "cbc.json").write_text(json.dumps({
            "sex": "female", "collected_on": report.collected_on.isoformat(), "lab_name": "Chughtai Lab",
            "results": report.expected_results(),
        }))
        (tmp_path / "unanswered.pdf").write_bytes(b"%PDF-1.4")
        cases = ev.load_cases(tmp_path)
        assert [c.name for c in cases] == ["cbc.pdf"]
        assert ev.summarize([ev.evaluate_case(cases[0])])["recall"] == 1.0


class TestRereading:
    def test_existing_output_is_updated_in_place(self, monkeypatch):
        from types import SimpleNamespace
        from unittest.mock import MagicMock
        from app.models.ocr_result import OcrResult
        from app.services import lab_results_service

        monkeypatch.setattr(ocr, "extract", lambda b, name: ("text", [{"test": "Hb", "value": 11.0}], "pdfplumber", "completed", None))
        monkeypatch.setattr(lab_results_service, "ingest_safely", lambda report, result, db: None)
        existing = OcrResult(parser_version="medical-ocr-v1", structured_count=0)
        report = SimpleNamespace(id="r1", original_filename="cbc.pdf")
        result = ocr.run_ocr(report, b"%PDF", MagicMock(), existing=existing)
        assert result is existing
        assert (existing.parser_version, existing.structured_count) == (ocr.PARSER_VERSION, 1)
