"""How accurately MedLock reads lab reports, measured against a gold set.

A gold case is a report file plus what a person read from it: the kind of document,
the collection date, the lab, and each test's value in MedLock's unit. Each case is run
through exactly the same extraction and interpretation as an upload, and compared.

The number that matters most is "wrong but trusted": a wrong value MedLock would show
as reliable (read with high confidence). Wrong values with lower confidence are shown as
unconfirmed and do not drive the summary, so they are less harmful.
"""
import json
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

from app.services import sample_reports
from app.services.lab_results_service import interpret
from app.services.ocr_service import extract

FILE_TYPES = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".docx"}


@dataclass
class Case:
    name: str
    filename: str
    file_bytes: bytes
    sex: Optional[str]
    document_kind: Optional[str] = None
    collected_on: Optional[date] = None
    lab_name: Optional[str] = None
    results: dict = field(default_factory=dict)


def _same(expected: float, got: float) -> bool:
    return abs(expected - got) <= max(0.011, abs(expected) * 0.005)


def load_cases(folder: Path) -> list[Case]:
    """Every report file in the folder that has a matching .json answer file."""
    cases = []
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() not in FILE_TYPES:
            continue
        answer = path.with_suffix(".json")
        if not answer.exists():
            print(f"Skipping {path.name}: no {answer.name}")
            continue
        data = json.loads(answer.read_text(encoding="utf-8"))
        cases.append(Case(
            name=path.name, filename=path.name, file_bytes=path.read_bytes(), sex=data.get("sex"),
            document_kind=data.get("document_kind", "lab_report"),
            collected_on=date.fromisoformat(data["collected_on"]) if data.get("collected_on") else None,
            lab_name=data.get("lab_name"),
            results={k: float(v) for k, v in (data.get("results") or {}).items()},
        ))
    return cases


def synthetic_cases(today: Optional[date] = None) -> list[Case]:
    """The sample reports (both sexes), whose answers are known exactly."""
    cases = []
    for sex in ("female", "male"):
        for report in sample_reports.year_of_results(sex, today):
            cases.append(Case(
                name=f"synthetic/{sex}/{report.filename}", filename=report.filename,
                file_bytes=sample_reports.render_pdf(report, "Sample Patient", 41, sex), sex=sex,
                document_kind="lab_report", collected_on=report.collected_on,
                lab_name=sample_reports.LABS[report.lab]["lab_name"], results=report.expected_results(),
            ))
    return cases


def evaluate_case(case: Case) -> dict:
    text, items, engine, status, error = extract(case.file_bytes, case.filename)
    found = interpret(text, items, case.sex, engine)
    got = {r["test_code"]: r for r in found["results"]}

    correct, wrong, missed = [], [], []
    for code, expected in case.results.items():
        result = got.get(code)
        if result is None:
            missed.append(code)
        elif _same(expected, result["value"]):
            correct.append(code)
        else:
            wrong.append({"test": code, "expected": expected, "got": result["value"],
                          "confidence": result["confidence"], "source": result.get("source_text")})
    extra = [{"test": code, "got": r["value"], "confidence": r["confidence"], "source": r.get("source_text")}
             for code, r in got.items() if code not in case.results]

    return {
        "case": case.name,
        "engine": engine,
        "status": status,
        "error": error,
        "document_kind": {"expected": case.document_kind, "got": found["document_kind"]},
        "collected_on": {"expected": case.collected_on, "got": found["collected_on"]},
        "lab_name": {"expected": case.lab_name, "got": found["lab_name"]},
        "correct": correct,
        "wrong": wrong,
        "missed": missed,
        "extra": extra,
        # Wrong values MedLock would present as reliable: the dangerous kind of error
        "wrong_but_trusted": [w for w in wrong + extra if w["confidence"] == "high"],
    }


def _field_accuracy(outcomes: list[dict], name: str) -> Optional[dict]:
    checked = [o[name] for o in outcomes if o[name]["expected"] is not None]
    if not checked:
        return None
    right = sum(1 for c in checked if c["expected"] == c["got"])
    return {"right": right, "checked": len(checked), "rate": right / len(checked)}


def summarize(outcomes: list[dict]) -> dict:
    expected = sum(len(o["correct"]) + len(o["wrong"]) + len(o["missed"]) for o in outcomes)
    correct = sum(len(o["correct"]) for o in outcomes)
    reported = correct + sum(len(o["wrong"]) + len(o["extra"]) for o in outcomes)
    return {
        "cases": len(outcomes),
        "expected_values": expected,
        "correct_values": correct,
        # Of the values on the reports, how many MedLock read correctly
        "recall": correct / expected if expected else None,
        # Of the values MedLock produced, how many were right
        "precision": correct / reported if reported else None,
        "wrong_values": sum(len(o["wrong"]) for o in outcomes),
        "missed_values": sum(len(o["missed"]) for o in outcomes),
        "extra_values": sum(len(o["extra"]) for o in outcomes),
        "wrong_but_trusted": sum(len(o["wrong_but_trusted"]) for o in outcomes),
        "document_kind": _field_accuracy(outcomes, "document_kind"),
        "collected_on": _field_accuracy(outcomes, "collected_on"),
        "lab_name": _field_accuracy(outcomes, "lab_name"),
    }
