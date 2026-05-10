from typing import List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.user import User
from app.schemas.access_request import AccessRequestCreate, AccessRequestResponse
from app.services.access_request_service import (
    approve_request,
    create_access_request,
    deny_request,
    get_requests_for_doctor,
    get_requests_for_patient,
    revoke_request,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/access-requests", tags=["Access Requests"])


# ── Doctor endpoints ─────────────────────────────────

@router.post("", response_model=AccessRequestResponse, status_code=201)
def submit_request(
    data: AccessRequestCreate,
    request: Request,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    result = create_access_request(data, current_user, db)
    log_action(db, action="access_request_submitted", performed_by=current_user.id,
               entity_type="access_request", entity_id=result.id, request=request)
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
