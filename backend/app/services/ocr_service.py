import io
import logging
import re

import cv2
import docx2txt
import numpy as np
import pdfplumber
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image, ImageEnhance, ImageOps
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ocr_result import OcrResult
from app.models.medical_report import MedicalReport

pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
_poppler_path = settings.POPPLER_PATH or None
logger = logging.getLogger(__name__)
PARSER_VERSION = "medical-ocr-v2"

NORMAL_RANGES = {
    "hemoglobin":   (12.0, 17.5),
    "glucose":      (70.0, 100.0),
    "cholesterol":  (0.0, 200.0),
    "creatinine":   (0.6, 1.2),
    "urea":         (7.0, 20.0),
    "wbc":          (4.0, 11.0),
    "rbc":          (4.2, 5.9),
    "platelets":    (150.0, 400.0),
    "sodium":       (136.0, 145.0),
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
    "sodium":       (135.0, 146.0),
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

def _extract_from_pdf_tables(file_bytes: bytes) -> tuple[str, list[dict]]:
    """
    Use pdfplumber to extract tables directly from the PDF text layer.
    Returns (full_text, structured_data).
    """
    full_text_parts = []
    structured = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
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

    return "\n".join(full_text_parts), structured


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
        r"(?P<unit>cells/cumm|mill/[ce]mm|/cumm|mg/dl|gm/dl|g/dl|mmol/l|mmo\s*/?\s*l?|u/l|mmhg|vol%|fl|pg|pe|%)",
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
    return item


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


def _ocr_image_to_text(image: Image.Image) -> str:
    variants = _image_ocr_variants(image)
    scored = []
    for name, variant, config in variants:
        text = pytesseract.image_to_string(variant, lang="eng", config=config)
        scored.append((_score_ocr_text(text), name, text))

    scored.sort(reverse=True, key=lambda item: item[0])
    logger.debug("Selected OCR variant %s with score %s", scored[0][1], scored[0][0])
    return scored[0][2]


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


def _extract_text_tesseract_pdf(file_bytes: bytes) -> str:
    images = convert_from_bytes(file_bytes, dpi=300, poppler_path=_poppler_path)
    texts = []
    for image in images:
        texts.append(_ocr_image_to_text(image))
    return "\n".join(texts)


def _extract_text_from_image(file_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(file_bytes))
    return _ocr_image_to_text(image)


def _parse_structured_from_text(text: str) -> list[dict]:
    """Regex fallback parser for Tesseract text output."""
    pattern = re.compile(
        r"^([A-Za-z][A-Za-z\s\-/]{1,25}?)\s{2,}(\d+\.?\d*)\s*([a-zA-Z/%µ³]+)?",
        re.MULTILINE,
    )
    results = []
    for match in pattern.finditer(text):
        name = match.group(1).strip()
        if any(kw in name.lower() for kw in _SKIP_KEYWORDS):
            continue
        value = float(match.group(2))
        unit = match.group(3) or ""
        status = _determine_status(name, value, None)
        results.append({"test": name.title(), "value": value, "unit": unit, "status": status})
    return results


def _detect_abnormal(structured_data: list[dict]) -> list[dict]:
    return [item for item in structured_data if item.get("status") in ("high", "low")]


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


def _normalize_ocr_line(line: str) -> str:
    line = line.replace("|", " ")
    line = line.replace("*", "")
    line = line.replace("↓", " low ")
    line = line.replace("↑", " high ")
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
    for term in KNOWN_TEST_TERMS:
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

def run_ocr(report: MedicalReport, file_bytes: bytes, db: Session) -> OcrResult:
    ext = report.original_filename.rsplit(".", 1)[-1].lower()
    text = ""
    structured_data = []
    engine = None
    status = "failed"
    error_message = None

    try:
        if ext == "pdf":
            engine = "pdfplumber"
            text, structured_data = _extract_from_pdf_tables(file_bytes)
            if text and not structured_data:
                structured_data = _parse_structured_from_text(text)

            # If the PDF has no useful text layer or parser output, fall back to OCR.
            if not structured_data:
                engine = "pdfplumber+tesseract"
                ocr_text = _extract_text_tesseract_pdf(file_bytes)
                ocr_structured = _parse_structured_from_text(ocr_text)
                if ocr_structured or not text:
                    text = ocr_text
                    structured_data = ocr_structured
        elif ext in ("docx", "doc"):
            engine = "docx2txt"
            text, structured_data = _extract_from_docx(file_bytes)
        else:
            # Images: JPEG, PNG
            engine = "tesseract"
            text = _extract_text_from_image(file_bytes)
            structured_data = _parse_structured_from_text(text)

        if structured_data:
            status = "completed"
        elif text.strip():
            status = "partial"
        else:
            status = "failed"
            error_message = "No text could be extracted from the report."
    except Exception as exc:
        logger.exception("OCR failed for report %s", report.id)
        status = "failed"
        error_message = str(exc)

    abnormal_values = _detect_abnormal(structured_data)

    ocr_result = OcrResult(
        report_id=report.id,
        extracted_text=text,
        structured_data=structured_data,
        abnormal_values=abnormal_values,
        status=status,
        error_message=error_message,
        parser_version=PARSER_VERSION,
        ocr_engine=engine,
        raw_text_length=len(text or ""),
        structured_count=len(structured_data),
    )
    db.add(ocr_result)
    db.commit()
    db.refresh(ocr_result)

    return ocr_result
