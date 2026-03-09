import uuid

from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    recipient_id: uuid.UUID,
    notification_type: str,
    message: str,
) -> None:
    notification = Notification(
        recipient_id=recipient_id,
        type=notification_type,
        message=message,
    )
    db.add(notification)
    db.commit()
