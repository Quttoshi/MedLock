import uuid
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import lab_catalog as catalog
from app.services import lab_results_service as lrs
from app.services import report_metadata as meta


# ── Catalog ──────────────────────────────────────────────────────────────────────

class TestMatching:
    @pytest.mark.parametrize("name, code", [
        ("Haemoglobin (Hb)", "hemoglobin"), ("HB", "hemoglobin"), ("S. Creatinine", "creatinine"),
        ("SGPT", "alt"), ("ALT (SGPT)", "alt"), ("Total Leucocyte Count", "wbc"), ("TLC", "wbc"),
        ("Platelet Count", "platelets"), ("HbA1c", "hba1c"), ("Glucose Fasting", "glucose_fasting"),
        ("FBS", "glucose_fasting"), ("RBS", "glucose_random"), ("LDL Cholesterol Direct", "ldl"),
        ("High density lipoprotein", "hdl"), ("Low Density Lipoprotein", "ldl"), ("Vitamin D (25-OH)", "vitamin_d"),
        ("PCV", "hematocrit"), ("Serum Ferritin", "ferritin"), ("TSH", "tsh"),
        # Older OCR output glued the previous row's status onto the name
        ("normal\ncreatinine", "creatinine"), ("high\nplatelets", "platelets"),
    ])
    def test_known_names(self, name, code):
        assert catalog.match_test(name).code == code

    @pytest.mark.parametrize("name", ["Work Completed", "Presentation", "Code Quality", "march", "User", ""])
    def test_unrelated_text_is_not_a_test(self, name):
        assert catalog.match_test(name) is None


class TestUnits:
    def test_conversions(self):
        assert catalog.to_canonical(catalog.TESTS["glucose_fasting"], 5.5, "mmol/L")[0] == pytest.approx(99.1, 0.01)
        assert catalog.to_canonical(catalog.TESTS["creatinine"], 88.42, "µmol/L")[0] == pytest.approx(1.0)
        assert catalog.to_canonical(catalog.TESTS["platelets"], 2.5, "Lac/cumm")[0] == 250
        assert catalog.to_canonical(catalog.TESTS["wbc"], 7500, "/cumm")[0] == 7.5
        assert catalog.to_canonical(catalog.TESTS["wbc"], 7.5, "x10³/µL")[0] == 7.5
        assert catalog.to_canonical(catalog.TESTS["hba1c"], 53, "mmol/mol")[0] == pytest.approx(7.0, 0.01)

    def test_missing_and_unknown_units(self):
        assert catalog.to_canonical(catalog.TESTS["hemoglobin"], 12.0, "")[1] == "assumed"
        assert catalog.to_canonical(catalog.TESTS["hemoglobin"], 12.0, "furlongs")[0] is None

    def test_ranges_by_sex(self):
        hb = catalog.TESTS["hemoglobin"]
        assert catalog.reference_range(hb, "female") == (12.0, 15.5)
        assert catalog.reference_range(hb, "male") == (13.5, 17.5)
        # Sex unknown: the widest range, so nothing normal is flagged
        assert catalog.reference_range(hb, None) == (12.0, 17.5)


# ── One line ─────────────────────────────────────────────────────────────────────

def _item(test, value, unit="", **extra):
    return {"test": test, "value": value, "unit": unit, **extra}


class TestNormalize:
    def test_lab_printed_range_is_preferred_and_converted(self):
        r = lrs.normalize_item(_item("Glucose Fasting", 7.0, "mmol/L", normal_range="3.9 - 5.5",
                                     flag_source="report_reference_range"), "female", "pdfplumber")
        assert r["ref_source"] == "lab"
        assert r["ref_high"] == pytest.approx(99.1, 0.01)
        assert r["flag"] == "high" and r["confidence"] == "high"

    def test_standard_range_by_sex_when_none_printed(self):
        r = lrs.normalize_item(_item("Haemoglobin", 12.5, "g/dL"), "male", "pdfplumber")
        assert (r["ref_low"], r["flag"], r["ref_source"]) == (13.5, "low", "standard")

    def test_impossible_values_are_dropped(self):
        assert lrs.normalize_item(_item("Haemoglobin", 112, "g/dL"), "male", "pdfplumber") is None

    def test_critical_flags(self):
        assert lrs.normalize_item(_item("Potassium", 6.4, "mmol/L"), None, "pdfplumber")["flag"] == "critical_high"
        assert lrs.normalize_item(_item("Hb", 6.1, "g/dL"), None, "pdfplumber")["flag"] == "critical_low"

    def test_ocr_and_assumed_units_are_less_confident(self):
        assert lrs.normalize_item(_item("Hb", 12.5, "g/dL"), None, "tesseract")["confidence"] == "medium"
        r = lrs.normalize_item(_item("Hb", 12.5), None, "pdfplumber")
        assert r["confidence"] == "medium" and "unit_assumed" in r["review_reasons"]

    def test_counts_without_units_are_inferred_and_need_checking(self):
        r = lrs.normalize_item(_item("TLC", 8200), None, "pdfplumber")
        assert r["value"] == 8.2 and r["confidence"] == "low" and "unit_inferred" in r["review_reasons"]

    def test_parser_doubts_make_it_low_confidence(self):
        r = lrs.normalize_item(_item("Hb", 12.5, "g/dL", needs_review=True, review_reasons=["possible_decimal_misread"]),
                               None, "tesseract")
        assert r["confidence"] == "low"

    def test_digital_pdfs_cannot_misread_a_decimal(self):
        r = lrs.normalize_item(_item("Ferritin", 8, "ng/mL", needs_review=True, review_reasons=["possible_decimal_misread"]),
                               "female", "pdfplumber")
        assert r["confidence"] == "high" and r["review_reasons"] == []

    def test_ionised_calcium_on_blood_gas_reports(self):
        r = lrs.normalize_item(_item("Calcium", 1.21, "mmol/L"), None, "pdfplumber")
        assert r["test_code"] == "ionized_calcium" and r["flag"] == "normal"

    def test_unknown_tests_and_bad_values(self):
        assert lrs.normalize_item(_item("Work Completed", 9), None, "pdfplumber") is None
        assert lrs.normalize_item(_item("Hb", "n/a"), None, "pdfplumber") is None


# ── Report facts ─────────────────────────────────────────────────────────────────

HEADER = """CHUGHTAI LAB   Lab No 4521   MR No 99
Sample Collected: 12/03/2026 09:10    Reported on: 13-Mar-2026
HAEMATOLOGY   Test   Result   Units   Reference Range"""


class TestReportMetadata:
    def test_collection_date_is_preferred_over_report_date(self):
        assert meta.collection_date(HEADER) == date(2026, 3, 12)

    def test_other_formats_and_labels(self):
        assert meta.collection_date("Reported on: 05-Jan-2026") == date(2026, 1, 5)
        assert meta.collection_date("Date: 2025-11-30") == date(2025, 11, 30)
        assert meta.collection_date("Received: Oct 2, 2026") == date(2026, 10, 2)
        future = (date.today() + timedelta(days=30)).strftime("%d/%m/%Y")
        assert meta.collection_date(f"Collected: {future}") is None
        assert meta.collection_date("no dates here") is None

    def test_lab_names(self):
        assert meta.lab_name(HEADER) == "Chughtai Lab"
        assert meta.lab_name("EXCEL LABS Islamabad") == "Excel Labs"
        assert meta.lab_name("some clinic") is None

    def test_only_lab_reports_produce_results(self):
        assert meta.document_kind(HEADER, ["Hb", "TLC", "Platelet Count"]) == "lab_report"
        assert meta.document_kind("FYP rubric", ["Work Completed", "Presentation", "Code Quality"]) == "other"


# ── A whole report ───────────────────────────────────────────────────────────────

def _report(gender="female", uploaded=datetime(2026, 3, 14, 10, 0)):
    return SimpleNamespace(
        id=uuid.uuid4(), patient_id=uuid.uuid4(), patient=SimpleNamespace(gender=gender),
        medical_center=None, uploaded_at=uploaded, lab_results=[], document_kind=None, collected_on=None, lab_name=None,
    )


def _ocr(text, items, engine="pdfplumber"):
    return SimpleNamespace(extracted_text=text, structured_data=items, ocr_engine=engine)


class TestIngest:
    def test_lab_report_becomes_results(self):
        report, db = _report(), MagicMock()
        items = [_item("Haemoglobin", 10.9, "g/dL"), _item("TLC", 7.2, "x10^9/L"), _item("Platelet Count", 250, "x10^9/L"),
                 _item("Work Completed", 9)]
        created = lrs.ingest(report, _ocr(HEADER, items), db)
        assert {r.test_code for r in created} == {"hemoglobin", "wbc", "platelets"}
        assert all(r.collected_on == date(2026, 3, 12) for r in created)
        assert report.lab_name == "Chughtai Lab" and report.document_kind == "lab_report"
        hb = next(r for r in created if r.test_code == "hemoglobin")
        assert hb.flag == "low" and hb.status == "unconfirmed"

    def test_other_documents_produce_nothing(self):
        report = _report()
        created = lrs.ingest(report, _ocr("FYP rubric", [_item("Work Completed", 9), _item("Presentation", 8)]), MagicMock())
        assert created == [] and report.document_kind == "other"

    def test_upload_date_when_report_has_no_date(self):
        report = _report()
        created = lrs.ingest(report, _ocr("Haematology result units reference", [_item("Hb", 13.1, "g/dL"),
                                                                               _item("MCV", 85, "fL"), _item("RDW", 13, "%")]),
                             MagicMock())
        assert created[0].collected_on == date(2026, 3, 14)

    def test_one_result_per_test_keeping_the_most_confident(self):
        report = _report()
        items = [_item("Hb", 9.9, "g/dL", needs_review=True), _item("Haemoglobin", 10.9, "g/dL"), _item("MCV", 74, "fL"),
                 _item("RDW", 16, "%")]
        created = lrs.ingest(report, _ocr(HEADER, items), MagicMock())
        hb = [r for r in created if r.test_code == "hemoglobin"]
        assert len(hb) == 1 and hb[0].value == 10.9


class TestConfirm:
    def _result(self):
        return SimpleNamespace(test_code="hemoglobin", value=1.09, flag="critical_low", ref_low=12.0, ref_high=15.5,
                               status="unconfirmed", confirmed_by_user_id=None, confirmed_at=None)

    def test_correction_is_reflagged_and_marked(self):
        r = self._result()
        lrs.confirm(r, uuid.uuid4(), MagicMock(), corrected_value=10.9)
        assert (r.value, r.flag, r.status) == (10.9, "low", "corrected")
        assert lrs.is_trusted(r)

    def test_confirming_as_read(self):
        r = self._result()
        r.value, r.flag = 13.0, "normal"
        lrs.confirm(r, uuid.uuid4(), MagicMock())
        assert r.status == "confirmed"

    def test_impossible_corrections_are_refused(self):
        with pytest.raises(HTTPException) as exc:
            lrs.confirm(self._result(), uuid.uuid4(), MagicMock(), corrected_value=109)
        assert exc.value.status_code == 400
