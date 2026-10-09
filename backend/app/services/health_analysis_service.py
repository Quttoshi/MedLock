"""Turning a patient's lab results into what the screens show: trends per test, panels by
body system, a patient summary, a doctor's overview and cumulative table.

All analysis here is rule-based and explainable: eGFR uses the race-free CKD-EPI 2021
equation, categories use published guideline thresholds (ADA for HbA1c, KDIGO stages for
eGFR, NCEP bands for lipids), and a change is only pointed out when it is larger than a
per-test threshold. Values a person has not checked and that were not read exactly from a
PDF's text are shown but marked, and never drive the summary or critical alerts. Only
results from reports in the patient's record (approved uploads) are used.
"""
from collections import defaultdict
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models.lab_result import LabResult
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.services import lab_catalog as catalog
from app.services.lab_results_service import is_trusted

MAX_TABLE_DATES = 12


# ── Calculations ─────────────────────────────────────────────────────────────────

def age_on(born: Optional[date], on: date) -> Optional[int]:
    if not born:
        return None
    return on.year - born.year - ((on.month, on.day) < (born.month, born.day))


def egfr_ckd_epi_2021(creatinine_mg_dl: float, age: int, sex: str) -> float:
    """Race-free CKD-EPI 2021 creatinine equation (mL/min/1.73 m²)."""
    female = sex == "female"
    kappa, alpha = (0.7, -0.241) if female else (0.9, -0.302)
    ratio = creatinine_mg_dl / kappa
    egfr = 142 * min(ratio, 1) ** alpha * max(ratio, 1) ** -1.200 * 0.9938 ** age
    return round(egfr * (1.012 if female else 1.0), 0)


def band_for(test: catalog.LabTest, value: float) -> Optional[catalog.Band]:
    for band in test.bands:
        if (band.low is None or value >= band.low) and (band.high is None or value < band.high):
            return band
    return None


def _significant(test: catalog.LabTest, previous: float, latest: float) -> bool:
    kind, amount = test.change
    if kind == "abs":
        return abs(latest - previous) >= amount
    return previous != 0 and abs(latest - previous) / abs(previous) >= amount


def status_label(test: catalog.LabTest, value: float, flag: str, low, high) -> str:
    """Plain words for a result; a guideline band's name when the test has bands."""
    band = band_for(test, value)
    if band and test.code in ("hba1c", "glucose_fasting", "egfr", "ldl", "cholesterol_total", "triglycerides", "vitamin_d"):
        return band.label
    if flag.startswith("critical"):
        return "Very low" if flag == "critical_low" else "Very high"
    if flag == "low" and low:
        return "Slightly low" if value >= low * 0.9 else "Low"
    if flag == "high" and high:
        return "Slightly high" if value <= high * 1.1 else "High"
    return "In range"


# ── Loading ──────────────────────────────────────────────────────────────────────

def _load(patient: Patient, db: Session, tests: Optional[set] = None) -> list[LabResult]:
    q = db.query(LabResult).join(MedicalReport, LabResult.report_id == MedicalReport.id).filter(
        LabResult.patient_id == patient.id, MedicalReport.is_approved.is_(True),
    )
    if tests:
        q = q.filter(LabResult.test_code.in_(tests))
    return q.order_by(LabResult.collected_on, LabResult.created_at).all()


def _point(r: LabResult) -> dict:
    return {
        "id": str(r.id),
        "report_id": str(r.report_id),
        "date": r.collected_on,
        "value": r.value,
        "flag": r.flag,
        "ref_low": r.ref_low,
        "ref_high": r.ref_high,
        "ref_source": r.ref_source,
        "lab_name": r.report.lab_name if r.report else None,
        "status": r.status,
        "confidence": r.confidence,
        "trusted": is_trusted(r),
    }


def _egfr_points(creatinine: list[LabResult], patient: Patient) -> list[dict]:
    """eGFR for each creatinine result, when the patient's age and sex are known."""
    if patient.gender not in ("male", "female") or not patient.date_of_birth:
        return []
    test = catalog.TESTS["egfr"]
    points = []
    for r in creatinine:
        age = age_on(patient.date_of_birth, r.collected_on)
        if age is None or age < 18:
            continue
        value = egfr_ckd_epi_2021(r.value, age, patient.gender)
        low, high = catalog.reference_range(test, patient.gender)
        points.append({
            **_point(r),
            "id": f"egfr-{r.id}",
            "value": value,
            "flag": "low" if value < low else "normal",
            "ref_low": low,
            "ref_high": high,
            "ref_source": "standard",
            "derived_from": "creatinine",
        })
    return points


def series_by_test(patient: Patient, db: Session, tests: Optional[set] = None) -> dict[str, list[dict]]:
    """Each test's points in date order, including eGFR calculated from creatinine."""
    wanted = set(tests) if tests else None
    load = (wanted | {"creatinine"}) - {"egfr"} if wanted else None
    grouped: dict[str, list[LabResult]] = defaultdict(list)
    for r in _load(patient, db, load):
        grouped[r.test_code].append(r)
    series = {code: [_point(r) for r in rows] for code, rows in grouped.items()}
    if wanted is None or "egfr" in wanted:
        egfr = _egfr_points(grouped.get("creatinine", []), patient)
        if egfr:
            series["egfr"] = egfr
    if wanted is not None:
        series = {code: pts for code, pts in series.items() if code in wanted}
    return series


# ── Shapes for the screens ───────────────────────────────────────────────────────

def test_meta(test: catalog.LabTest, sex: Optional[str]) -> dict:
    low, high = catalog.reference_range(test, sex)
    return {
        "code": test.code,
        "name": test.name,
        "panel": test.panel,
        "unit": test.unit,
        "loinc": test.loinc,
        "about": test.about,
        "decimals": test.decimals,
        "derived": test.derived,
        "standard_range": {"low": low, "high": high},
        # Range bars: "doctors usually act beyond here"
        "action": {"low": test.action[0], "high": test.action[1]},
        "critical": {"low": test.critical[0], "high": test.critical[1]},
        "bands": [{"label": b.label, "low": b.low, "high": b.high, "tone": b.tone} for b in test.bands],
    }


def test_summary(code: str, points: list[dict], sex: Optional[str]) -> dict:
    """A test with its history, latest value, plain-language status and change."""
    test = catalog.TESTS[code]
    latest = points[-1] if points else None
    previous = points[-2] if len(points) > 1 else None
    change = None
    if latest and previous:
        delta = latest["value"] - previous["value"]
        change = {
            "from": previous["value"],
            "from_date": previous["date"],
            "amount": round(delta, max(test.decimals, 1)),
            "direction": "up" if delta > 0 else "down" if delta < 0 else "same",
            "significant": _significant(test, previous["value"], latest["value"]),
        }
    band = band_for(test, latest["value"]) if latest else None
    return {
        **test_meta(test, sex),
        "latest": latest,
        "status_label": status_label(test, latest["value"], latest["flag"], latest["ref_low"], latest["ref_high"]) if latest else None,
        "band": {"label": band.label, "tone": band.tone} if band else None,
        "change": change,
        "points": points,
    }


def _anaemia_pattern(series: dict) -> Optional[dict]:
    """Low haemoglobin, described by red cell size (MCV): a common first step in finding
    the cause."""
    hb, mcv = series.get("hemoglobin"), series.get("mcv")
    if not hb or hb[-1]["flag"] not in ("low", "critical_low"):
        return None
    if not mcv or mcv[-1]["date"] != hb[-1]["date"]:
        return {"pattern": "anaemia", "label": "Low haemoglobin"}
    if mcv[-1]["value"] < 80:
        return {"pattern": "microcytic", "label": "Low haemoglobin with small red cells (often iron deficiency)"}
    if mcv[-1]["value"] > 100:
        return {"pattern": "macrocytic", "label": "Low haemoglobin with large red cells (often B12 or folate deficiency)"}
    return {"pattern": "normocytic", "label": "Low haemoglobin with normal-sized red cells"}


def _sex(patient: Patient) -> Optional[str]:
    return patient.gender if patient.gender in ("male", "female") else None


def trends(patient: Patient, db: Session) -> dict:
    """Every test with results, grouped into panels by body system."""
    series = series_by_test(patient, db)
    sex = _sex(patient)
    panels = []
    for panel_code, panel_name in catalog.PANELS.items():
        tests = [test_summary(t.code, series[t.code], sex) for t in catalog.panel_tests(panel_code) if t.code in series]
        if not tests:
            continue
        outside = sum(1 for t in tests if t["latest"] and t["latest"]["flag"] != "normal")
        panels.append({
            "code": panel_code, "name": panel_name, "tests": tests,
            "in_range": len(tests) - outside, "outside": outside,
        })
    return {"panels": panels, "anaemia_pattern": _anaemia_pattern(series)}


def single_test(patient: Patient, code: str, db: Session) -> Optional[dict]:
    if code not in catalog.TESTS:
        return None
    points = series_by_test(patient, db, {code}).get(code, [])
    return test_summary(code, points, _sex(patient))


def _critical(summaries: list[dict]) -> list[dict]:
    return [
        {"code": s["code"], "name": s["name"], "value": s["latest"]["value"], "unit": s["unit"], "decimals": s["decimals"],
         "date": s["latest"]["date"], "flag": s["latest"]["flag"]}
        for s in summaries
        if s["latest"] and s["latest"]["trusted"] and s["latest"]["flag"].startswith("critical")
    ]


def patient_summary(patient: Patient, db: Session) -> dict:
    """The dashboard card: at most three things that need attention or changed, plus a
    calm overview per panel. Only trusted values count."""
    data = trends(patient, db)
    summaries = [t for p in data["panels"] for t in p["tests"]]
    trusted = [t for t in summaries if t["latest"] and t["latest"]["trusted"]]
    severity = {"critical_low": 0, "critical_high": 0, "low": 1, "high": 1}
    # Most serious first, then most recent: a year-old value should not crowd out last week's.
    attention = sorted(
        (t for t in trusted if t["latest"]["flag"] != "normal"),
        key=lambda t: (severity.get(t["latest"]["flag"], 2), -t["latest"]["date"].toordinal()),
    )
    changes = [t for t in trusted if t["change"] and t["change"]["significant"] and t not in attention]

    def item(t):
        return {"code": t["code"], "name": t["name"], "value": t["latest"]["value"], "unit": t["unit"], "decimals": t["decimals"],
                "date": t["latest"]["date"], "flag": t["latest"]["flag"], "status_label": t["status_label"],
                "change": t["change"]}

    unconfirmed = sum(1 for t in summaries for p in t["points"] if not p["trusted"])
    last = max((t["latest"]["date"] for t in summaries if t["latest"]), default=None)
    return {
        "has_results": bool(summaries),
        "needs_attention": [item(t) for t in attention[:3]],
        "changes": [item(t) for t in changes[: max(0, 3 - min(3, len(attention)))]],
        "critical": _critical(summaries),
        "panels": [{"code": p["code"], "name": p["name"], "in_range": p["in_range"], "outside": p["outside"]}
                   for p in data["panels"]],
        "all_in_range": bool(summaries) and not any(p["outside"] for p in data["panels"]),
        "last_result_date": last,
        "unconfirmed_count": unconfirmed,
    }


def doctor_overview(patient: Patient, db: Session) -> dict:
    """Latest values per panel, calculated values, and critical results pinned."""
    data = trends(patient, db)
    summaries = [t for p in data["panels"] for t in p["tests"]]
    by_code = {t["code"]: t for t in summaries}
    calculated = []
    if "egfr" in by_code:
        e = by_code["egfr"]
        calculated.append({"code": "egfr", "name": "eGFR (CKD-EPI 2021)", "value": e["latest"]["value"],
                           "unit": e["unit"], "date": e["latest"]["date"],
                           "label": e["band"]["label"] if e["band"] else None,
                           "basis": "Calculated from creatinine, age and sex"})
    if "hba1c" in by_code and by_code["hba1c"]["band"]:
        h = by_code["hba1c"]
        calculated.append({"code": "hba1c_category", "name": "HbA1c category", "value": h["latest"]["value"],
                           "unit": h["unit"], "date": h["latest"]["date"], "label": h["band"]["label"],
                           "basis": "ADA thresholds: 5.7% prediabetes, 6.5% diabetes"})
    return {
        "patient": {"age": age_on(patient.date_of_birth, date.today()), "gender": patient.gender,
                    "blood_group": patient.blood_group},
        "critical": _critical(summaries),
        "anaemia_pattern": data["anaemia_pattern"],
        "calculated": calculated,
        "panels": [
            {"code": p["code"], "name": p["name"], "in_range": p["in_range"], "outside": p["outside"],
             "tests": [{k: t[k] for k in ("code", "name", "unit", "decimals", "latest", "status_label", "change", "band")}
                       for t in p["tests"]]}
            for p in data["panels"]
        ],
    }


def cumulative_table(patient: Patient, db: Session) -> dict:
    """Tests (rows, grouped by panel) by collection date (columns, newest first)."""
    series = series_by_test(patient, db)
    dates = sorted({p["date"] for pts in series.values() for p in pts}, reverse=True)[:MAX_TABLE_DATES]
    rows = []
    for panel_code, panel_name in catalog.PANELS.items():
        for test in catalog.panel_tests(panel_code):
            points = series.get(test.code)
            if not points:
                continue
            by_date = {p["date"]: p for p in points}
            rows.append({
                "code": test.code, "name": test.name, "unit": test.unit, "decimals": test.decimals, "panel": panel_code,
                "panel_name": panel_name, "derived": test.derived,
                "cells": [
                    {k: by_date[d][k] for k in ("id", "report_id", "value", "flag", "status", "trusted")}
                    if d in by_date else None
                    for d in dates
                ],
            })
    return {"dates": dates, "rows": rows}


def report_results(report: MedicalReport, patient: Patient) -> dict:
    """One report's results, each with what a range bar needs."""
    sex = _sex(patient)
    results = []
    panel_order = list(catalog.PANELS)
    for r in sorted(report.lab_results or [], key=lambda x: (panel_order.index(catalog.TESTS[x.test_code].panel), x.test_code)):
        test = catalog.TESTS[r.test_code]
        results.append({
            **test_meta(test, sex),
            "result": _point(r),
            "status_label": status_label(test, r.value, r.flag, r.ref_low, r.ref_high),
            "extracted_value": r.extracted_value,
        })
    return {
        "report_id": str(report.id),
        "document_kind": report.document_kind,
        "collected_on": report.collected_on,
        "lab_name": report.lab_name,
        "results": results,
    }
