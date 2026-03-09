from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ReportResponse(BaseModel):
    id: UUID
    original_filename: str
    report_type: str
    file_url: str
    file_hash_sha256: str
    upload_source: str
    is_approved: bool
    uploaded_at: datetime

    class Config:
        from_attributes = True
