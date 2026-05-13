from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/my", response_model=List[NotificationResponse])
def my_notifications(
    current_user: User = Depends(require_role(["patient", "doctor", "medical_center", "admin"])),
    db: Session = Depends(get_db),
):
    return (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.patch("/my/read-all")
def mark_all_read(
    current_user: User = Depends(require_role(["patient", "doctor", "medical_center", "admin"])),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


@router.patch("/my/{notification_id}/read")
def mark_read(
    notification_id: str,
    current_user: User = Depends(require_role(["patient", "doctor", "medical_center", "admin"])),
    db: Session = Depends(get_db),
):
    import uuid
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == uuid.UUID(notification_id),
            Notification.recipient_id == current_user.id,
        )
        .first()
    )
    if not notification:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = True
    db.commit()
    return {"message": "Marked as read"}
