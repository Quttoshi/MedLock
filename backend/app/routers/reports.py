import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.medical_report import MedicalReport
from app.models.ocr_result import OcrResult
from app.models.patient import Patient
from app.models.user import User
from app.schemas.report import ReportResponse
from app.services.audit_service import log_action
from app.services.encryption_service import decrypt_file
from app.services.report_service import get_my_reports, upload_report
from app.services.storage_service import get_supabase, BUCKET_NAME
from app.services.blockchain_service import confirm_log
from app.models.blockchain_log import BlockchainLog

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/upload", response_model=ReportResponse, status_code=201)
def upload(
    file: UploadFile = File(...),
    report_type: str = Form(...),
    request: Request = None,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    report = upload_report(file, report_type, current_user, db)
    log_action(
        db,
        action="report_upload",
        performed_by=current_user.id,
        entity_type="medical_report",
        entity_id=report.id,
        details={"report_type": report_type, "filename": file.filename},
        request=request,
    )
    return report


@router.get("/my", response_model=List[ReportResponse])
def my_reports(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    return get_my_reports(current_user, db)


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: str,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Download encrypted bytes from Supabase Storage
    client = get_supabase()
    encrypted_bytes = client.storage.from_(BUCKET_NAME).download(report.file_url)

    # Decrypt back to original file
    original_bytes = decrypt_file(encrypted_bytes, report.encryption_key_ref)

    # Determine content type from filename
    filename = report.original_filename
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_type_map = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
    }
    content_type = content_type_map.get(ext, "application/octet-stream")

    return Response(
        content=original_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{report_id}/ocr")
def get_report_ocr(
    report_id: str,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    ocr = db.query(OcrResult).filter(OcrResult.report_id == report.id).first()
    if not ocr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR data not available for this report")
    return {
        "extracted_text": ocr.extracted_text,
        "structured_data": ocr.structured_data,
        "abnormal_values": ocr.abnormal_values,
        "status": ocr.status,
        "error_message": ocr.error_message,
        "parser_version": ocr.parser_version,
        "ocr_engine": ocr.ocr_engine,
        "raw_text_length": ocr.raw_text_length,
        "structured_count": ocr.structured_count,
        "processed_at": ocr.processed_at,
    }


@router.get("/{report_id}/blockchain")
def get_blockchain_logs(
    report_id: str,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    logs = db.query(BlockchainLog).filter(BlockchainLog.report_id == report.id).order_by(BlockchainLog.created_at).all()
    return [
        {
            "id": str(log.id),
            "event_type": log.event_type,
            "file_hash": log.file_hash,
            "transaction_hash": log.transaction_hash,
            "block_number": log.block_number,
            "network": log.network,
            "status": log.status,
            "created_at": log.created_at,
        }
        for log in logs
    ]


@router.patch("/{report_id}/approve")
def approve_report(
    report_id: str,
    request: Request = None,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if report.is_approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Report is already approved")
    report.is_approved = True
    db.commit()
    log_action(
        db,
        action="report_approved",
        performed_by=current_user.id,
        entity_type="medical_report",
        entity_id=report.id,
        request=request,
    )
    return {"message": "Report approved"}


@router.patch("/{report_id}/reject")
def reject_report(
    report_id: str,
    request: Request = None,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if report.upload_source == "patient":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reject a self-uploaded report")
    db.delete(report)
    db.commit()
    log_action(
        db,
        action="report_rejected",
        performed_by=current_user.id,
        entity_type="medical_report",
        entity_id=uuid.UUID(report_id),
        request=request,
    )
    return {"message": "Report rejected and removed"}


@router.post("/{report_id}/blockchain/confirm")
def confirm_blockchain_logs(
    report_id: str,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Confirm all pending blockchain transactions for a report."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    pending = db.query(BlockchainLog).filter(
        BlockchainLog.report_id == report.id,
        BlockchainLog.status == "pending",
    ).all()
    results = []
    for log in pending:
        updated = confirm_log(log.id, db)
        if updated:
            results.append({
                "id": str(updated.id),
                "event_type": updated.event_type,
                "status": updated.status,
                "block_number": updated.block_number,
                "transaction_hash": updated.transaction_hash,
            })
    return results


