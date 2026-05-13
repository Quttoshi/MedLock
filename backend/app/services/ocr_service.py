import io
import re

import cv2
import docx2txt
import numpy as np
import pdfplumber
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ocr_result import OcrResult
from app.models.medical_report import MedicalReport

pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
_poppler_path = settings.POPPLER_PATH or None

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
}

# Keywords that indicate a row is a header or legend, not a test result
_SKIP_KEYWORDS = {
    "test", "result", "unit", "reference", "status", "range",
    "legend", "normal", "high", "low", "above", "below", "within",
    "parameter", "value", "description", "date", "name", "patient",
    "report", "laboratory", "doctor", "age", "gender", "sample",
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
                        if cell.strip().lower() in ("normal", "high", "low"):
                            status_from_pdf = cell.strip().lower()

                    if value is None:
                        continue

                    # Determine status from normal ranges or PDF status column
                    status = _determine_status(test_name, value, status_from_pdf)

                    structured.append({
                        "test": test_name.title(),
                        "value": value,
                        "unit": unit,
                        "status": status,
                    })

    return "\n".join(full_text_parts), structured


def _determine_status(test_name: str, value: float, pdf_status: str | None) -> str:
    """Check NORMAL_RANGES; fall back to PDF's own status column."""
    for key, (low, high) in NORMAL_RANGES.items():
        if key in test_name.lower():
            if value < low:
                return "low"
            if value > high:
                return "high"
            return "normal"
    # Fall back to what the PDF said
    if pdf_status:
        return pdf_status
    return "normal"


# ── Tesseract fallback for scanned/image PDFs and images ─────────────────────

def _preprocess_image(image: Image.Image) -> np.ndarray:
    img = np.array(image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def _extract_text_tesseract_pdf(file_bytes: bytes) -> str:
    images = convert_from_bytes(file_bytes, dpi=300, poppler_path=_poppler_path)
    texts = []
    for image in images:
        processed = _preprocess_image(image)
        text = pytesseract.image_to_string(processed, lang="eng")
        texts.append(text)
    return "\n".join(texts)


def _extract_text_from_image(file_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(file_bytes))
    processed = _preprocess_image(image)
    return pytesseract.image_to_string(processed, lang="eng")


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

    if ext == "pdf":
        text, structured_data = _extract_from_pdf_tables(file_bytes)
        # If pdfplumber found no tables (scanned PDF), fall back to Tesseract
        if not structured_data:
            text = _extract_text_tesseract_pdf(file_bytes)
            structured_data = _parse_structured_from_text(text)
    elif ext in ("docx", "doc"):
        text, structured_data = _extract_from_docx(file_bytes)
    else:
        # Images: JPEG, PNG
        text = _extract_text_from_image(file_bytes)
        structured_data = _parse_structured_from_text(text)

    abnormal_values = _detect_abnormal(structured_data)

    ocr_result = OcrResult(
        report_id=report.id,
        extracted_text=text,
        structured_data=structured_data,
        abnormal_values=abnormal_values,
    )
    db.add(ocr_result)
    db.commit()
    db.refresh(ocr_result)

    return ocr_result
