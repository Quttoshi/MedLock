from datetime import date, datetime
from typing import Optional
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
    # Filled in when the report is read: "lab_report" or "other", and for lab reports
    # the sample collection date and the lab.
    document_kind: Optional[str] = None
    collected_on: Optional[date] = None
    lab_name: Optional[str] = None

    class Config:
        from_attributes = True
