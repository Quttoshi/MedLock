import io
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime

import cv2
import docx2txt
import numpy as np
import pdfplumber
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image, ImageEnhance, ImageOps
from pytesseract import Output
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ocr_result import OcrResult
from app.models.medical_report import MedicalReport
from app.services import lab_catalog

pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
_poppler_path = settings.POPPLER_PATH or None
logger = logging.getLogger(__name__)
PARSER_VERSION = "medical-ocr-v4"

# A digital PDF page with at least this many non-space characters has a usable text layer,
# so re-running OCR on it would not beat the embedded text.
MIN_TEXT_LAYER_CHARS_PER_PAGE = 100
# Values whose OCR confidence (0-100) falls below this are flagged for manual review.
REVIEW_CONFIDENCE = 60.0
# Stop trying preprocessing variants once one reaches this mean word confidence.
EARLY_STOP_CONFIDENCE = 85.0
# Page detection runs on a downscaled copy of the photo for speed.
PAGE_DETECT_MAX_SIDE = 1000
MIN_PAGE_AREA_RATIO = 0.3
# Corner offsets below this fraction of the image size mean the page is already flat.
FLAT_PAGE_TOLERANCE = 0.02
DESKEW_MAX_ANGLE = 10.0
DESKEW_MIN_ANGLE = 0.3
# The best deskew angle must sharpen the row profile by this factor over no rotation.
DESKEW_MIN_GAIN = 1.05
# Tesseract orientation confidence is ~10 on normal pages; below this the guess is unreliable.
OSD_MIN_CONFIDENCE = 2.0

NORMAL_RANGES = {
    "hemoglobin":   (12.0, 17.5),
    "glucose":      (70.0, 100.0),
    "cholesterol":  (0.0, 200.0),
    "creatinine":   (0.6, 1.2),
    "urea":         (7.0, 20.0),
    "wbc":          (4.0, 11.0),
    "rbc":          (4.2, 5.9),
    "platelets":    (150.0, 400.0),
    "sodium":       (135.0, 146.0),
    "potassium":    (3.5, 5.0),
    "tsh":          (0.4, 4.0),
    "iron":         (60.0, 170.0),
    "pcv":          (40.0, 50.0),
    "mcv":          (83.0, 101.0),
    "mch":          (27.0, 32.0),
    "mchc":         (32.5, 34.5),
    "rdw":          (11.6, 14.0),
    "neutrophils":  (50.0, 62.0),
    "lymphocytes":  (20.0, 40.0),
    "eosinophils":  (0.0, 6.0),
    "monocytes":    (0.0, 10.0),
    "basophils":    (0.0, 2.0),
    "absolute neutrophils": (2000.0, 7000.0),
    "absolute lymphocytes": (1000.0, 3000.0),
    "absolute monocytes":   (200.0, 1000.0),
    "absolute eosinophils": (20.0, 500.0),
    "ph":           (7.35, 7.45),
    "pco2":         (35.0, 45.0),
    "po2":          (83.0, 108.0),
    "calcium":      (1.15, 1.29),
    "chloride":     (95.0, 105.0),
    "lactate":      (0.5, 1.6),
    "oxygen saturation": (95.0, 100.0),
    "blood urea nitrogen": (0.0, 999.0),
    "uric acid": (0.0, 999.0),
    "sgpt": (0.0, 999.0),
    "sgot": (0.0, 999.0),
    "total protein": (0.0, 999.0),
    "albumin": (0.0, 999.0),
    "globulin": (0.0, 999.0),
    "a/g ratio": (0.0, 999.0),
    "total bilirubin": (0.0, 999.0),
    "conjugated bilirubin": (0.0, 999.0),
    "unconjugated bilirubin": (0.0, 999.0),
    "delta bilirubin": (0.0, 999.0),
}

TEST_ALIASES = {
    "hb": "hemoglobin",
    "hemoglobin": "hemoglobin",
    "cholesterol": "cholesterol",
    "triglyceride": "triglyceride",
    "hdl cholesterol": "hdl cholesterol",
    "direct ldl": "direct ldl",
    "ldl cholesterol": "direct ldl",
    "vldl": "vldl",
    "chol/hdl ratio": "chol/hdl ratio",
    "ldl/hdl ratio": "ldl/hdl ratio",
    "creatinine serum": "creatinine",
    "creatinine": "creatinine",
    "urea": "urea",
    "blood urea nitrogen": "blood urea nitrogen",
    "uric acid": "uric acid",
    "sgpt": "sgpt",
    "sgot": "sgot",
    "total protein": "total protein",
    "albumin": "albumin",
    "globulin": "globulin",
    "a/g ratio": "a/g ratio",
    "total bilirubin": "total bilirubin",
    "conjugated bilirubin": "conjugated bilirubin",
    "unconjugated bilirubin": "unconjugated bilirubin",
    "delta bilirubin": "delta bilirubin",
    "total rbc count": "rbc",
    "r b c count": "rbc",
    "rbc count": "rbc",
    "rbc": "rbc",
    "total wbc count": "wbc",
    "wbc count": "wbc",
    "wbc": "wbc",
    "platelet count": "platelets",
    "platelets": "platelets",
    "packed cell volume": "pcv",
    "pcv": "pcv",
    "mean corpuscular volume": "mcv",
    "mean cell volume": "mcv",
    "mcv": "mcv",
    "mchc": "mchc",
    "mean cell hemoglobin": "mch",
    "mean cell hb conc": "mchc",
    "mch": "mch",
    "rdw": "rdw",
    "absolute neutrophils count": "absolute neutrophils",
    "absolute lymphocytes count": "absolute lymphocytes",
    "absolute monocytes count": "absolute monocytes",
    "absolute eosinophils count": "absolute eosinophils",
    "ph": "ph",
    "ph t": "ph",
    "pco2": "pco2",
    "pco t": "pco2",
    "po2": "po2",
    "po t": "po2",
    "cthb": "hemoglobin",
    "ethb": "hemoglobin",
    "hct": "pcv",
    "hcte": "pcv",
    "hete": "pcv",
    "so2": "oxygen saturation",
    "ctco2": "total carbon dioxide",
    "chco3": "bicarbonate",
    "cbase": "base excess",
    "baro": "barometric pressure",
    "cna": "sodium",
    "cnat": "sodium",
    "ck": "potassium",
    "ckt": "potassium",
    "cca": "calcium",
    "ccl": "chloride",
    "cch": "chloride",
    "ech": "chloride",
    "ecl": "chloride",
    "clac": "lactate",
    "fo2hb": "oxyhemoglobin",
    "fcohb": "carboxyhemoglobin",
    "p50": "p50",
}

DISPLAY_NAMES = {
    "ph": "pH",
    "pco2": "pCO2",
    "po2": "pO2",
    "pcv": "Hct",
    "hemoglobin": "Hemoglobin",
    "cholesterol": "Cholesterol",
    "triglyceride": "Triglyceride",
    "hdl cholesterol": "HDL Cholesterol",
    "direct ldl": "Direct LDL",
    "vldl": "VLDL",
    "chol/hdl ratio": "CHOL/HDL Ratio",
    "ldl/hdl ratio": "LDL/HDL Ratio",
    "creatinine": "Creatinine, Serum",
    "urea": "Urea",
    "blood urea nitrogen": "Blood Urea Nitrogen",
    "uric acid": "Uric Acid",
    "sgpt": "SGPT",
    "sgot": "SGOT",
    "total protein": "Total Protein",
    "albumin": "Albumin",
    "globulin": "Globulin",
    "a/g ratio": "A/G Ratio",
    "total bilirubin": "Total Bilirubin",
    "conjugated bilirubin": "Conjugated Bilirubin",
    "unconjugated bilirubin": "Unconjugated Bilirubin",
    "delta bilirubin": "Delta Bilirubin",
    "rbc": "RBC Count",
    "mcv": "MCV",
    "mch": "MCH",
    "mchc": "MCHC",
    "oxygen saturation": "sO2",
    "sodium": "Sodium",
    "potassium": "Potassium",
    "calcium": "Calcium",
    "chloride": "Chloride",
    "lactate": "Lactate",
    "oxyhemoglobin": "Oxyhemoglobin",
    "carboxyhemoglobin": "Carboxyhemoglobin",
    "absolute neutrophils": "Absolute Neutrophils Count",
    "absolute lymphocytes": "Absolute Lymphocytes Count",
    "absolute monocytes": "Absolute Monocytes Count",
    "absolute eosinophils": "Absolute Eosinophils Count",
}

KNOWN_TEST_TERMS = sorted(
    set(NORMAL_RANGES) | set(TEST_ALIASES) | {
        "hemoglobin hb",
        "hdl cholesterol",
        "direct ldl",
        "ldl cholesterol",
        "chol/hdl ratio",
        "ldl/hdl ratio",
        "creatinine serum",
        "blood urea nitrogen",
        "uric acid",
        "total protein",
        "a/g ratio",
        "total bilirubin",
        "conjugated bilirubin",
        "unconjugated bilirubin",
        "delta bilirubin",
        "total rbc count",
        "packed cell volume pcv",
        "mean corpuscular volume mcv",
        "platelet count",
        "total wbc count",
        "mean cell hemoglobin mch",
        "mean cell hb conc mchc",
        "mean cell volume mcv",
        "mean cell hemoglobin",
        "mean cell hb conc",
        "mean cell volume",
        "r b c count",
        "absolute neutrophils count",
        "absolute lymphocytes count",
        "absolute monocytes count",
        "absolute eosinophils count aec",
        "absolute eosinophils count",
        "blood gas values",
        "electrolyte values",
        "metabolite values",
    },
    key=len,
    reverse=True,
)

# Lines are also read for every name in the lab-test catalog, so any test MedLock charts
# (HbA1c, TLC, fasting glucose, vitamin D, ...) is picked up. Kept separate from
# KNOWN_TEST_TERMS, whose substring check would let short catalog names like "na" match anything.
_LINE_TERMS = sorted(
    set(KNOWN_TEST_TERMS) | {
        alias for test in lab_catalog.TESTS.values() for alias in test.aliases
        if len(alias) > 1 and "(" not in alias
    },
    key=len,
    reverse=True,
)

STATUS_WORDS = {
    "normal", "high", "low", "borderline", "positive", "negative",
    "reactive", "non-reactive", "abnormal", "critical",
}

# Keywords that indicate a row is a header or legend, not a test result
_SKIP_KEYWORDS = {
    "test", "result", "unit", "reference", "status", "range",
    "legend", "normal", "high", "low", "above", "below", "within",
    "parameter", "value", "description", "date", "name", "patient",
    "report", "laboratory", "doctor", "age", "gender", "sample",
}

_SECTION_HEADERS = {
    "hemoglobin", "rbc count", "blood indices", "wbc count",
    "differential wbc count", "platelet count",
}


# ── pdfplumber: extract tables from digital PDFs ──────────────────────────────

def _extract_from_pdf_tables(file_bytes: bytes) -> tuple[str, list[dict], int]:
    """
    Use pdfplumber to extract tables directly from the PDF text layer.
    Returns (full_text, structured_data, page_count).
    """
    full_text_parts = []
    structured = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            # Get plain text for the extracted_text field
            page_text = page.extract_text() or ""
            full_text_parts.append(page_text)

            # Try to extract tables
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row:
                        continue
                    # Clean all cells
                    cells = [str(c).strip() if c else "" for c in row]

                    # Need at least 2 non-empty cells
                    non_empty = [c for c in cells if c]
                    if len(non_empty) < 2:
                        continue

                    test_name = cells[0].lower()

                    # Skip header/legend rows
                    if any(kw in test_name for kw in _SKIP_KEYWORDS):
                        continue
                    if not re.search(r"[a-zA-Z]", test_name):
                        continue

                    # Find the first cell that looks like a numeric value
                    value = None
                    unit = ""
                    status_from_pdf = None

                    for cell in cells[1:]:
                        # Try to parse "108 mg/dL" or "108" or "14.1"
                        m = re.match(r"^(\d+\.?\d*)\s*([a-zA-Z/%µ³\-/°]*)", cell)
                        if m and value is None:
                            value = float(m.group(1))
                            unit = m.group(2).strip()
                        # Pick up status column (Normal/High/Low)
                        if _normalize_status(cell):
                            status_from_pdf = _normalize_status(cell)

                    if value is None:
                        continue

                    structured.append(_result_item(test_name, value, unit, status_from_pdf))

    return "\n".join(full_text_parts), structured, page_count


def _has_text_layer(text: str, page_count: int) -> bool:
    non_space_chars = len(re.sub(r"\s", "", text or ""))
    return non_space_chars >= MIN_TEXT_LAYER_CHARS_PER_PAGE * max(page_count, 1)


def _determine_status(
    test_name: str,
    value: float,
    pdf_status: str | None,
    reference_range: tuple[float, float] | None = None,
) -> str:
    """Return a status only when the source report provides enough evidence."""
    if pdf_status:
        return pdf_status
    if reference_range:
        low, high = reference_range
        if value < low:
            return "low"
        if value > high:
            return "high"
        return "normal"
    return "unverified"


def _canonical_test_key(test_name: str) -> str:
    name = _clean_test_name(test_name).lower()
    name = _normalize_common_ocr_tokens(name)
    compact = re.sub(r"\s+", " ", name).strip()
    key = _substring_test_key(compact)
    # The substring checks must not turn a test the catalog knows into another one
    # ("alkaline phosphatase" contains "ph", which is not the same test).
    named = lab_catalog.match_test(compact)
    if named and lab_catalog.match_test(key) is not named:
        return compact
    return key


def _substring_test_key(compact: str) -> str:
    if compact in TEST_ALIASES:
        return TEST_ALIASES[compact]
    for alias, canonical in sorted(TEST_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        if len(alias) <= 3:
            continue
        if alias in compact:
            return canonical
    for key in NORMAL_RANGES:
        if key in compact:
            return key
    return compact


def _normalize_common_ocr_tokens(name: str) -> str:
    name = name.lower()
    name = name.replace("o,", "o2")
    name = name.replace("co,", "co2")
    name = name.replace(",", " ")
    name = re.sub(r"\bpc0\b", "pco2", name)
    name = re.sub(r"\bpco\b", "pco2", name)
    name = re.sub(r"\bpo\b", "po2", name)
    name = re.sub(r"\bso\b", "so2", name)
    name = re.sub(r"\bctoz\b", "cto2", name)
    name = re.sub(r"\bnat\b", "na", name)
    name = re.sub(r"\bkt\b", "k", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip()


def _clean_test_name(name: str) -> str:
    name = re.sub(r"\([^)]*\)", " ", name)
    name = re.sub(r"[^A-Za-z0-9/%+\-\s,]", " ", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip(" -:").strip()


def _normalize_status(status: str | None) -> str | None:
    if not status:
        return None
    status = status.strip().lower()
    if status == "h":
        return "high"
    if status == "l":
        return "low"
    status = status.replace("non reactive", "non-reactive")
    return status if status in STATUS_WORDS else None


def _parse_number(value: str) -> float:
    value = value.strip().lstrip("<>").replace(",", "")
    return float(value)


def _parse_reference_range(text: str) -> tuple[float, float] | None:
    threshold = _parse_threshold_reference(text)
    if threshold:
        return threshold
    match = re.search(
        r"(?P<low>[<>]?\d[\d,]*(?:\.\d+)?)\s*(?:-|to)\s*(?P<high>[<>]?\d[\d,]*(?:\.\d+)?)",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None
    try:
        return _parse_number(match.group("low")), _parse_number(match.group("high"))
    except ValueError:
        return None


def _parse_threshold_reference(text: str) -> tuple[float, float] | None:
    if re.search(r"\b(low|high|borderline|very\s+high)\s*:", text, re.IGNORECASE):
        return None
    match = re.search(r"(?:up\s*to|<=?|less\s+than)\s*:?\s*(?P<value>\d[\d,]*(?:\.\d+)?)", text, re.IGNORECASE)
    if match:
        try:
            return float("-inf"), _parse_number(match.group("value"))
        except ValueError:
            return None

    match = re.search(r"(?:>=?|greater\s+than)\s*:?\s*(?P<value>\d[\d,]*(?:\.\d+)?)", text, re.IGNORECASE)
    if match:
        try:
            return _parse_number(match.group("value")), float("inf")
        except ValueError:
            return None

    return None


def _extract_unit_from_tail(tail: str) -> str:
    tail_without_reference = re.sub(
        r"[<>\d,.]+\s*(?:-|to)\s*[<>\d,.]+",
        " ",
        tail,
        flags=re.IGNORECASE,
    )
    tail_without_status = re.sub(
        r"\b(normal|high|low|borderline|positive|negative|reactive|non[- ]reactive|abnormal|critical)\b",
        " ",
        tail_without_reference,
        flags=re.IGNORECASE,
    )
    match = re.search(
        # Longer units first where one contains another (mIU/L before U/L, pg/mL before pg).
        r"(?P<unit>x?\s*10\s*\^?\s*\d+\s*/\s*[uµ]?l|lac/cumm|lakh/cumm|cells/cumm|mill/[ce]mm|/cumm|"
        r"mmol/mol|mg/dl|gm/dl|g/dl|mg/l|ng/ml|pg/ml|[uµ]g/dl|mcg/dl|[uµ]mol/l|mmol/l|mmo\s*/?\s*l?|"
        r"m?iu/l|[uµ]iu/ml|u/l|mm/hr|mmhg|vol%|fl|pg|pe|%)",
        tail_without_status,
        re.IGNORECASE,
    )
    return match.group("unit") if match else ""


def _looks_like_result_name(name: str) -> bool:
    clean = _clean_test_name(name).lower()
    if len(clean) < 2:
        return False
    if clean in _SECTION_HEADERS:
        return False
    if any(kw == clean for kw in _SKIP_KEYWORDS):
        return False
    if _canonical_test_key(clean) in NORMAL_RANGES:
        return True
    return any(term in clean for term in KNOWN_TEST_TERMS)


def _normal_range_for(
    test_name: str,
    value: float | None = None,
    reference_range: tuple[float, float] | None = None,
) -> str | None:
    if reference_range:
        low, high = reference_range
        if low == float("-inf"):
            return f"<= {high:g}"
        if high == float("inf"):
            return f">= {low:g}"
        return f"{low:g} - {high:g}"
    return None


def _result_item(
    name: str,
    value: float,
    unit: str = "",
    status_from_text: str | None = None,
    reference_range: tuple[float, float] | None = None,
    source_text: str | None = None,
    reference_text: str | None = None,
) -> dict:
    clean_name = _clean_test_name(name)
    canonical_name = _canonical_test_key(clean_name)
    value = _normalize_value_for_test(canonical_name, value)
    status = _determine_status(clean_name, value, _normalize_status(status_from_text), reference_range)
    item = {
        "test": DISPLAY_NAMES.get(canonical_name, clean_name.title()),
        "value": value,
        "unit": _normalize_unit(unit, canonical_name),
        "status": status,
        "flag_source": _flag_source(status_from_text, reference_range),
    }
    report_flag = _report_flag_label(status_from_text)
    if report_flag:
        item["report_flag"] = report_flag
    normal_range = _normal_range_for(clean_name, value, reference_range)
    if normal_range:
        item["normal_range"] = normal_range
    if reference_text:
        item["reference_text"] = reference_text.strip()
    if source_text:
        item["source_text"] = source_text.strip()
    if reference_range and _looks_like_decimal_misread(value, reference_range):
        _mark_for_review(item, "possible_decimal_misread")
    return item


def _looks_like_decimal_misread(value: float, reference_range: tuple[float, float]) -> bool:
    """OCR often drops or shifts a decimal point (4.1 -> 41). Flag out-of-range values that land
    inside the report's own range once the point moves one place, so genuine extreme results
    (e.g. CRP 150 against 0 - 5) are not flagged."""
    low, high = reference_range
    # One-sided (<= 200) or zero-based (0 - 5) ranges contain almost any value divided by 10,
    # so the check only means something for bounded ranges with a positive lower limit.
    if low <= 0 or high == float("inf") or low <= value <= high:
        return False
    return any(low <= value * shift <= high for shift in (0.1, 10.0))


def _mark_for_review(item: dict, reason: str) -> None:
    item["needs_review"] = True
    reasons = item.setdefault("review_reasons", [])
    if reason not in reasons:
        reasons.append(reason)


def _flag_source(status_from_text: str | None, reference_range: tuple[float, float] | None) -> str:
    if _normalize_status(status_from_text):
        return "explicit_report_flag"
    if reference_range:
        return "report_reference_range"
    return "not_flagged"


def _report_flag_label(status_from_text: str | None) -> str | None:
    normalized = _normalize_status(status_from_text)
    if normalized == "high":
        return "H"
    if normalized == "low":
        return "L"
    if normalized:
        return normalized
    return None


def _normalize_value_for_test(canonical_name: str, value: float) -> float:
    if canonical_name == "sodium" and 1000 <= value <= 9999:
        return float(str(int(value))[1:])
    if canonical_name == "hemoglobin" and value > 50:
        digits = str(int(value))
        if len(digits) == 3:
            return float(f"{digits[:2]}.{digits[2]}")
    return value


def _normalize_unit(unit: str, canonical_name: str) -> str:
    unit = unit.strip().rstrip(".").lower()
    unit = re.sub(r"\s+", "", unit)
    if unit in {"mmo", "mmo/", "mmo/l", "ramo/l", "namo/l"}:
        return "mmol/L"
    if unit == "mg/dl":
        return "mg/dL"
    if unit == "g/dl":
        return "g/dL"
    if unit == "u/l":
        return "U/L"
    if canonical_name == "hemoglobin" and unit in {"col", "gol", "gdl", "gm/dl"}:
        return "g/dL"
    if unit == "mill/emm":
        return "mill/cmm"
    if unit in {"mmhc", "mmhg"}:
        return "mmHg"
    if unit == "fl":
        return "fL"
    if unit == "pe":
        return "pg"
    return unit


# ── Tesseract fallback for scanned/image PDFs and images ─────────────────────

def _preprocess_image(image: Image.Image) -> np.ndarray:
    img = np.array(image)
    if img.shape[0] < 1200 or img.shape[1] < 1200:
        img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    gray = cv2.equalizeHist(gray)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    binary = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )
    return binary


@dataclass
class OcrText:
    """OCR output plus per-line confidence, keyed by the normalized line the parser sees."""
    text: str
    line_confidence: dict[str, float] = field(default_factory=dict)
    mean_confidence: float = 0.0


# ── Geometry correction: flatten, orient and deskew before OCR ────────────────

def _straighten_image(image: Image.Image, allow_perspective: bool) -> Image.Image:
    """Flatten a photographed page, fix 90/180-degree rotation, then remove small tilt."""
    image = image.convert("RGB")
    if allow_perspective:
        image = _flatten_page(image)
    image = _correct_orientation(image)
    return _deskew(image)


def _flatten_page(image: Image.Image) -> Image.Image:
    rgb = np.array(image)
    quad = _find_page_quad(rgb)
    if quad is None or _is_flat(quad, rgb.shape[1], rgb.shape[0]):
        return image
    tl, tr, br, bl = quad
    width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    target = np.float32([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]])
    matrix = cv2.getPerspectiveTransform(quad, target)
    flat = cv2.warpPerspective(rgb, matrix, (width, height), flags=cv2.INTER_CUBIC)
    logger.debug("Flattened page from perspective to %sx%s", width, height)
    return Image.fromarray(flat)


def _find_page_quad(rgb: np.ndarray) -> np.ndarray | None:
    """Find the four corners of the page, assuming it is brighter than the background."""
    h, w = rgb.shape[:2]
    scale = min(1.0, PAGE_DETECT_MAX_SIDE / max(h, w))
    small = cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_RGB2GRAY), (5, 5), 0)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Close the dark text strokes so the page becomes one solid region.
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    page = max(contours, key=cv2.contourArea)
    if cv2.contourArea(page) < MIN_PAGE_AREA_RATIO * small.shape[0] * small.shape[1]:
        return None
    quad = cv2.approxPolyDP(page, 0.02 * cv2.arcLength(page, True), True)
    if len(quad) != 4 or not cv2.isContourConvex(quad):
        return None
    return _order_corners(quad.reshape(4, 2).astype(np.float32) / scale)


def _order_corners(points: np.ndarray) -> np.ndarray:
    """Return corners as top-left, top-right, bottom-right, bottom-left."""
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1).ravel()  # y - x
    return np.array(
        [points[np.argmin(sums)], points[np.argmin(diffs)], points[np.argmax(sums)], points[np.argmax(diffs)]],
        dtype=np.float32,
    )


def _is_flat(quad: np.ndarray, width: int, height: int) -> bool:
    """True when the page is already an upright rectangle, so warping would only crop margins."""
    x, y, w, h = cv2.boundingRect(quad.astype(np.int32))
    box = np.float32([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
    return float(np.abs(quad - box).max()) < FLAT_PAGE_TOLERANCE * max(width, height)


def _correct_orientation(image: Image.Image) -> Image.Image:
    try:
        osd = pytesseract.image_to_osd(image, output_type=Output.DICT)
    except pytesseract.TesseractError:
        # OSD fails on pages with too little text; keep the image as-is.
        return image
    rotate = int(osd.get("rotate", 0)) % 360
    if rotate and float(osd.get("orientation_conf", 0)) >= OSD_MIN_CONFIDENCE:
        logger.debug("Correcting page orientation by %s degrees", rotate)
        # Tesseract reports clockwise degrees; PIL rotates counter-clockwise.
        return image.rotate(-rotate, expand=True, fillcolor="white")
    return image


def _deskew(image: Image.Image) -> Image.Image:
    angle = _estimate_skew(np.array(image.convert("L")))
    if abs(angle) < DESKEW_MIN_ANGLE:
        return image
    logger.debug("Deskewing page by %.2f degrees", angle)
    return Image.fromarray(_rotate_bound(np.array(image), angle))


def _estimate_skew(gray: np.ndarray) -> float:
    """Find the rotation that makes text rows most horizontal (sharpest row-projection profile)."""
    scale = min(1.0, PAGE_DETECT_MAX_SIDE / max(gray.shape))
    small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    _, ink = cv2.threshold(small, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    h, w = ink.shape
    center = (w / 2, h / 2)

    def profile_sharpness(angle: float) -> float:
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(ink, matrix, (w, h), flags=cv2.INTER_NEAREST, borderValue=0)
        rows = rotated.sum(axis=1, dtype=np.float64)
        return float(np.sum(np.diff(rows) ** 2))

    if not ink.any():
        return 0.0
    coarse = max(np.arange(-DESKEW_MAX_ANGLE, DESKEW_MAX_ANGLE + 0.5, 0.5), key=profile_sharpness)
    fine = float(max(np.arange(coarse - 0.5, coarse + 0.55, 0.1), key=profile_sharpness))
    # With too little text every angle scores about the same; only rotate when it clearly helps.
    if profile_sharpness(fine) <= profile_sharpness(0.0) * DESKEW_MIN_GAIN:
        return 0.0
    return float(np.clip(fine, -DESKEW_MAX_ANGLE, DESKEW_MAX_ANGLE))


def _rotate_bound(img: np.ndarray, angle: float) -> np.ndarray:
    """Rotate counter-clockwise by `angle` degrees, growing the canvas so no content is cut off."""
    h, w = img.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    cos, sin = abs(matrix[0, 0]), abs(matrix[0, 1])
    new_w, new_h = int(h * sin + w * cos), int(h * cos + w * sin)
    matrix[0, 2] += new_w / 2 - w / 2
    matrix[1, 2] += new_h / 2 - h / 2
    return cv2.warpAffine(img, matrix, (new_w, new_h), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))


# ── Word-position OCR: rebuild table rows and keep confidence ─────────────────

def _ocr_image(image: Image.Image, allow_perspective: bool) -> OcrText:
    """Straighten the page, OCR each preprocessing variant, and keep the best-scoring result."""
    image = _straighten_image(image, allow_perspective)
    best: tuple[float, str, OcrText] | None = None
    for name, variant, config in _image_ocr_variants(image):
        data = pytesseract.image_to_data(variant, lang="eng", config=config, output_type=Output.DICT)
        words = _words_from_data(data)
        # Tesseract's own line grouping and geometric row grouping come from the same OCR pass,
        # so trying both costs no extra OCR time.
        for grouping, lines in (("lines", _group_tesseract_lines(words)), ("rows", _group_rows(words))):
            candidate = _ocr_text_from_lines(lines, words)
            score = _score_candidate(candidate)
            if best is None or score > best[0]:
                best = (score, f"{name}-{grouping}", candidate)
        if best and best[2].mean_confidence >= EARLY_STOP_CONFIDENCE:
            break

    if best is None:
        return OcrText(text="")
    logger.debug("Selected OCR variant %s with score %.1f", best[1], best[0])
    return best[2]


def _words_from_data(data: dict) -> list[dict]:
    words = []
    for i, text in enumerate(data["text"]):
        confidence = float(data["conf"][i])
        if not text.strip() or confidence < 0:
            continue
        words.append({
            "text": text.strip(),
            "conf": confidence,
            "left": data["left"][i],
            "top": data["top"][i],
            "height": data["height"][i],
            "line_key": (data["block_num"][i], data["par_num"][i], data["line_num"][i]),
        })
    return words


def _group_tesseract_lines(words: list[dict]) -> list[list[dict]]:
    lines: dict[tuple, list[dict]] = {}
    for word in words:
        lines.setdefault(word["line_key"], []).append(word)
    return [sorted(line, key=lambda w: w["left"]) for line in lines.values()]


def _group_rows(words: list[dict]) -> list[list[dict]]:
    """Group words whose vertical centres align, so a table row stays on one line
    even when Tesseract splits its columns into separate blocks."""
    if not words:
        return []
    tolerance = 0.6 * float(np.median([w["height"] for w in words]))
    rows: list[dict] = []
    for word in sorted(words, key=lambda w: w["top"] + w["height"] / 2):
        center = word["top"] + word["height"] / 2
        if rows and abs(center - rows[-1]["center"]) <= tolerance:
            row = rows[-1]
            row["words"].append(word)
            row["center"] += (center - row["center"]) / len(row["words"])
        else:
            rows.append({"center": center, "words": [word]})
    return [sorted(row["words"], key=lambda w: w["left"]) for row in rows]


def _ocr_text_from_lines(lines: list[list[dict]], words: list[dict]) -> OcrText:
    text_lines = []
    line_confidence = {}
    for line in lines:
        line_text = " ".join(w["text"] for w in line)
        text_lines.append(line_text)
        # A row is only as trustworthy as its least-confident number.
        numeric = [w["conf"] for w in line if re.search(r"\d", w["text"])]
        line_confidence[_normalize_ocr_line(line_text)] = min(numeric or [w["conf"] for w in line])
    mean_confidence = float(np.mean([w["conf"] for w in words])) if words else 0.0
    return OcrText("\n".join(text_lines), line_confidence, mean_confidence)


def _score_candidate(candidate: OcrText) -> float:
    """Prefer text that yields more parsed results, then cleaner text and higher confidence."""
    parsed = len(_parse_structured_from_text(candidate.text))
    return parsed * 25 + _score_ocr_text(candidate.text) + candidate.mean_confidence


def _attach_ocr_confidence(structured_data: list[dict], line_confidence: dict[str, float]) -> None:
    for item in structured_data:
        confidence = line_confidence.get(item.get("source_text", ""))
        if confidence is None:
            continue
        item["ocr_confidence"] = round(confidence, 1)
        if confidence < REVIEW_CONFIDENCE:
            _mark_for_review(item, "low_ocr_confidence")


def _image_ocr_variants(image: Image.Image) -> list[tuple[str, Image.Image | np.ndarray, str]]:
    image = image.convert("RGB")
    gray = ImageOps.grayscale(image)
    contrast = ImageEnhance.Contrast(ImageEnhance.Sharpness(gray).enhance(2.0)).enhance(1.6)
    processed = _preprocess_image(image)
    return [
        ("raw-psm6", image, "--psm 6"),
        ("raw-psm4", image, "--psm 4"),
        ("gray-psm6", gray, "--psm 6"),
        ("gray-psm4", gray, "--psm 4"),
        ("contrast-psm6", contrast, "--psm 6"),
        ("contrast-psm4", contrast, "--psm 4"),
        ("processed-psm6", processed, "--psm 6"),
    ]


def _score_ocr_text(text: str) -> int:
    lower = text.lower()
    keywords = [
        "hemoglobin", "wbc", "rbc", "platelet", "blood gas", "ph",
        "pco", "po", "electrolyte", "sodium", "potassium", "lactate",
        "radiometer", "reference", "mmhg", "mmol", "g/dl",
    ]
    keyword_score = sum(lower.count(keyword) for keyword in keywords) * 10
    numeric_score = len(re.findall(r"\d+(?:\.\d+)?", text))
    noise_penalty = len(re.findall(r"[^\w\s/%.,+\-\[\]():]", text))
    impossible_penalty = 0
    impossible_penalty += len(re.findall(r"hemoglobin\s+[1-9]\d{2,}\s*(?:gm/dl|g/dl)", lower)) * 100
    impossible_penalty += len(re.findall(r"\bph\s+[1-9]\d{2,}", lower)) * 100
    decimal_bonus = len(re.findall(r"hemoglobin\s+\d{1,2}\.\d\s*(?:gm/dl|g/dl)", lower)) * 50
    return keyword_score + numeric_score + decimal_bonus - noise_penalty - impossible_penalty


def _extract_text_tesseract_pdf(file_bytes: bytes) -> OcrText:
    images = convert_from_bytes(file_bytes, dpi=300, poppler_path=_poppler_path)
    # Scanned pages are already flat, so only orientation and tilt are corrected.
    pages = [_ocr_image(image, allow_perspective=False) for image in images]
    line_confidence = {}
    for page in pages:
        line_confidence.update(page.line_confidence)
    mean_confidence = float(np.mean([p.mean_confidence for p in pages])) if pages else 0.0
    return OcrText("\n".join(p.text for p in pages), line_confidence, mean_confidence)


def _extract_text_from_image(file_bytes: bytes) -> OcrText:
    image = Image.open(io.BytesIO(file_bytes))
    # Phone cameras store rotation in EXIF instead of rotating the pixels.
    image = ImageOps.exif_transpose(image)
    return _ocr_image(image, allow_perspective=True)


def _parse_structured_from_text(text: str) -> list[dict]:
    """Parse common medical-report lines from PDF text layers and OCR output."""
    results = []
    seen = set()

    for raw_line in text.splitlines():
        line = _normalize_ocr_line(raw_line)
        if not line:
            continue
        item = _parse_result_line(line)
        if not item:
            continue
        key = (_canonical_test_key(item["test"]), item["value"], item.get("unit", ""))
        if key in seen:
            continue
        seen.add(key)
        results.append(item)

    return results


_UNIT_CHARS = {"µ": "u", "μ": "u", "×": "x", "¹²": "^12", "⁹": "^9", "³": "^3", "⁶": "^6"}


def _normalize_ocr_line(line: str) -> str:
    line = line.replace("|", " ")
    line = line.replace("*", "")
    line = line.replace("↓", " low ")
    line = line.replace("↑", " high ")
    # Keep units readable before other non-ASCII characters are dropped (µmol/L, x10³/µL).
    for char, plain in _UNIT_CHARS.items():
        line = line.replace(char, plain)
    line = re.sub(r"[^\x00-\x7F]+", " ", line)
    line = re.sub(r"\s+", " ", line)
    line = re.sub(r"^[+4]\s+(?=[A-Za-z])", "", line)
    return line.strip()


def _parse_result_line(line: str) -> dict | None:
    known = _parse_known_test_line(line)
    if known:
        return known

    generic = re.match(
        r"^(?P<name>[A-Za-z][A-Za-z0-9 ()/%+\-.,]{1,70}?)\s+"
        r"(?P<pre_status>[HL])?\s*"
        r"(?P<value>[<>]?\d[\d,]*(?:\.\d+)?)\s*"
        r"(?P<status>normal|high|low|borderline|positive|negative|reactive|non[- ]reactive|abnormal|critical)?\s*"
        r"(?P<reference>[<>]?\d[\d,]*(?:\.\d+)?\s*(?:-|to)\s*[<>]?\d[\d,]*(?:\.\d+)?)?\s*"
        r"(?P<unit>[A-Za-z/%]+(?:/[A-Za-z0-9]+)?|mill/cumm|cumm|fl|pg|g/dl)?$",
        line,
        re.IGNORECASE,
    )
    if not generic:
        return None

    name = generic.group("name")
    if re.search(r"\d", name):
        return None
    if not _looks_like_result_name(name):
        return None

    try:
        value = _parse_number(generic.group("value"))
    except ValueError:
        return None

    reference_range = _parse_reference_range(generic.group("reference") or "")
    status = _normalize_status(generic.group("pre_status")) or generic.group("status")
    reference_text = generic.group("reference") or ""
    return _result_item(
        name,
        value,
        generic.group("unit") or "",
        status,
        reference_range,
        source_text=line,
        reference_text=reference_text,
    )


def _parse_known_test_line(line: str) -> dict | None:
    line_for_match = _normalize_common_ocr_tokens(line)
    searchable = _normalize_common_ocr_tokens(_clean_test_name(line_for_match))
    for term in _LINE_TERMS:
        if term not in searchable:
            continue
        if len(term) <= 3 and not re.match(rf"^{re.escape(term)}\b", searchable):
            continue

        term_pattern = r"[\s.()]*".join(re.escape(part) for part in term.split())
        match = re.search(
            rf"{term_pattern}(?:\s*\([^)]+\))?(?:\s*,?\s*aec)?\s+"
            r"(?P<pre_status>[HL])?\s*"
            r"(?P<value>[<>]?\d[\d,]*(?:\.\d+)?)"
            r"(?P<tail>.*)$",
            line_for_match,
            re.IGNORECASE,
        )
        if not match:
            continue
        try:
            value = _parse_number(match.group("value"))
        except ValueError:
            return None
        tail = match.group("tail") or ""
        status = _normalize_status(match.group("pre_status"))
        status_match = re.search(
            r"\b(normal|high|low|borderline|positive|negative|reactive|non[- ]reactive|abnormal|critical)\b(?!\s*:)",
            tail,
            re.IGNORECASE,
        )
        if status_match and not status:
            status = status_match.group(1)
        reference_range = _parse_reference_range(tail)
        unit = _extract_unit_from_tail(tail)
        return _result_item(
            term,
            value,
            unit,
            status,
            reference_range,
            source_text=line,
            reference_text=tail,
        )

    return None


def _detect_abnormal(structured_data: list[dict]) -> list[dict]:
    abnormal_statuses = {"high", "low", "borderline", "positive", "reactive", "abnormal", "critical"}
    return [
        item
        for item in structured_data
        if item.get("status") in abnormal_statuses
        and item.get("flag_source") in {"explicit_report_flag", "report_reference_range"}
    ]


# ── docx extraction ───────────────────────────────────────────────────────────

def _extract_from_docx(file_bytes: bytes) -> tuple[str, list[dict]]:
    """Extract text and table data from a Word document."""
    # docx2txt extracts all text including tables as plain text
    text = docx2txt.process(io.BytesIO(file_bytes))

    # Parse structured data from the extracted text using the same regex parser
    structured = _parse_structured_from_text(text)
    return text, structured


# ── Entry point ───────────────────────────────────────────────────────────────

def run_ocr(report: MedicalReport, file_bytes: bytes, db: Session, existing: OcrResult | None = None) -> OcrResult:
    """Read the file and save what was found. Pass the report's existing OcrResult to
    re-read it with the current parser (it is updated in place)."""
    text, structured_data, engine, status, error_message = extract(file_bytes, report.original_filename)

    ocr_result = existing or OcrResult(report_id=report.id)
    ocr_result.extracted_text = text
    ocr_result.structured_data = structured_data
    ocr_result.abnormal_values = _detect_abnormal(structured_data)
    ocr_result.status = status
    ocr_result.error_message = error_message
    ocr_result.parser_version = PARSER_VERSION
    ocr_result.ocr_engine = engine
    ocr_result.raw_text_length = len(text or "")
    ocr_result.structured_count = len(structured_data)
    if existing:
        ocr_result.processed_at = datetime.utcnow()
    db.add(ocr_result)
    db.commit()
    db.refresh(ocr_result)

    # Clean, normalised results for tables and trend charts (never fails the upload).
    from app.services.lab_results_service import ingest_safely
    ingest_safely(report, ocr_result, db)

    return ocr_result


def extract(file_bytes: bytes, filename: str) -> tuple[str, list[dict], str | None, str, str | None]:
    """Read a report file: (text, structured values, engine, status, error message).
    Used for uploads and by the accuracy evaluation, so both read files the same way."""
    ext = filename.rsplit(".", 1)[-1].lower()
    text = ""
    structured_data = []
    engine = None
    status = "failed"
    error_message = None

    try:
        if ext == "pdf":
            engine = "pdfplumber"
            text, structured_data, page_count = _extract_from_pdf_tables(file_bytes)
            if text and not structured_data:
                structured_data = _parse_structured_from_text(text)

            # Only scanned PDFs need OCR. When a real text layer exists, OCR cannot beat it,
            # so an empty result means the parser failed, not the text extraction.
            if not structured_data and not _has_text_layer(text, page_count):
                engine = "pdfplumber+tesseract"
                ocr = _extract_text_tesseract_pdf(file_bytes)
                ocr_structured = _parse_structured_from_text(ocr.text)
                _attach_ocr_confidence(ocr_structured, ocr.line_confidence)
                if ocr_structured or not text:
                    text = ocr.text
                    structured_data = ocr_structured
        elif ext in ("docx", "doc"):
            engine = "docx2txt"
            text, structured_data = _extract_from_docx(file_bytes)
        else:
            # Images: JPEG, PNG, TIFF
            engine = "tesseract"
            ocr = _extract_text_from_image(file_bytes)
            text = ocr.text
            structured_data = _parse_structured_from_text(text)
            _attach_ocr_confidence(structured_data, ocr.line_confidence)

        if structured_data:
            status = "completed"
        elif text.strip():
            status = "partial"
        else:
            status = "failed"
            error_message = "No text could be extracted from the report."
    except Exception as exc:
        logger.exception("OCR failed for %s", filename)
        status = "failed"
        error_message = str(exc)

    return text, structured_data, engine, status, error_message
