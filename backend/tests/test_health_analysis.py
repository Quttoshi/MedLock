import uuid
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services import health_analysis_service as ha
from app.services import lab_catalog as catalog


class TestEgfr:
    @pytest.mark.parametrize("creatinine, age, sex, expected", [
        (1.0, 50, "male", 92),     # CKD-EPI 2021 reference calculation
        (0.7, 40, "female", 112),
        (2.0, 65, "male", 36),
        (1.5, 70, "female", 37),
    ])
    def test_ckd_epi_2021(self, creatinine, age, sex, expected):
        assert ha.egfr_ckd_epi_2021(creatinine, age, sex) == expected

    def test_age_on_a_date(self):
        assert ha.age_on(date(1985, 6, 15), date(2026, 6, 14)) == 40
        assert ha.age_on(date(1985, 6, 15), date(2026, 6, 15)) == 41
        assert ha.age_on(None, date(2026, 1, 1)) is None


class TestCategories:
    @pytest.mark.parametrize("value, label", [(5.4, "Normal"), (5.7, "Prediabetes"), (6.4, "Prediabetes"), (6.5, "Diabetes range")])
    def test_hba1c_bands(self, value, label):
        assert ha.band_for(catalog.TESTS["hba1c"], value).label == label

    @pytest.mark.parametrize("value, label", [(95, "G1 normal"), (75, "G2 mildly reduced"), (52, "G3a"), (35, "G3b"), (20, "G4"), (10, "G5 kidney failure")])
    def test_egfr_stages(self, value, label):
        assert ha.band_for(catalog.TESTS["egfr"], value).label == label

    def test_plain_words(self):
        hb = catalog.TESTS["hemoglobin"]
        assert ha.status_label(hb, 11.5, "low", 12.0, 15.5) == "Slightly low"
        assert ha.status_label(hb, 9.0, "low", 12.0, 15.5) == "Low"
        assert ha.status_label(hb, 6.0, "critical_low", 12.0, 15.5) == "Very low"
        assert ha.status_label(hb, 13.0, "normal", 12.0, 15.5) == "In range"
        assert ha.status_label(catalog.TESTS["hba1c"], 6.1, "high", 4.0, 5.6) == "Prediabetes"

    def test_significant_change(self):
        assert ha._significant(catalog.TESTS["hba1c"], 6.4, 7.0) is True
        assert ha._significant(catalog.TESTS["hba1c"], 6.4, 6.7) is False
        assert ha._significant(catalog.TESTS["alt"], 40, 52) is True    # 30% relative change


# ── Series built from results ────────────────────────────────────────────────────

def _r(code, value, on, flag="normal", confidence="high", status="unconfirmed", low=None, high=None):
    return SimpleNamespace(
        id=uuid.uuid4(), report_id=uuid.uuid4(), test_code=code, value=value, collected_on=on, flag=flag,
        ref_low=low, ref_high=high, ref_source="standard", status=status, confidence=confidence,
        report=SimpleNamespace(lab_name="Chughtai Lab"),
    )


@pytest.fixture
def patient(monkeypatch):
    p = SimpleNamespace(id=uuid.uuid4(), gender="female", date_of_birth=date(1985, 3, 2), blood_group="B+")
    results = [
        _r("hemoglobin", 12.8, date(2026, 1, 20)),
        _r("hemoglobin", 10.9, date(2026, 6, 15), flag="low", low=12.0, high=15.5),
        _r("mcv", 74, date(2026, 6, 15), flag="low", low=80, high=100),
        _r("hba1c", 6.4, date(2026, 1, 20), flag="high"),
        _r("hba1c", 7.2, date(2026, 6, 15), flag="high"),
        _r("creatinine", 0.9, date(2026, 1, 20)),
        _r("creatinine", 1.4, date(2026, 6, 15), flag="high", low=0.5, high=1.1),
        # Read by OCR, nobody has checked it: shown, but never drives the summary
        _r("potassium", 6.5, date(2026, 6, 15), flag="critical_high", confidence="low"),
    ]
    monkeypatch.setattr(ha, "_load", lambda patient, db, tests=None: [
        r for r in results if tests is None or r.test_code in tests])
    return p


class TestSeries:
    def test_egfr_is_calculated_for_each_creatinine(self, patient):
        series = ha.series_by_test(patient, MagicMock())
        assert [p["value"] for p in series["egfr"]] == [ha.egfr_ckd_epi_2021(0.9, 40, "female"),
                                                       ha.egfr_ckd_epi_2021(1.4, 41, "female")]
        assert series["egfr"][0]["derived_from"] == "creatinine"

    def test_no_egfr_without_age_or_sex(self, patient):
        patient.gender = "other"
        assert "egfr" not in ha.series_by_test(patient, MagicMock())

    def test_requested_tests_only(self, patient):
        assert set(ha.series_by_test(patient, MagicMock(), {"egfr"})) == {"egfr"}


class TestScreens:
    def test_trends_grouped_by_panel_with_changes(self, patient):
        data = ha.trends(patient, MagicMock())
        panels = {p["code"]: p for p in data["panels"]}
        assert {"blood_count", "diabetes", "kidney", "electrolytes"} <= set(panels)
        hb = next(t for t in panels["blood_count"]["tests"] if t["code"] == "hemoglobin")
        assert hb["change"]["direction"] == "down" and hb["change"]["significant"] is True
        assert hb["status_label"] == "Slightly low"
        assert data["anaemia_pattern"]["pattern"] == "microcytic"

    def test_summary_uses_only_trusted_values(self, patient):
        summary = ha.patient_summary(patient, MagicMock())
        names = [i["code"] for i in summary["needs_attention"]]
        assert "potassium" not in names                      # unconfirmed OCR value
        assert summary["critical"] == []
        assert len(summary["needs_attention"]) <= 3
        assert summary["unconfirmed_count"] == 1
        assert summary["all_in_range"] is False

    def test_doctor_overview_has_calculated_values(self, patient):
        overview = ha.doctor_overview(patient, MagicMock())
        codes = {c["code"] for c in overview["calculated"]}
        assert codes == {"egfr", "hba1c_category"}
        assert next(c for c in overview["calculated"] if c["code"] == "hba1c_category")["label"] == "Diabetes range"

    def test_cumulative_table_newest_first(self, patient):
        table = ha.cumulative_table(patient, MagicMock())
        assert table["dates"] == [date(2026, 6, 15), date(2026, 1, 20)]
        hb = next(r for r in table["rows"] if r["code"] == "hemoglobin")
        assert [c["value"] for c in hb["cells"]] == [10.9, 12.8]
        k = next(r for r in table["rows"] if r["code"] == "potassium")
        assert k["cells"][1] is None and k["cells"][0]["trusted"] is False
