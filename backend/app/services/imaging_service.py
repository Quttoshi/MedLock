"""Imaging (DICOM) studies: upload, background processing, storage, download and integrity.

Upload (fast, in the request): validate, read headers, reject duplicates, and stage the
upload encrypted on local disk. Processing (after the response, or by the periodic job):
render previews, pack and encrypt each series in parts, upload them with an encrypted
manifest, then record the manifest's hash on the blockchain.
"""
import io
import json
import logging
import os
import uuid
import zipfile
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.imaging import ImagingSeries, ImagingStudy
from app.models.medical_center import MedicalCenter
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.services import dicom_service
from app.services.blockchain_service import log_event as blockchain_log
from app.services.encryption_service import decrypt_file, encrypt_file, sha256_hash
from app.services.notification_service import create_notification
from app.services.storage_service import delete_file, download_file, upload_file

logger = logging.getLogger(__name__)

IMAGING_REPORT_TYPE = "imaging"
# A study left "processing" this long was interrupted (e.g. a restart) and is retried.
STALE_PROCESSING_AFTER = timedelta(minutes=30)
PENDING_HASH = "pending"
# slice_count value for a series whose viewer slices could not be rendered
SLICES_UNAVAILABLE = -1

# DICOM modality codes in plain language, for notifications
MODALITY_NAMES = {
    "CT": "CT scan",
    "MR": "MRI scan",
    "DX": "X-ray",
    "CR": "X-ray",
    "US": "ultrasound",
    "MG": "mammogram",
    "PT": "PET scan",
    "NM": "nuclear medicine scan",
    "XA": "angiogram",
    "RF": "fluoroscopy study",
}


def is_imaging(report: MedicalReport) -> bool:
    return report.report_type == IMAGING_REPORT_TYPE


# ── Upload ────────────────────────────────────────────────────────────────────

def create_imaging_upload(
    file: UploadFile,
    patient: Patient,
    db: Session,
    medical_center: Optional[MedicalCenter] = None,
) -> MedicalReport:
    """Validate and stage an upload. Processing happens afterwards (see process_study)."""
    data = _read_limited(file)
    parsed = dicom_service.parse_upload(file.filename or "", data)

    # A study that failed processing does not count, so it can be uploaded again.
    duplicate = db.query(ImagingStudy).join(MedicalReport).filter(
        MedicalReport.patient_id == patient.id,
        ImagingStudy.study_uid == parsed.study_uid,
        ImagingStudy.processing_status != "failed",
    ).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This imaging study has already been uploaded")

    report_id = uuid.uuid4()
    staging_path, staging_key_ref = _stage(report_id, data)

    report = MedicalReport(
        id=report_id,
        patient_id=patient.id,
        medical_center_id=medical_center.id if medical_center else None,
        original_filename=file.filename or "study.zip",
        report_type=IMAGING_REPORT_TYPE,
        # Set to the manifest's path, key and hash once processing finishes.
        file_url=_storage_prefix(patient.id, report_id) + "manifest.enc",
        encryption_key_ref="",
        file_hash_sha256=PENDING_HASH,
        upload_source="medical_center" if medical_center else "patient",
        is_approved=medical_center is None,
    )
    db.add(report)
    db.add(ImagingStudy(
        report_id=report_id,
        processing_status="pending",
        staging_path=staging_path,
        staging_key_ref=staging_key_ref,
        **{k: v for k, v in dicom_service.study_metadata(parsed).items()},
    ))
    try:
        db.commit()
    except Exception:
        db.rollback()
        _remove_staging(staging_path)
        raise
    db.refresh(report)
    return report


def _read_limited(file: UploadFile) -> bytes:
    limit = settings.IMAGING_MAX_UPLOAD_MB * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Imaging uploads must not exceed {settings.IMAGING_MAX_UPLOAD_MB} MB",
        )
    return data


def _staging_dir() -> str:
    os.makedirs(settings.IMAGING_STAGING_DIR, exist_ok=True)
    return settings.IMAGING_STAGING_DIR


def _stage(report_id: uuid.UUID, data: bytes) -> tuple[str, str]:
    """Keep the upload on local disk until processed, encrypted like everything else."""
    encrypted, key_ref = encrypt_file(data)
    path = os.path.join(_staging_dir(), f"{report_id}.enc")
    with open(path, "wb") as f:
        f.write(encrypted)
    return path, key_ref


def _remove_staging(path: Optional[str]) -> None:
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            logger.exception("Could not remove staged upload %s", path)


def _storage_prefix(patient_id, report_id) -> str:
    return f"{patient_id}/imaging/{report_id}/"


# ── Processing ────────────────────────────────────────────────────────────────

def process_study_by_id(study_id) -> None:
    """Entry point for the post-upload background task; uses its own session."""
    db = SessionLocal()
    try:
        process_study(study_id, db)
    finally:
        db.close()


def process_pending_studies(db: Session) -> int:
    """Periodic job: process studies still waiting, including interrupted ones."""
    stale = datetime.utcnow() - STALE_PROCESSING_AFTER
    db.execute(
        update(ImagingStudy)
        .where(ImagingStudy.processing_status == "processing", ImagingStudy.processing_started_at < stale)
        .values(processing_status="pending")
    )
    db.commit()
    ids = [row.id for row in db.query(ImagingStudy.id).filter(ImagingStudy.processing_status == "pending").all()]
    for study_id in ids:
        process_study(study_id, db)
    return len(ids)


def _claim(study_id, db: Session) -> bool:
    """Atomically move pending -> processing, so a study is never processed twice."""
    result = db.execute(
        update(ImagingStudy)
        .where(ImagingStudy.id == study_id, ImagingStudy.processing_status == "pending")
        .values(
            processing_status="processing",
            processing_started_at=datetime.utcnow(),
            processing_attempts=ImagingStudy.processing_attempts + 1,
        )
    )
    db.commit()
    return result.rowcount == 1


def process_study(study_id, db: Session) -> None:
    if not _claim(study_id, db):
        return
    study = db.query(ImagingStudy).filter(ImagingStudy.id == study_id).first()
    report = study.medical_report
    uploaded_paths: list[str] = []
    try:
        with open(study.staging_path, "rb") as f:
            data = decrypt_file(f.read(), study.staging_key_ref)
        parsed = dicom_service.parse_upload(report.original_filename, data)
        manifest = _store_series(study, report, parsed, uploaded_paths, db)

        manifest_raw = dicom_service.manifest_bytes(manifest)
        encrypted_manifest, manifest_key_ref = encrypt_file(manifest_raw)
        upload_file(encrypted_manifest, report.file_url)
        uploaded_paths.append(report.file_url)

        report.encryption_key_ref = manifest_key_ref
        report.file_hash_sha256 = sha256_hash(manifest_raw)
        study.processing_status = "completed"
        study.processing_error = None
        study.processed_at = datetime.utcnow()
        staging_path, study.staging_path, study.staging_key_ref = study.staging_path, None, None
        db.commit()
        _remove_staging(staging_path)
    except Exception as exc:
        db.rollback()
        logger.exception("Processing failed for imaging study %s", study_id)
        _handle_failure(study_id, exc, uploaded_paths, db)
        return

    try:
        blockchain_log(report.id, report.file_hash_sha256, "upload", db)
    except Exception:
        logger.exception("Could not log imaging upload %s to the blockchain", report.id)
    _notify_processed(report, study, db)


def _store_series(study: ImagingStudy, report: MedicalReport, parsed, uploaded_paths: list[str], db: Session) -> dict:
    prefix = _storage_prefix(report.patient_id, report.id)
    db.query(ImagingSeries).filter(ImagingSeries.study_id == study.id).delete()  # clean slate on retry
    manifest = {
        "version": dicom_service.MANIFEST_VERSION,
        "report_id": str(report.id),
        "study_uid": parsed.study_uid,
        "series": [],
    }
    for index, group in enumerate(dicom_service.group_series(parsed.instances), start=1):
        packed, files = dicom_service.pack_series(group)
        parts = []
        for part_number, chunk in enumerate(dicom_service.split_parts(packed), start=1):
            encrypted, key_ref = encrypt_file(chunk)
            path = f"{prefix}series-{index}-part-{part_number}.enc"
            upload_file(encrypted, path)
            uploaded_paths.append(path)
            parts.append({"path": path, "key_ref": key_ref, "sha256": sha256_hash(chunk)})

        preview_path = preview_key_ref = None
        preview = dicom_service.render_preview(group)
        if preview:
            encrypted, preview_key_ref = encrypt_file(preview)
            preview_path = f"{prefix}series-{index}-preview.enc"
            upload_file(encrypted, preview_path, content_type="application/octet-stream")
            uploaded_paths.append(preview_path)

        slice_count, slice_parts = _store_slice_stack(group, f"{prefix}series-{index}", uploaded_paths)

        meta = dicom_service.series_metadata(group)
        db.add(ImagingSeries(
            study_id=study.id,
            part_paths=[p["path"] for p in parts],
            preview_path=preview_path,
            preview_key_ref=preview_key_ref,
            slice_count=slice_count,
            slice_stack_parts=slice_parts,
            **meta,
        ))
        manifest["series"].append({"series_uid": group.series_uid, "files": files, "parts": parts})

    study.series_count = len(manifest["series"])
    study.instance_count = len(parsed.instances)
    return manifest


def _store_slice_stack(group, path_stem: str, uploaded_paths: list[str]) -> tuple[int, list[dict]]:
    """Render every slice for the viewer, then store them zipped and encrypted in parts."""
    slices = dicom_service.render_slices(group)
    if not slices:
        return 0, []
    parts = []
    for number, chunk in enumerate(dicom_service.split_parts(dicom_service.pack_slices(slices)), start=1):
        encrypted, key_ref = encrypt_file(chunk)
        path = f"{path_stem}-slices-{number}.enc"
        upload_file(encrypted, path)
        uploaded_paths.append(path)
        parts.append({"path": path, "key_ref": key_ref, "sha256": sha256_hash(chunk)})
    return len(slices), parts


def backfill_slice_stacks(db: Session, limit: int = 1) -> int:
    """Periodic job: render viewer slices for series processed before the viewer existed.
    Works through a few series per run, since rebuilding them means decrypting the originals."""
    pending = (
        db.query(ImagingSeries)
        .join(ImagingStudy)
        .filter(
            ImagingStudy.processing_status == "completed",
            ImagingSeries.slice_count == 0,
            ImagingSeries.preview_path.isnot(None),  # has images (non-image series never get slices)
        )
        .limit(limit)
        .all()
    )
    for series in pending:
        report = series.study.medical_report
        uploaded: list[str] = []
        try:
            manifest_series = next(m for m in load_manifest(report)["series"] if m["series_uid"] == series.series_uid)
            packed = b"".join(_read_part(part) for part in manifest_series["parts"])
            with zipfile.ZipFile(io.BytesIO(packed)) as archive:
                instances = [dicom_service._read_instance(archive.read(name)) for name in archive.namelist()]
            group = dicom_service.group_series([i for i in instances if i is not None])[0]
            index = series.preview_path.rsplit("series-", 1)[1].split("-", 1)[0]
            stem = f"{_storage_prefix(report.patient_id, report.id)}series-{index}"
            count, series.slice_stack_parts = _store_slice_stack(group, stem, uploaded)
            series.slice_count = count or SLICES_UNAVAILABLE
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Could not backfill viewer slices for series %s", series.id)
            for path in uploaded:
                try:
                    delete_file(path)
                except Exception:
                    pass
            # Don't retry every run: the viewer falls back to the preview for this series.
            series.slice_count = SLICES_UNAVAILABLE
            db.commit()
    return len(pending)


def _handle_failure(study_id, exc: Exception, uploaded_paths: list[str], db: Session) -> None:
    for path in uploaded_paths:
        try:
            delete_file(path)
        except Exception:
            logger.exception("Could not clean up %s after failed processing", path)

    study = db.query(ImagingStudy).filter(ImagingStudy.id == study_id).first()
    if not study:
        return
    study.processing_error = str(exc)[:500]
    retry = study.processing_attempts < settings.IMAGING_MAX_PROCESSING_ATTEMPTS and not isinstance(exc, HTTPException)
    study.processing_status = "pending" if retry else "failed"
    db.commit()
    if not retry:
        _remove_staging(study.staging_path)
        _notify_failed(study.medical_report, db)


def study_label(study: ImagingStudy) -> str:
    """Plain-language name for a study's modality, e.g. "DX" -> "X-ray"."""
    for code in (study.modality or "").split(","):
        name = MODALITY_NAMES.get(code.strip())
        if name:
            return name
    return "imaging study"


def _study_summary(report: MedicalReport, study: ImagingStudy) -> str:
    count = study.instance_count
    return f"{study_label(study)} '{report.original_filename}' ({count} image{'' if count == 1 else 's'})"


def _notify_processed(report: MedicalReport, study: ImagingStudy, db: Session) -> None:
    summary = _study_summary(report, study)
    try:
        create_notification(
            db, report.patient.user_id, "imaging_processed",
            f"Your {summary} has been securely encrypted and added to your medical records. "
            "You can now view its images in MedLock."
            if report.upload_source == "patient"
            else f"{report.medical_center.name} has uploaded your {summary}. "
            "Please review it and approve it to add it to your medical records.",
            link=f"/patient/reports/{report.id}",
        )
        if report.medical_center:
            create_notification(
                db, report.medical_center.user_id, "imaging_processed",
                f"The {summary} you uploaded for {report.patient.user.full_name} has been processed "
                "and is awaiting the patient's approval.",
            )
    except Exception:
        logger.exception("Could not send imaging processed notifications for report %s", report.id)


def _notify_failed(report: MedicalReport, db: Session) -> None:
    uploader = report.medical_center.user_id if report.medical_center else report.patient.user_id
    try:
        create_notification(
            db, uploader, "imaging_processing_failed",
            f"We could not process the imaging study '{report.original_filename}'. Please check that it is "
            "a valid DICOM file or study and upload it again.",
        )
    except Exception:
        logger.exception("Could not send imaging failure notification for report %s", report.id)


# ── Reading stored studies ────────────────────────────────────────────────────

def load_manifest(report: MedicalReport) -> dict:
    raw = decrypt_file(download_file(report.file_url), report.encryption_key_ref)
    return json.loads(raw)


def read_preview(series: ImagingSeries) -> Optional[bytes]:
    if not series.preview_path:
        return None
    return decrypt_file(download_file(series.preview_path), series.preview_key_ref)


def read_slice_stack(series: ImagingSeries) -> Optional[bytes]:
    """The series' viewer slices as a zip of numbered JPEGs, or None if not rendered."""
    if not series.slice_stack_parts:
        return None
    return b"".join(_read_part(part) for part in series.slice_stack_parts)


def build_study_archive(report: MedicalReport) -> bytes:
    """Rebuild the original DICOM files as one .zip with a folder per series."""
    manifest = load_manifest(report)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for index, series in enumerate(manifest["series"], start=1):
            packed = b"".join(_read_part(part) for part in series["parts"])
            with zipfile.ZipFile(io.BytesIO(packed)) as series_zip:
                for name in series_zip.namelist():
                    archive.writestr(f"series-{index}/{name}", series_zip.read(name))
    return output.getvalue()


def _read_part(part: dict) -> bytes:
    data = decrypt_file(download_file(part["path"]), part["key_ref"])
    if sha256_hash(data) != part["sha256"]:
        raise ValueError(f"Stored part {part['path']} does not match its manifest hash")
    return data


def check_stored_parts(report: MedicalReport) -> dict:
    """Integrity check for imaging: every stored part decrypts and matches the manifest."""
    check = {"check": "stored_parts", "label": "All stored image files match the manifest", "passed": False}
    try:
        manifest = load_manifest(report)
        parts = [part for series in manifest["series"] for part in series["parts"]]
        file_count = sum(len(series["files"]) for series in manifest["series"])
        for part in parts:
            _read_part(part)
    except ValueError as exc:
        check["detail"] = f"A stored part was modified: {exc}"
        return check
    except Exception as exc:
        check["detail"] = f"The stored parts could not be read: {exc}"
        return check
    check["passed"] = True
    check["label"] = f"All {file_count} image files ({len(parts)} stored parts) match the manifest"
    return check


def delete_study_files(report: MedicalReport) -> None:
    """Remove everything stored for an imaging report (parts, previews, manifest, staging)."""
    study = report.imaging_study
    paths = [report.file_url]
    if study:
        for series in study.series:
            paths.extend(series.part_paths or [])
            paths.extend(part["path"] for part in (series.slice_stack_parts or []))
            if series.preview_path:
                paths.append(series.preview_path)
        _remove_staging(study.staging_path)
    for path in paths:
        try:
            delete_file(path)
        except Exception:
            logger.exception("Could not delete stored imaging file %s", path)


# ── API responses ─────────────────────────────────────────────────────────────

def study_response(report: MedicalReport) -> dict:
    study = report.imaging_study
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This report is not an imaging study")
    return {
        "report_id": str(report.id),
        "original_filename": report.original_filename,
        "processing_status": study.processing_status,
        "processing_error": study.processing_error if study.processing_status == "failed" else None,
        "modality": study.modality,
        "body_part": study.body_part,
        "study_date": study.study_date,
        "study_description": study.study_description,
        "institution": study.institution,
        "manufacturer": study.manufacturer,
        "series_count": study.series_count,
        "instance_count": study.instance_count,
        "processed_at": study.processed_at,
        "series": [
            {
                "id": str(s.id),
                "series_number": s.series_number,
                "modality": s.modality,
                "description": s.description,
                "body_part": s.body_part,
                "instance_count": s.instance_count,
                "rows": s.rows,
                "columns": s.columns,
                "slice_thickness_mm": s.slice_thickness_mm,
                "pixel_spacing_mm": s.pixel_spacing_mm,
                "sequence_name": s.sequence_name,
                "magnetic_field_strength_t": s.magnetic_field_strength_t,
                "repetition_time_ms": s.repetition_time_ms,
                "echo_time_ms": s.echo_time_ms,
                "contrast_agent": s.contrast_agent,
                "has_preview": bool(s.preview_path),
                "slice_count": max(s.slice_count, 0),
            }
            for s in study.series
        ],
    }


def find_series(report: MedicalReport, series_id: str) -> ImagingSeries:
    study = report.imaging_study
    series = next((s for s in (study.series if study else []) if str(s.id) == series_id), None)
    if not series:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Series not found")
    return series
