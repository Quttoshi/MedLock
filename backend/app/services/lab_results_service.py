"""Turning a report's extracted values into trustworthy lab results.

After OCR, each extracted line is matched to the test catalog, converted to the canonical
unit, checked against limits a real value could have, given a reference range (the lab's
own when printed, otherwise the catalog's for the patient's sex) and flagged. Each result
gets a confidence: values read from a PDF's text with a known unit are "high"; OCR or an
assumed unit gives "medium"; anything the parser was unsure about is "low". A person can
confirm or correct any value; only high-confidence or person-checked values count as
trusted for summaries.
"""
import logging
import re
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.lab_result import LabResult
from app.models.medical_report import MedicalReport
from app.services import lab_catalog as catalog
from app.services import report_metadata as meta

logger = logging.getLogger(__name__)

TEXT_LAYER_ENGINES = {"pdfplumber", "docx2txt"}
LOW_OCR_CONFIDENCE = 75.0


# ── Reading one line ─────────────────────────────────────────────────────────────

def parse_range_text(text: Optional[str]) -> Optional[tuple]:
    """The parser stores a printed range as "12 - 17.5", "<= 200" or ">= 40"."""
    if not text:
        return None
    t = text.replace(",", "").strip()
    m = re.fullmatch(r"([\d.]+)\s*-\s*([\d.]+)", t)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.fullmatch(r"(?:<=|<)\s*([\d.]+)", t)
    if m:
        return None, float(m.group(1))
    m = re.fullmatch(r"(?:>=|>)\s*([\d.]+)", t)
    if m:
        return float(m.group(1)), None
    return None


def _convert_bound(test, bound, unit):
    if bound is None:
        return None
    converted, how = catalog.to_canonical(test, bound, unit)
    return round(converted, max(test.decimals, 2)) if how != "unknown" else None


def _infer_count_unit(test, value: float) -> tuple[float, Optional[str]]:
    """Blood counts printed without a unit: 7500 means 7.5 x10^9/L, 2.5 (lac) means 250."""
    if test.code == "wbc" and value > 200:
        return value / 1000, "unit_inferred"
    if test.code == "platelets":
        if value >= 2000:
            return value / 1000, "unit_inferred"
        if value < 10:
            return value * 100, "unit_inferred"
    return value, None


def _flag(test, value: float, low, high) -> str:
    crit_low, crit_high = test.critical
    if crit_low is not None and value < crit_low:
        return "critical_low"
    if crit_high is not None and value > crit_high:
        return "critical_high"
    if low is not None and value < low:
        return "low"
    if high is not None and value > high:
        return "high"
    return "normal"


def normalize_item(item: dict, sex: Optional[str], engine: Optional[str]) -> Optional[dict]:
    """A clean result from one extracted line, or None when the line is not a known test
    or its value cannot be real."""
    test = catalog.match_test(item.get("test", ""))
    if test is None or test.derived:
        return None
    try:
        raw = float(item.get("value"))
    except (TypeError, ValueError):
        return None
    unit = item.get("unit") or ""
    text_layer = engine in TEXT_LAYER_ENGINES
    # A PDF's own text cannot misread a decimal point; that doubt only applies to scans and photos.
    parser_reasons = list(item.get("review_reasons") or [])
    reasons = [r for r in parser_reasons if not (text_layer and r == "possible_decimal_misread")]
    doubtful = bool(item.get("needs_review")) and (bool(reasons) or not parser_reasons)

    # Blood-gas style reports print ionised calcium in mmol/L as just "Calcium".
    if test.code == "calcium" and catalog.normalize_unit(unit) == "mmol/l" and raw < 1.6:
        test = catalog.TESTS["ionized_calcium"]

    value, how = catalog.to_canonical(test, raw, unit)
    if how == "unknown":
        return None
    if how == "assumed":
        value, inferred = _infer_count_unit(test, value)
        if inferred:
            reasons.append(inferred)
        else:
            reasons.append("unit_assumed")

    low_limit, high_limit = test.plausible
    if not (low_limit <= value <= high_limit):
        return None

    printed = parse_range_text(item.get("normal_range")) if item.get("flag_source") == "report_reference_range" else None
    if printed:
        low, high = _convert_bound(test, printed[0], unit), _convert_bound(test, printed[1], unit)
        ref_source = "lab"
    else:
        low, high = catalog.reference_range(test, sex)
        ref_source = "standard"

    ocr_conf = item.get("ocr_confidence")
    if doubtful or "unit_inferred" in reasons or (ocr_conf is not None and ocr_conf < LOW_OCR_CONFIDENCE):
        confidence = "low"
    elif text_layer and how == "exact":
        confidence = "high"
    else:
        confidence = "medium"

    value = round(value, max(test.decimals, 2))
    return {
        "test_code": test.code,
        "value": value,
        "unit": test.unit,
        "ref_low": low,
        "ref_high": high,
        "ref_source": ref_source,
        "flag": _flag(test, value, low, high),
        "confidence": confidence,
        "review_reasons": reasons,
        "extracted_value": raw,
        "source_text": (item.get("source_text") or "")[:500] or None,
    }


# ── A whole report ───────────────────────────────────────────────────────────────

_CONFIDENCE_ORDER = {"high": 0, "medium": 1, "low": 2}


def interpret(text: str, items: list[dict], sex: Optional[str], engine: Optional[str]) -> dict:
    """What a report's extracted text and lines mean: the kind of document, when the
    sample was collected, the lab, and one clean result per test (lab reports only).
    Shared by uploads and the accuracy evaluation, so both are judged the same way."""
    kind = meta.document_kind(text, [i.get("test", "") for i in items])
    best: dict = {}
    if kind == "lab_report":
        for item in items:
            normalized = normalize_item(item, sex, engine)
            if normalized is None:
                continue
            current = best.get(normalized["test_code"])
            # One result per test per report: keep the most confident reading.
            if current is None or _CONFIDENCE_ORDER[normalized["confidence"]] < _CONFIDENCE_ORDER[current["confidence"]]:
                best[normalized["test_code"]] = normalized
    return {
        "document_kind": kind,
        "collected_on": meta.collection_date(text),
        "lab_name": meta.lab_name(text),
        "results": list(best.values()),
    }


def ingest(report: MedicalReport, ocr_result, db: Session) -> list[LabResult]:
    """Rebuild a report's lab results from its OCR output (replacing any earlier ones, so
    reports can be re-processed when the catalog or parser improves)."""
    text = (ocr_result.extracted_text or "") if ocr_result else ""
    items = (ocr_result.structured_data or []) if ocr_result else []
    patient = report.patient
    sex = patient.gender if patient and patient.gender in ("male", "female") else None
    found = interpret(text, items, sex, ocr_result.ocr_engine if ocr_result else None)

    report.document_kind = found["document_kind"]
    report.collected_on = found["collected_on"]
    report.lab_name = found["lab_name"] or (report.medical_center.name if report.medical_center else None)

    for old in list(report.lab_results or []):
        db.delete(old)
    report.lab_results = []

    created = []
    if found["results"]:
        collected = report.collected_on or meta.today_or(report.uploaded_at)
        for normalized in found["results"]:
            result = LabResult(
                report_id=report.id, patient_id=report.patient_id, collected_on=collected,
                status="unconfirmed", **normalized,
            )
            db.add(result)
            report.lab_results.append(result)
            created.append(result)
    db.commit()
    return created


def ingest_safely(report: MedicalReport, ocr_result, db: Session) -> None:
    """Called right after OCR; a failure here must never fail the upload."""
    try:
        ingest(report, ocr_result, db)
    except Exception:
        db.rollback()
        logger.exception("Could not build lab results for report %s", report.id)


# ── People confirming or correcting a value ──────────────────────────────────────

def is_trusted(result: LabResult) -> bool:
    """Checked by a person, or read exactly from a PDF's text."""
    return result.status in ("confirmed", "corrected") or result.confidence == "high"


def confirm(result: LabResult, user_id, db: Session, corrected_value: Optional[float] = None) -> LabResult:
    """Confirm a value as read, or correct it. The correction is re-flagged against the
    same range; the value originally read is kept."""
    test = catalog.TESTS[result.test_code]
    if corrected_value is not None:
        low_limit, high_limit = test.plausible
        if not (low_limit <= corrected_value <= high_limit):
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{corrected_value:g} {test.unit} is not a possible {test.name} value. Check the unit.",
            )
        result.value = corrected_value
        result.flag = _flag(test, corrected_value, result.ref_low, result.ref_high)
        result.status = "corrected"
    else:
        result.status = "confirmed"
    result.confirmed_by_user_id = user_id
    result.confirmed_at = datetime.utcnow()
    db.commit()
    return result
