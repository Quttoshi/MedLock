from typing import List

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.jwt import get_current_user
from app.dependencies.rbac import require_role
from app.models.user import User
from app.schemas.report import ReportResponse
from app.services.audit_service import log_action
from app.services.report_service import get_my_reports, upload_report

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
