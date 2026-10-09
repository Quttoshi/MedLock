"""Realistic sample lab reports for demos, testing and the accuracy evaluation.

Builds digital (text-layer) PDFs in the styles of Pakistani labs, each lab naming
tests and printing units its own way, and tells a year-long story: iron-deficiency
anaemia improving on treatment, HbA1c crossing into the diabetes range and coming back
down, LDL falling, low vitamin D corrected, and creatinine creeping up. Every row carries
the value MedLock should end up with (in the catalog's unit), so the same reports
check the extraction.
"""
import zlib
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from app.services import lab_catalog as catalog

SAMPLE_PREFIX = "medlock-sample-"


@dataclass
class Row:
    name: str            # as the lab prints it
    value: str           # as printed
    unit: str            # as printed
    range_text: str      # as printed
    code: str            # catalog test it should become
    expected: float      # value in the catalog's unit


@dataclass
class SampleReport:
    filename: str
    lab: str
    title: str
    collected_on: date
    rows: list[Row] = field(default_factory=list)
    report_type: str = "Blood Test"

    def expected_results(self) -> dict[str, float]:
        return {r.code: r.expected for r in self.rows}


# ── How each lab prints things ───────────────────────────────────────────────────

LABS = {
    "chughtai": {
        "header": ["CHUGHTAI LAB", "Clinical Laboratory & Diagnostic Services | Lahore | UAN 111-456-789"],
        "lab_name": "Chughtai Lab",
        "date": lambda d: d.strftime("%d/%m/%Y"),
        "names": {
            "hemoglobin": "Haemoglobin (Hb)", "wbc": "Total Leucocyte Count", "platelets": "Platelet Count",
            "hematocrit": "Haematocrit (PCV)", "rdw": "RDW-CV", "glucose_fasting": "Glucose Fasting",
            "creatinine": "Serum Creatinine", "urea": "Blood Urea", "alt": "ALT (SGPT)", "ast": "AST (SGOT)",
            "vitamin_d": "Vitamin D (25-OH)", "ferritin": "Serum Ferritin", "sodium": "Serum Sodium",
            "potassium": "Serum Potassium", "chloride": "Serum Chloride",
        },
        "units": {"wbc": ("/cumm", 1000)},
    },
    "excel": {
        "header": ["EXCEL LABS", "Pathology & Molecular Diagnostics | Islamabad"],
        "lab_name": "Excel Labs",
        "date": lambda d: d.strftime("%d-%b-%Y"),
        "names": {
            "hemoglobin": "Hemoglobin", "wbc": "TLC", "platelets": "Platelets", "hematocrit": "PCV",
            "rdw": "RDW", "glucose_fasting": "Fasting Blood Sugar", "creatinine": "Creatinine", "urea": "Urea",
            "alt": "SGPT", "ast": "SGOT", "vitamin_d": "Vitamin D", "ferritin": "Ferritin",
        },
        "units": {"platelets": ("Lac/cumm", 0.01)},
    },
    "idc": {
        "header": ["ISLAMABAD DIAGNOSTIC CENTRE (IDC)", "Laboratory Services | Blue Area, Islamabad"],
        "lab_name": "Islamabad Diagnostic Centre",
        "date": lambda d: d.strftime("%Y-%m-%d"),
        "names": {
            "hemoglobin": "HB", "wbc": "WBC Count", "platelets": "Platelet Count", "hematocrit": "HCT",
            "rdw": "RDW-CV", "glucose_fasting": "FBS", "creatinine": "Creatinine", "urea": "Urea",
            "ferritin": "S. Ferritin",
        },
        "units": {"creatinine": ("umol/L", 88.42), "platelets": ("x10^3/uL", 1)},
    },
}

_DEFAULT_UNITS = {"wbc": "x10^9/L", "platelets": "x10^9/L", "rbc": "x10^12/L"}


def _fmt(value: float, decimals: int) -> str:
    return f"{value:.{decimals}f}"


def _range_text(test: catalog.LabTest, sex: Optional[str], factor: float, decimals: int) -> str:
    low, high = catalog.reference_range(test, sex)
    if low is None:
        return f"< {_fmt(high * factor, decimals)}"
    if high is None:
        return f"> {_fmt(low * factor, decimals)}"
    return f"{_fmt(low * factor, decimals)} - {_fmt(high * factor, decimals)}"


def _row(lab: str, code: str, value: float, sex: Optional[str]) -> Row:
    test = catalog.TESTS[code]
    style = LABS[lab]
    unit, factor = style["units"].get(code, (_DEFAULT_UNITS.get(code, test.unit), 1))
    decimals = test.decimals
    if factor >= 1000 or factor == 88.42:
        decimals = 0
    elif factor < 1:
        decimals = 2
    printed = round(value * factor, decimals)
    return Row(
        name=style["names"].get(code, test.name),
        value=_fmt(printed, decimals),
        unit=unit,
        range_text=_range_text(test, sex, factor, decimals),
        code=code,
        # What the printed number means in the catalog's unit (what MedLock should store)
        expected=round(printed / factor, max(test.decimals, 2)),
    )


# ── A year of results ───────────────────────────────────────────────────────────

# Months before today -> values. Haemoglobin is for women; men read 1.5 g/dL higher.
_STORY = {
    12: {"hemoglobin": 10.9, "rbc": 4.3, "wbc": 7.2, "platelets": 310, "hematocrit": 34.1, "mcv": 74, "mch": 24.5,
         "mchc": 31.5, "rdw": 16.2, "neutrophils": 62, "lymphocytes": 30, "monocytes": 5, "eosinophils": 2,
         "basophils": 1, "hba1c": 6.4, "glucose_fasting": 112, "creatinine": 0.82, "urea": 26,
         "cholesterol_total": 228, "ldl": 152, "hdl": 42, "triglycerides": 182, "alt": 34, "ast": 29, "alp": 98,
         "bilirubin_total": 0.7, "vitamin_d": 14.2, "tsh": 2.1},
    10: {"hemoglobin": 11.4, "wbc": 6.8, "platelets": 295, "mcv": 76, "mch": 25.2, "rdw": 15.8, "ferritin": 14},
    8: {"hba1c": 6.8, "glucose_fasting": 128},
    6: {"hemoglobin": 12.1, "wbc": 7.9, "platelets": 280, "hematocrit": 37.0, "mcv": 79, "mch": 26.4, "rdw": 15.0,
        "creatinine": 0.86, "urea": 29, "sodium": 139, "potassium": 4.2, "chloride": 102,
        "cholesterol_total": 212, "ldl": 138, "hdl": 44, "triglycerides": 168, "ferritin": 26},
    4: {"hba1c": 6.9, "glucose_fasting": 131, "vitamin_d": 31.5},
    2: {"hemoglobin": 12.6, "wbc": 6.5, "platelets": 265, "hematocrit": 38.2, "mcv": 82, "mch": 27.5, "rdw": 14.2,
        "creatinine": 0.95, "urea": 31, "sodium": 137, "potassium": 4.6, "chloride": 101,
        "alt": 41, "ast": 32, "alp": 104, "bilirubin_total": 0.6},
    0: {"hemoglobin": 12.9, "wbc": 7.1, "platelets": 272, "hematocrit": 39.0, "mcv": 84, "mch": 28.1, "rdw": 13.6,
        "hba1c": 6.3, "glucose_fasting": 109, "cholesterol_total": 196, "ldl": 118, "hdl": 47, "triglycerides": 151,
        "ferritin": 41, "tsh": 2.4},
}

_CBC = ["hemoglobin", "rbc", "wbc", "platelets", "hematocrit", "mcv", "mch", "mchc", "rdw",
        "neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils"]
_CHEMISTRY = ["hba1c", "glucose_fasting", "creatinine", "urea", "sodium", "potassium", "chloride",
              "alt", "ast", "alp", "bilirubin_total", "cholesterol_total", "ldl", "hdl", "triglycerides",
              "vitamin_d", "ferritin", "tsh"]

# Months before today -> (lab, [(title, tests)]). Several reports on one day, like real visits.
_VISITS = {
    12: ("chughtai", [("Complete Blood Count", _CBC), ("Biochemistry", _CHEMISTRY)]),
    10: ("excel", [("CBC and Iron Studies", _CBC + ["ferritin"])]),
    8: ("chughtai", [("Diabetes Profile", ["hba1c", "glucose_fasting"])]),
    6: ("idc", [("Complete Blood Count", _CBC), ("Renal, Lipid and Iron Profile", _CHEMISTRY)]),
    4: ("excel", [("Diabetes Profile and Vitamin D", ["hba1c", "glucose_fasting", "vitamin_d"])]),
    2: ("chughtai", [("Complete Blood Count", _CBC), ("Renal and Liver Function", _CHEMISTRY)]),
    0: ("idc", [("Complete Blood Count", _CBC), ("Follow-up Chemistry", _CHEMISTRY)]),
}


# A full blood count always prints these; values the story does not change stay steady.
_CBC_STEADY = {"rbc": 4.4, "mchc": 32.8, "neutrophils": 58, "lymphocytes": 33, "monocytes": 6,
               "eosinophils": 2, "basophils": 1}


def year_of_results(sex: Optional[str], today: Optional[date] = None) -> list[SampleReport]:
    """About a dozen reports from three labs across the last year, oldest first."""
    today = today or date.today()
    reports = []
    for months, (lab, parts) in sorted(_VISITS.items(), reverse=True):
        collected = today - timedelta(days=months * 30 + 5)
        values = _STORY[months]
        if "hemoglobin" in values:
            values = {**_CBC_STEADY, **values}
        for title, codes in parts:
            rows = []
            for code in codes:
                if code not in values:
                    continue
                value = values[code]
                if code == "hemoglobin" and sex == "male":
                    value += 1.5
                rows.append(_row(lab, code, value, sex))
            if not rows:
                continue
            slug = title.lower().replace(",", "").replace(" ", "-")
            reports.append(SampleReport(
                filename=f"{SAMPLE_PREFIX}{collected.isoformat()}-{lab}-{slug}.pdf",
                lab=lab, title=title, collected_on=collected, rows=rows,
            ))
    return reports


# ── Drawing the PDF ─────────────────────────────────────────────────────────────

def render_pdf(report: SampleReport, patient_name: str, age: Optional[int], sex: Optional[str]) -> bytes:
    style = LABS[report.lab]
    when = style["date"](report.collected_on)
    reported = style["date"](report.collected_on + timedelta(days=1))
    sex_letter = {"male": "M", "female": "F"}.get(sex or "", "-")
    lines: list[list[tuple[int, str, int]]] = [
        [(40, style["header"][0], 15)],
        [(40, style["header"][1], 8)],
        [],
        [(40, f"Patient Name: {patient_name}", 10), (330, f"Lab No: {zlib.crc32(report.filename.encode()) % 900000 + 100000}", 10)],
        [(40, f"Age/Sex: {age if age is not None else '-'} Y / {sex_letter}", 10), (330, "Referred By: Self", 10)],
        [(40, f"Sample Collected: {when} 09:15", 10), (330, f"Reported On: {reported} 17:40", 10)],
        [],
        [(40, report.title.upper(), 12)],
        [(40, "Test", 10), (230, "Result", 10), (310, "Unit", 10), (400, "Reference Range", 10)],
    ]
    for row in report.rows:
        lines.append([(40, row.name, 10), (230, row.value, 10), (310, row.unit, 10), (400, row.range_text, 10)])
    lines += [
        [],
        [(40, "This is an electronically verified report and does not require a signature.", 8)],
        [(40, "Sample report generated by MedLock for demonstration. Not a real patient.", 8)],
    ]
    return _pdf(lines)


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf(lines: list[list[tuple[int, str, int]]]) -> bytes:
    """A one-page A4 PDF with a real text layer (Helvetica), like a lab's own PDF."""
    ops = ["BT"]
    y = 800
    for cells in lines:
        size = max((s for _, _, s in cells), default=10)
        for x, text, s in cells:
            ops.append(f"/F1 {s} Tf 1 0 0 1 {x} {y} Tm ({_escape(text)}) Tj")
        y -= size + 7
    ops.append("ET")
    stream = "\n".join(ops).encode("latin-1", "replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return out
