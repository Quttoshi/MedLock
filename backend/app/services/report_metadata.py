"""Facts about a report read from its text: is it a lab report, when was the sample
collected, and which lab produced it.

Only lab reports produce results for charts, so a letter, a prescription or an unrelated
PDF with numbers in it (e.g. a marking rubric) never turns into "test results". Dates are
read day-first, as Pakistani labs write them.
"""
import re
from datetime import date, datetime
from typing import Iterable, Optional

from app.services.lab_catalog import match_test

LAB_KEYWORDS = (
    "reference", "ref. range", "normal range", "normal value", "biological reference", "result", "units",
    "specimen", "sample", "pathology", "laboratory", "haematology", "hematology", "biochemistry",
    "chemistry", "investigation", "lab no", "patient id", "mr no",
)

# Labs and hospital labs common in Pakistan: pattern -> display name
KNOWN_LABS = (
    (r"chughtai", "Chughtai Lab"),
    (r"excel\s*lab", "Excel Labs"),
    (r"islamabad\s+diagnostic|\bidc\b", "Islamabad Diagnostic Centre"),
    (r"shaukat\s+khanum", "Shaukat Khanum"),
    (r"aga\s*khan", "Aga Khan University Hospital"),
    (r"\bessa\b|dr\.?\s*essa", "Dr. Essa's Laboratory"),
    (r"al[\s-]?razi", "Al-Razi Healthcare"),
    (r"citi\s*lab", "Citi Lab"),
    (r"hormone\s*lab", "Hormone Lab"),
    (r"shifa\s+international|\bshifa\b", "Shifa International"),
    (r"pakistan institute of medical sciences|\bpims\b", "PIMS"),
    (r"dow\s+(?:lab|diagnostic|university)", "Dow Diagnostic"),
)

MONTHS = {m: i for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), start=1)}

# Labels by how well they describe the sample date (lower is better)
DATE_LABELS = (
    (0, r"collect(?:ed|ion)|sample\s+(?:collected|date|taken|drawn)|specimen\s+(?:collected|date)|drawn\s+on"),
    (1, r"receiv(?:ed|ing)|registered|registration|booked|booking"),
    (2, r"report(?:ed)?\s*(?:on|date)|date\s+of\s+report|printed|verified"),
    (3, r"\bdate\b"),
)

_DATE_PATTERNS = (
    # 12/10/2026, 12-10-2026, 12.10.2026, 12/10/26 (day first)
    (r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b", "dmy"),
    # 2026-10-12
    (r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", "ymd"),
    # 12-Oct-2026, 12 Oct 2026, 12 October, 2026
    (r"\b(\d{1,2})[\s\-]+([a-z]{3,9})[\s\-,]+(\d{2,4})\b", "dMy"),
    # Oct 12, 2026
    (r"\b([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b", "Mdy"),
)

EARLIEST = date(1990, 1, 1)


def _year(value: str) -> int:
    year = int(value)
    return year + 2000 if year < 100 else year


def _build(kind: str, a: str, b: str, c: str) -> Optional[date]:
    try:
        if kind == "dmy":
            return date(_year(c), int(b), int(a))
        if kind == "ymd":
            return date(int(a), int(b), int(c))
        if kind == "dMy":
            month = MONTHS.get(b[:3])
            return date(_year(c), month, int(a)) if month else None
        if kind == "Mdy":
            month = MONTHS.get(a[:3])
            return date(int(c), month, int(b)) if month else None
    except ValueError:
        return None
    return None


def _dates_in(text: str) -> list[tuple[int, date]]:
    found = []
    for pattern, kind in _DATE_PATTERNS:
        for m in re.finditer(pattern, text):
            d = _build(kind, *m.groups())
            if d and EARLIEST <= d <= date.today():
                found.append((m.start(), d))
    return sorted(found)


def collection_date(text: str) -> Optional[date]:
    """The sample collection date, or the closest thing the report states (received,
    reported, or any labelled date)."""
    lower = (text or "").lower()
    best: Optional[tuple[int, date]] = None
    for rank, label in DATE_LABELS:
        for m in re.finditer(label, lower):
            window = lower[m.end(): m.end() + 60]
            dates = _dates_in(window)
            if dates and (best is None or rank < best[0]):
                best = (rank, dates[0][1])
        if best is not None and best[0] == rank:
            return best[1]
    return None


def lab_name(text: str) -> Optional[str]:
    lower = (text or "").lower()
    for pattern, name in KNOWN_LABS:
        if re.search(pattern, lower):
            return name
    return None


def document_kind(text: str, test_names: Iterable[str]) -> str:
    """"lab_report" when the document names several known tests and reads like a lab
    report; anything else is "other" and produces no results."""
    known = {t.code for t in (match_test(n) for n in test_names) if t}
    lower = (text or "").lower()
    keywords = sum(1 for k in LAB_KEYWORDS if k in lower)
    if len(known) >= 3 or (len(known) >= 1 and keywords >= 2):
        return "lab_report"
    return "other"


def today_or(value: Optional[datetime]) -> date:
    return (value or datetime.utcnow()).date()
