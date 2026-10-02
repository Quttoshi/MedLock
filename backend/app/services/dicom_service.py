"""Pure DICOM handling: validate uploads, read metadata, group series, render previews
and pack series for storage. No database or storage access, so it is easy to test."""
import io
import json
import posixpath
import zipfile
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

import numpy as np
import pydicom
from fastapi import HTTPException, status
from PIL import Image
from pydicom.dataset import Dataset
from pydicom.errors import InvalidDicomError

from app.config import settings
from app.services.encryption_service import sha256_hash

# Media Storage Directory (DICOMDIR): an index file, not a scan.
DICOMDIR_SOP_CLASS = "1.2.840.10008.1.3.10"
MANIFEST_VERSION = 1
# Projection radiography keeps fine detail, so its viewer slices are rendered larger.
XRAY_MODALITIES = {"CR", "DX", "MG", "RF", "XA", "PX", "IO"}


@dataclass
class DicomInstance:
    """One DICOM file from an upload: its bytes and its header (pixel data not loaded)."""
    data: bytes
    header: Dataset

    @property
    def sop_uid(self) -> str:
        return str(self.header.get("SOPInstanceUID", "")) or sha256_hash(self.data)

    @property
    def series_uid(self) -> str:
        return str(self.header.get("SeriesInstanceUID", "unknown-series"))

    @property
    def is_image(self) -> bool:
        return "Rows" in self.header and "Columns" in self.header


@dataclass
class ParsedUpload:
    instances: list[DicomInstance]
    skipped_files: int = 0
    study_uid: str = ""


@dataclass
class SeriesGroup:
    series_uid: str
    instances: list[DicomInstance] = field(default_factory=list)


def _bad_upload(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


# ── Parsing and validation ────────────────────────────────────────────────────

def parse_upload(filename: str, data: bytes) -> ParsedUpload:
    """Validate a .dcm or .zip upload and read every DICOM header in it.
    Raises a 400 error describing the problem when the upload is unusable."""
    name = (filename or "").lower()
    if name.endswith(".zip"):
        candidates, skipped = _zip_members(data)
    elif name.endswith((".dcm", ".dicom")) or "." not in posixpath.basename(name):
        candidates, skipped = [data], 0
    else:
        raise _bad_upload("Upload a DICOM file (.dcm) or a .zip containing a DICOM study.")

    instances: dict[str, DicomInstance] = {}
    for raw in candidates:
        instance = _read_instance(raw)
        if instance is None:
            skipped += 1
            continue
        instances.setdefault(instance.sop_uid, instance)  # ignore exact duplicates

    if not instances:
        raise _bad_upload("No valid DICOM files were found in this upload.")
    if not any(i.is_image for i in instances.values()):
        raise _bad_upload("The upload contains DICOM files but no images.")

    study_uids = {str(i.header.get("StudyInstanceUID", "")) for i in instances.values()}
    study_uids.discard("")
    if len(study_uids) > 1:
        raise _bad_upload("The upload contains more than one imaging study. Upload one study at a time.")
    if not study_uids:
        raise _bad_upload("The DICOM files do not identify their study (missing StudyInstanceUID).")

    return ParsedUpload(list(instances.values()), skipped, study_uids.pop())


def _zip_members(data: bytes) -> tuple[list[bytes], int]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise _bad_upload("The .zip file is damaged or not a zip archive.")

    files = [info for info in archive.infolist() if not info.is_dir()]
    if len(files) > settings.IMAGING_MAX_FILES:
        raise _bad_upload(f"The .zip contains more than {settings.IMAGING_MAX_FILES} files.")
    if sum(info.file_size for info in files) > settings.IMAGING_MAX_UNPACKED_MB * 1024 * 1024:
        raise _bad_upload(f"The .zip unpacks to more than {settings.IMAGING_MAX_UNPACKED_MB} MB.")

    members, skipped = [], 0
    for info in files:
        path = info.filename.replace("\\", "/")
        if path.startswith("/") or ".." in path.split("/") or ":" in path.split("/")[0]:
            raise _bad_upload("The .zip contains unsafe file paths.")
        base = posixpath.basename(path)
        if path.startswith("__MACOSX/") or base.startswith("."):
            skipped += 1
            continue
        members.append(archive.read(info))
    return members, skipped


def _read_instance(raw: bytes) -> Optional[DicomInstance]:
    try:
        # Strict read (no force=True): anything that is not a proper DICOM file is skipped.
        header = pydicom.dcmread(io.BytesIO(raw), stop_before_pixels=True)
    except InvalidDicomError:
        return None
    except Exception:
        return None  # truncated or corrupt file
    sop_class = str(getattr(getattr(header, "file_meta", None), "MediaStorageSOPClassUID", ""))
    if sop_class == DICOMDIR_SOP_CLASS or "DirectoryRecordSequence" in header:
        return None
    return DicomInstance(data=raw, header=header)


# ── Metadata ──────────────────────────────────────────────────────────────────

def text(ds: Dataset, keyword: str) -> Optional[str]:
    value = ds.get(keyword)
    if value is None or value == "":
        return None
    return str(value).strip() or None


def number(ds: Dataset, keyword: str) -> Optional[float]:
    value = ds.get(keyword)
    if value is None or value == "":
        return None
    if isinstance(value, (list, tuple)) or hasattr(value, "__len__") and not isinstance(value, str):
        value = value[0] if len(value) else None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def dicom_date(ds: Dataset, keyword: str) -> Optional[date]:
    value = text(ds, keyword)
    if not value or len(value) < 8:
        return None
    try:
        return date(int(value[:4]), int(value[4:6]), int(value[6:8]))
    except ValueError:
        return None


def group_series(instances: list[DicomInstance]) -> list[SeriesGroup]:
    groups: dict[str, SeriesGroup] = {}
    for instance in instances:
        groups.setdefault(instance.series_uid, SeriesGroup(instance.series_uid)).instances.append(instance)
    for group in groups.values():
        group.instances.sort(key=_instance_order)
    return sorted(groups.values(), key=lambda g: (number(g.instances[0].header, "SeriesNumber") or 0, g.series_uid))


def _instance_order(instance: DicomInstance) -> tuple:
    position = instance.header.get("ImagePositionPatient")
    z = float(position[2]) if position and len(position) == 3 else 0.0
    return (number(instance.header, "InstanceNumber") or 0, z)


def study_metadata(parsed: ParsedUpload) -> dict:
    images = [i for i in parsed.instances if i.is_image] or parsed.instances
    first = images[0].header
    modalities = sorted({text(i.header, "Modality") for i in images} - {None})
    return {
        "study_uid": parsed.study_uid,
        "modality": ", ".join(modalities) or None,
        "body_part": text(first, "BodyPartExamined"),
        "study_date": dicom_date(first, "StudyDate") or dicom_date(first, "SeriesDate"),
        "study_description": text(first, "StudyDescription"),
        "institution": text(first, "InstitutionName"),
        "manufacturer": text(first, "Manufacturer"),
        "series_count": len({i.series_uid for i in parsed.instances}),
        "instance_count": len(parsed.instances),
    }


def series_metadata(group: SeriesGroup) -> dict:
    first = group.instances[0].header
    spacing = first.get("PixelSpacing")
    is_mr = text(first, "Modality") == "MR"
    return {
        "series_uid": group.series_uid,
        "series_number": int(number(first, "SeriesNumber")) if number(first, "SeriesNumber") is not None else None,
        "modality": text(first, "Modality"),
        "description": text(first, "SeriesDescription"),
        "body_part": text(first, "BodyPartExamined"),
        "instance_count": len(group.instances),
        "rows": int(first.Rows) if "Rows" in first else None,
        "columns": int(first.Columns) if "Columns" in first else None,
        "slice_thickness_mm": number(first, "SliceThickness"),
        "pixel_spacing_mm": [float(s) for s in spacing] if spacing and len(spacing) == 2 else None,
        "sequence_name": (text(first, "SequenceName") or text(first, "ScanningSequence")) if is_mr else None,
        "magnetic_field_strength_t": number(first, "MagneticFieldStrength") if is_mr else None,
        "repetition_time_ms": number(first, "RepetitionTime") if is_mr else None,
        "echo_time_ms": number(first, "EchoTime") if is_mr else None,
        "contrast_agent": text(first, "ContrastBolusAgent"),
    }


# ── Previews ──────────────────────────────────────────────────────────────────

def render_preview(group: SeriesGroup) -> Optional[bytes]:
    """PNG of the middle image of a series, or None when it has no decodable image."""
    images = [i for i in group.instances if i.is_image]
    if not images:
        return None
    middle = images[len(images) // 2]
    try:
        ds = pydicom.dcmread(io.BytesIO(middle.data))
        frames = _frames(ds)
        image = _to_image(ds, frames[len(frames) // 2])
    except Exception:
        return None
    image.thumbnail((settings.IMAGING_PREVIEW_MAX_PX, settings.IMAGING_PREVIEW_MAX_PX))
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def render_slices(group: SeriesGroup) -> list[bytes]:
    """Every slice of a series (each frame of multi-frame files) as a JPEG, in scan order,
    for the slice viewer. Images that cannot be decoded are skipped."""
    modality = text(group.instances[0].header, "Modality")
    max_px = settings.IMAGING_SLICE_MAX_PX_XRAY if modality in XRAY_MODALITIES else settings.IMAGING_SLICE_MAX_PX
    slices = []
    for instance in group.instances:
        if not instance.is_image:
            continue
        try:
            ds = pydicom.dcmread(io.BytesIO(instance.data))
            frames = _frames(ds)
        except Exception:
            continue
        for frame in frames:
            try:
                image = _to_image(ds, frame)
            except Exception:
                continue
            image.thumbnail((max_px, max_px))
            out = io.BytesIO()
            image.convert("RGB" if image.mode not in ("L", "RGB") else image.mode).save(
                out, format="JPEG", quality=settings.IMAGING_SLICE_JPEG_QUALITY,
            )
            slices.append(out.getvalue())
    return slices


def pack_slices(slices: list[bytes]) -> bytes:
    """Zip of numbered JPEGs; already compressed, so stored without re-compression."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        for index, data in enumerate(slices, start=1):
            archive.writestr(f"{index:05d}.jpg", data)
    return buffer.getvalue()


def _frames(ds: Dataset) -> list[np.ndarray]:
    pixels = ds.pixel_array
    if int(number(ds, "NumberOfFrames") or 1) > 1:
        return list(pixels)
    return [pixels]


def _to_image(ds: Dataset, pixels: np.ndarray) -> Image.Image:
    if pixels.ndim == 3 and pixels.shape[-1] in (3, 4):  # colour image
        return Image.fromarray(_scale_to_uint8(pixels.astype(np.float64), *_percentile_window(pixels)))

    values = pixels.astype(np.float64) * (number(ds, "RescaleSlope") or 1.0) + (number(ds, "RescaleIntercept") or 0.0)
    center, width = number(ds, "WindowCenter"), number(ds, "WindowWidth")
    if center is not None and width and width > 1:
        low, high = center - width / 2, center + width / 2
    else:
        # MRI and some scans have no display window: use the image's own brightness range.
        low, high = _percentile_window(values)
    gray = _scale_to_uint8(values, low, high)
    if text(ds, "PhotometricInterpretation") == "MONOCHROME1":
        gray = 255 - gray
    return Image.fromarray(gray)


def _percentile_window(values: np.ndarray) -> tuple[float, float]:
    low, high = np.percentile(values, [1, 99])
    return float(low), float(high if high > low else low + 1)


def _scale_to_uint8(values: np.ndarray, low: float, high: float) -> np.ndarray:
    scaled = (np.clip(values, low, high) - low) / (high - low) * 255.0
    return scaled.astype(np.uint8)


# ── Packing for storage ───────────────────────────────────────────────────────

def pack_series(group: SeriesGroup) -> tuple[bytes, list[dict]]:
    """Zip a series' files (named by SOPInstanceUID) and list each file with its hash."""
    buffer = io.BytesIO()
    files = []
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for instance in group.instances:
            name = f"{instance.sop_uid}.dcm"
            archive.writestr(name, instance.data)
            files.append({"name": name, "sha256": sha256_hash(instance.data)})
    return buffer.getvalue(), files


def split_parts(data: bytes) -> list[bytes]:
    size = max(1, int(settings.IMAGING_PART_MAX_MB * 1024 * 1024))
    return [data[i:i + size] for i in range(0, len(data), size)] or [b""]


def manifest_bytes(manifest: dict) -> bytes:
    """Canonical JSON, so the same manifest always hashes the same."""
    return json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
