from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.user import User
from app.models.doctor import Doctor
from app.models.medical_center import MedicalCenter
from app.models.admin import Admin
from app.models.audit_log import AuditLog
from app.schemas.admin import (
    AdminRevokeDoctorRequest,
    AdminVerifyDoctorRequest,
    ApproveVerificationRequest,
    AuditLogItem,
    DoctorListItem,
    MedicalCenterListItem,
    RejectVerificationRequest,
    UserListItem,
)
from app.models.doctor_verification_request import DoctorVerificationRequest
from app.services import doctor_verification_service as verification
from app.services.audit_service import log_action
from app.services.notification_service import create_notification

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Users ────────────────────────────────────────────────

@router.get("/users", response_model=List[UserListItem])
def list_users(
    role: Optional[str] = Query(None, description="Filter by role"),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    users = q.order_by(User.created_at.desc()).all()
    return [
        UserListItem(
            id=u.id,
            name=u.full_name,
            email=u.email,
            role=u.role,
            created_at=u.created_at,
        )
        for u in users
    ]


# ── Doctors ──────────────────────────────────────────────

def _doctor_item(d: Doctor) -> DoctorListItem:
    return DoctorListItem(
        id=d.id,
        user_id=d.user_id,
        name=d.user.full_name if d.user else None,
        email=d.user.email if d.user else "",
        specialization=d.specialization,
        license_number=d.license_number,
        is_verified=d.is_verified,
        verification_method=d.verification_method,
        verification_label=verification.verification_label(d),
        verified_at=d.verified_at,
        license_expires_at=d.license_expires_at,
        verification_note=d.verification_note,
        medical_center_names=[a.medical_center.name for a in d.affiliations if a.status == "active" and a.medical_center],
        has_pending_request=not d.is_verified and any(r.status == "pending" for r in d.verification_requests),
    )


def _get_doctor_or_404(doctor_id: UUID, db: Session) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    return doctor


@router.get("/doctors", response_model=List[DoctorListItem])
def list_doctors(
    verified: Optional[bool] = Query(None, description="Filter by verification status"),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    q = db.query(Doctor)
    if verified is not None:
        q = q.filter(Doctor.is_verified == verified)
    return [_doctor_item(d) for d in q.all()]


@router.patch("/doctors/{doctor_id}/verify", response_model=DoctorListItem)
def verify_doctor(
    doctor_id: UUID,
    body: AdminVerifyDoctorRequest,
    request: Request,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Admin override: verify a doctor directly (normally done by their medical center,
    or through a verification request checked against the PMDC register)."""
    doctor = _get_doctor_or_404(doctor_id, db)
    verification.admin_verify(doctor, current_user, body.reason, body.license_expires_at, db)
    log_action(db, action="doctor_verified", performed_by=current_user.id, entity_type="doctor",
               entity_id=doctor.id, details={"reason": body.reason, "method": "admin_override"}, request=request)
    db.refresh(doctor)
    return _doctor_item(doctor)


@router.patch("/doctors/{doctor_id}/unverify", response_model=DoctorListItem)
def unverify_doctor(
    doctor_id: UUID,
    body: AdminRevokeDoctorRequest,
    request: Request,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    doctor = _get_doctor_or_404(doctor_id, db)
    verification.admin_revoke(doctor, body.reason, db)
    log_action(db, action="doctor_unverified", performed_by=current_user.id, entity_type="doctor",
               entity_id=doctor.id, details={"reason": body.reason}, request=request)
    db.refresh(doctor)
    return _doctor_item(doctor)


# ── Doctor verification requests (independent doctors) ──

@router.get("/doctor-verification-requests")
def list_verification_requests(
    status_filter: Optional[str] = Query("pending", alias="status"),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    q = db.query(DoctorVerificationRequest)
    if status_filter:
        q = q.filter(DoctorVerificationRequest.status == status_filter)
    requests = q.order_by(DoctorVerificationRequest.submitted_at.desc()).all()
    if status_filter == "pending":
        # Doctors verified by their hospital meanwhile need no PMDC review
        requests = [r for r in requests if not r.doctor.is_verified]
    return [
        {
            **verification.request_summary(r),
            "doctor_id": str(r.doctor_id),
            "doctor_name": r.doctor.user.full_name if r.doctor.user else None,
            "doctor_email": r.doctor.user.email if r.doctor.user else None,
            "specialization": r.doctor.specialization,
            "registered_license_number": r.doctor.license_number,
            "pmdc_register_url": verification.PMDC_REGISTER_URL,
        }
        for r in requests
    ]


@router.get("/doctor-verification-requests/{request_id}/certificate")
def get_verification_certificate(
    request_id: str,
    request: Request,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    req = db.query(DoctorVerificationRequest).filter(DoctorVerificationRequest.id == UUID(request_id)).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification request not found")
    data = verification.read_certificate(req)
    log_action(db, action="doctor_certificate_viewed", performed_by=current_user.id, entity_type="doctor",
               entity_id=req.doctor_id, request=request)
    return Response(
        content=data,
        media_type=req.certificate_content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{req.certificate_filename or "certificate"}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.patch("/doctor-verification-requests/{request_id}/approve")
def approve_verification_request(
    request_id: str,
    body: ApproveVerificationRequest,
    request: Request,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    req = verification.approve_request(request_id, current_user, body.license_expires_at, body.note, db)
    log_action(db, action="doctor_verification_approved", performed_by=current_user.id, entity_type="doctor",
               entity_id=req.doctor_id,
               details={"license_expires_at": str(body.license_expires_at), "note": req.admin_note}, request=request)
    return verification.request_summary(req)


@router.patch("/doctor-verification-requests/{request_id}/reject")
def reject_verification_request(
    request_id: str,
    body: RejectVerificationRequest,
    request: Request,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    req = verification.reject_request(request_id, current_user, body.reason, db)
    log_action(db, action="doctor_verification_rejected", performed_by=current_user.id, entity_type="doctor",
               entity_id=req.doctor_id, details={"reason": body.reason}, request=request)
    return verification.request_summary(req)


# ── Medical Centers ──────────────────────────────────────

@router.get("/medical-centers", response_model=List[MedicalCenterListItem])
def list_medical_centers(
    approved: Optional[bool] = Query(None, description="Filter by approval status"),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    q = db.query(MedicalCenter)
    if approved is not None:
        q = q.filter(MedicalCenter.is_approved == approved)
    centers = q.all()
    result = []
    for c in centers:
        result.append(MedicalCenterListItem(
            id=c.id,
            user_id=c.user_id,
            name=c.name,
            email=c.user.email if c.user else "",
            license_number=c.license_number,
            address=c.address,
            center_type=c.center_type,
            is_approved=c.is_approved,
            approved_at=c.approved_at,
            rejection_reason=c.rejection_reason,
        ))
    return result


@router.patch("/medical-centers/{center_id}/approve", response_model=MedicalCenterListItem)
def approve_medical_center(
    center_id: UUID,
    request: Request,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    center = db.query(MedicalCenter).filter(MedicalCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical center not found")
    if center.is_approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Medical center is already approved")

    admin = db.query(Admin).filter(Admin.user_id == current_user.id).first()
    center.is_approved = True
    center.approved_by = admin.id if admin else None
    center.approved_at = datetime.utcnow()
    center.rejection_reason = None
    db.commit()
    db.refresh(center)

    log_action(db, action="medical_center_approved", performed_by=current_user.id,
               entity_type="medical_center", entity_id=center.id, request=request)
    create_notification(
        db, center.user_id, "medical_center_approved",
        f"Your medical center '{center.name}' has been approved. You can now use MedLock.",
    )

    return MedicalCenterListItem(
        id=center.id,
        user_id=center.user_id,
        name=center.name,
        email=center.user.email if center.user else "",
        license_number=center.license_number,
        address=center.address,
        center_type=center.center_type,
        is_approved=center.is_approved,
        approved_at=center.approved_at,
        rejection_reason=center.rejection_reason,
    )


@router.patch("/medical-centers/{center_id}/reject", response_model=MedicalCenterListItem)
def reject_medical_center(
    center_id: UUID,
    reason: str = Query(..., description="Rejection reason"),
    request: Request = None,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    center = db.query(MedicalCenter).filter(MedicalCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical center not found")

    center.is_approved = False
    center.rejection_reason = reason
    db.commit()
    db.refresh(center)

    log_action(db, action="medical_center_rejected", performed_by=current_user.id,
               entity_type="medical_center", entity_id=center.id,
               details={"reason": reason}, request=request)
    create_notification(
        db, center.user_id, "medical_center_rejected",
        f"Your medical center registration for '{center.name}' was rejected. Reason: {reason}",
    )

    return MedicalCenterListItem(
        id=center.id,
        user_id=center.user_id,
        name=center.name,
        email=center.user.email if center.user else "",
        license_number=center.license_number,
        address=center.address,
        center_type=center.center_type,
        is_approved=center.is_approved,
        approved_at=center.approved_at,
        rejection_reason=center.rejection_reason,
    )


# ── Audit Logs ───────────────────────────────────────────

@router.get("/audit-logs", response_model=List[AuditLogItem])
def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    logs = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for log in logs:
        result.append(AuditLogItem(
            id=log.id,
            performed_by=log.performed_by,
            performer_name=log.performed_by_user.full_name if log.performed_by_user else None,
            performer_email=log.performed_by_user.email if log.performed_by_user else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            ip_address=log.ip_address,
            details=log.details,
            created_at=log.created_at,
        ))
    return result
