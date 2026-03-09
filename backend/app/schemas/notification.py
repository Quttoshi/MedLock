from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
