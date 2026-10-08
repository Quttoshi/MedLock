from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.user import User
from app.schemas.access_request import AccessRequestByEmail, AccessRequestResponse, ShareRecordsRequest
from app.services.access_request_service import (
    approve_request,
    create_access_request_by_email,
    deny_request,
    get_requests_for_doctor,
    get_requests_for_patient,
    revoke_request,
    search_doctors,
    share_centers,
    share_with_doctor,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/access-requests", tags=["Access Requests"])


# ── Doctor endpoints ─────────────────────────────────

@router.post("", status_code=201)
def submit_request(
    data: AccessRequestByEmail,
    request: Request,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    result = create_access_request_by_email(data, current_user, db)
    log_action(db, action="access_request_submitted", performed_by=current_user.id,
               entity_type="patient", request=request)
    return result


@router.get("/my", response_model=List[AccessRequestResponse])
def my_requests_as_doctor(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    return get_requests_for_doctor(current_user, db)


# ── Patient endpoints ────────────────────────────────

@router.get("", response_model=List[AccessRequestResponse])
def my_requests_as_patient(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    return get_requests_for_patient(current_user, db)


@router.get("/centers")
def centers_to_share_with(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Approved hospitals and clinics, to find a doctor by where they work."""
    return share_centers(current_user, db)


@router.get("/doctors")
def find_doctors(
    search: str = "",
    center_id: Optional[UUID] = None,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Verified doctors the patient can share their records with: everyone at a chosen
    hospital or clinic, or a name search."""
    return search_doctors(search, current_user, db, center_id)


@router.post("/share", response_model=AccessRequestResponse, status_code=201)
def share_records(
    data: ShareRecordsRequest,
    request: Request,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """The patient gives a verified doctor access without waiting for a request."""
    result = share_with_doctor(data.doctor_id, data.note, current_user, db)
    log_action(db, action="access_shared", performed_by=current_user.id,
               entity_type="access_request", entity_id=result.id,
               details={"doctor_id": str(data.doctor_id), "initiated_by": result.initiated_by}, request=request)
    return result


@router.patch("/{request_id}/approve", response_model=AccessRequestResponse)
def approve(
    request_id: str,
    request: Request,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    result = approve_request(request_id, current_user, db)
    log_action(db, action="access_approved", performed_by=current_user.id,
               entity_type="access_request", entity_id=result.id, request=request)
    return result


@router.patch("/{request_id}/deny", response_model=AccessRequestResponse)
def deny(
    request_id: str,
    request: Request,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    result = deny_request(request_id, current_user, db)
    log_action(db, action="access_denied", performed_by=current_user.id,
               entity_type="access_request", entity_id=result.id, request=request)
    return result


@router.patch("/{request_id}/revoke", response_model=AccessRequestResponse)
def revoke(
    request_id: str,
    request: Request,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    result = revoke_request(request_id, current_user, db)
    log_action(db, action="access_revoked", performed_by=current_user.id,
               entity_type="access_request", entity_id=result.id, request=request)
    return result
