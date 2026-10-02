"""notification_links: page each notification opens when clicked

Revision ID: e8f3a6b2c714
Revises: d9b14e7c3a52
Create Date: 2026-10-02 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f3a6b2c714"
down_revision: Union[str, None] = "d9b14e7c3a52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Snapshot of notification_service.DEFAULT_LINKS / ROLE_HOME at the time of this migration,
# used to give existing notifications a destination.
DEFAULT_LINKS = {
    "patient": {
        "access_request": "/patient/access-requests",
        "report_uploaded": "/patient/reports",
        "report_approval_required": "/patient/reports",
        "imaging_processed": "/patient/reports",
        "imaging_processing_failed": "/patient/reports",
    },
    "doctor": {
        "access_approved": "/doctor/patients",
        "access_denied": "/doctor/access-requests",
        "access_revoked": "/doctor/access-requests",
        "affiliation_approved": "/doctor/affiliation",
        "affiliation_rejected": "/doctor/affiliation",
    },
    "medical_center": {
        "medical_center_approved": "/mc/dashboard",
        "medical_center_rejected": "/mc/dashboard",
        "report_consent_approved": "/mc/reports",
        "report_consent_rejected": "/mc/reports",
        "imaging_processed": "/mc/reports",
        "imaging_processing_failed": "/mc/reports",
    },
    "admin": {
        "medical_center_registered": "/admin/medical-centers",
        "blockchain_failed": "/admin/audit-logs",
    },
}
ROLE_HOME = {
    "patient": "/patient/notifications",
    "doctor": "/doctor/notifications",
    "medical_center": "/mc/notifications",
    "admin": "/admin/dashboard",
}


def upgrade() -> None:
    op.add_column("notifications", sa.Column("link", sa.String(), nullable=True))

    # Backfill existing notifications from the recipient's role and the notification type.
    cases = [
        f"WHEN u.role = '{role}' AND n.type::text = '{kind}' THEN '{path}'"
        for role, links in DEFAULT_LINKS.items()
        for kind, path in links.items()
    ] + [f"WHEN u.role = '{role}' THEN '{path}'" for role, path in ROLE_HOME.items()]
    op.execute(
        "UPDATE notifications n SET link = CASE " + " ".join(cases) + " END "
        "FROM users u WHERE u.id = n.recipient_id AND n.link IS NULL"
    )


def downgrade() -> None:
    op.drop_column("notifications", "link")
