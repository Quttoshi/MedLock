from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.user import User
from app.models.doctor import Doctor
from app.models.medical_center import MedicalCenter
from app.models.admin import Admin
from app.models.audit_log import AuditLog
from app.schemas.admin import UserListItem, DoctorListItem, MedicalCenterListItem, AuditLogItem
from app.services.audit_service import log_action

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

@router.get("/doctors", response_model=List[DoctorListItem])
def list_doctors(
    verified: Optional[bool] = Query(None, description="Filter by verification status"),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    q = db.query(Doctor)
    if verified is not None:
        q = q.filter(Doctor.is_verified == verified)
    doctors = q.all()
    result = []
    for d in doctors:
        result.append(DoctorListItem(
            id=d.id,
            user_id=d.user_id,
            name=d.user.full_name if d.user else None,
            email=d.user.email if d.user else "",
            specialization=d.specialization,
            license_number=d.license_number,
            is_verified=d.is_verified,
        ))
    return result


@router.patch("/doctors/{doctor_id}/verify", response_model=DoctorListItem)
def verify_doctor(
    doctor_id: UUID,
    request: Request,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    if doctor.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Doctor is already verified")

    doctor.is_verified = True
    db.commit()
    db.refresh(doctor)

    log_action(db, action="doctor_verified", performed_by=current_user.id,
               entity_type="doctor", entity_id=doctor.id, request=request)

    return DoctorListItem(
        id=doctor.id,
        user_id=doctor.user_id,
        name=doctor.user.full_name if doctor.user else None,
        email=doctor.user.email if doctor.user else "",
        specialization=doctor.specialization,
        license_number=doctor.license_number,
        is_verified=doctor.is_verified,
    )


@router.patch("/doctors/{doctor_id}/unverify", response_model=DoctorListItem)
def unverify_doctor(
    doctor_id: UUID,
    request: Request,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    doctor.is_verified = False
    db.commit()
    db.refresh(doctor)

    log_action(db, action="doctor_unverified", performed_by=current_user.id,
               entity_type="doctor", entity_id=doctor.id, request=request)

    return DoctorListItem(
        id=doctor.id,
        user_id=doctor.user_id,
        name=doctor.user.full_name if doctor.user else None,
        email=doctor.user.email if doctor.user else "",
        specialization=doctor.specialization,
        license_number=doctor.license_number,
        is_verified=doctor.is_verified,
    )


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

    return MedicalCenterListItem(
        id=center.id,
        user_id=center.user_id,
        name=center.name,
        email=center.user.email if center.user else "",
        license_number=center.license_number,
        address=center.address,
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

    return MedicalCenterListItem(
        id=center.id,
        user_id=center.user_id,
        name=center.name,
        email=center.user.email if center.user else "",
        license_number=center.license_number,
        address=center.address,
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
