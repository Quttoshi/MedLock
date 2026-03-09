import io
import re

import cv2
import numpy as np
import pytesseract
import spacy
from pdf2image import convert_from_bytes
from PIL import Image
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ocr_result import OcrResult
from app.models.medical_report import MedicalReport

pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
_poppler_path = settings.POPPLER_PATH or None

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

# Normal ranges for common blood test values
NORMAL_RANGES = {
    "hemoglobin": (12.0, 17.5),
    "glucose": (70.0, 100.0),
    "cholesterol": (0.0, 200.0),
    "creatinine": (0.6, 1.2),
    "urea": (7.0, 20.0),
    "wbc": (4.0, 11.0),
    "rbc": (4.2, 5.9),
    "platelets": (150.0, 400.0),
    "sodium": (135.0, 145.0),
    "potassium": (3.5, 5.0),
}


def _preprocess_image(image: Image.Image) -> np.ndarray:
    img = np.array(image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    # Denoise and threshold for better OCR accuracy
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def _extract_text_from_pdf(file_bytes: bytes) -> str:
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


def _parse_structured_data(text: str) -> list[dict]:
    """Extract test name, value, unit from OCR text using regex."""
    pattern = re.compile(
        r"([A-Za-z][A-Za-z\s\-/]{1,30})\s+(\d+\.?\d*)\s*([a-zA-Z/%µ]+)?",
        re.MULTILINE,
    )
    results = []
    for match in pattern.finditer(text):
        name = match.group(1).strip().lower()
        value = float(match.group(2))
        unit = match.group(3) or ""
        results.append({"test": name, "value": value, "unit": unit})
    return results


def _detect_abnormal(structured_data: list[dict]) -> list[dict]:
    abnormal = []
    for item in structured_data:
        test = item["test"]
        value = item["value"]
        for key, (low, high) in NORMAL_RANGES.items():
            if key in test:
                if value < low or value > high:
                    abnormal.append({**item, "normal_range": f"{low}-{high}"})
                break
    return abnormal


def run_ocr(report: MedicalReport, file_bytes: bytes, db: Session) -> OcrResult:
    content_type = report.original_filename.rsplit(".", 1)[-1].lower()

    if content_type == "pdf":
        text = _extract_text_from_pdf(file_bytes)
    else:
        text = _extract_text_from_image(file_bytes)

    structured_data = _parse_structured_data(text)
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
