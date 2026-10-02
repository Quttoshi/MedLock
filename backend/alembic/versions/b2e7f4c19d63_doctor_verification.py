"""doctor_verification: verification details and independent-doctor requests

Revision ID: b2e7f4c19d63
Revises: e8f3a6b2c714
Create Date: 2026-10-03 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b2e7f4c19d63"
down_revision: Union[str, None] = "e8f3a6b2c714"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_NOTIFICATION_TYPES = (
    "doctor_verification_requested",
    "doctor_verification_approved",
    "doctor_verification_rejected",
    "doctor_verification_revoked",
)


def upgrade() -> None:
    # Postgres cannot use a newly added enum value in the same transaction that added it.
    with op.get_context().autocommit_block():
        for value in NEW_NOTIFICATION_TYPES:
            op.execute(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column("doctors", sa.Column("verification_method", sa.String(), nullable=True))
    op.add_column(
        "doctors",
        sa.Column(
            "verified_by_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
    )
    op.add_column("doctors", sa.Column("verified_at", sa.DateTime(), nullable=True))
    op.add_column("doctors", sa.Column("license_expires_at", sa.Date(), nullable=True))
    op.add_column("doctors", sa.Column("verification_note", sa.String(), nullable=True))

    # Existing verified doctors: affiliated ones were verified through their hospital,
    # the rest by an admin (the only other way to verify before this change).
    op.execute("""
        UPDATE doctors SET verification_method = CASE
            WHEN medical_center_id IS NOT NULL THEN 'medical_center' ELSE 'admin' END
        WHERE is_verified = true AND verification_method IS NULL
    """)

    op.create_table(
        "doctor_verification_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("registration_number", sa.String(), nullable=False),
        sa.Column("license_expires_at", sa.Date(), nullable=True),
        sa.Column("certificate_path", sa.String(), nullable=True),
        sa.Column("certificate_key_ref", sa.String(), nullable=True),
        sa.Column("certificate_filename", sa.String(), nullable=True),
        sa.Column("certificate_content_type", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("admin_note", sa.String(), nullable=True),
        sa.Column(
            "reviewed_by_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("submitted_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_doctor_verification_requests_doctor_id", "doctor_verification_requests", ["doctor_id"])
    op.create_index("ix_doctor_verification_requests_status", "doctor_verification_requests", ["status"])


def downgrade() -> None:
    # Postgres cannot remove enum values, so the added notification types remain.
    op.drop_index("ix_doctor_verification_requests_status", table_name="doctor_verification_requests")
    op.drop_index("ix_doctor_verification_requests_doctor_id", table_name="doctor_verification_requests")
    op.drop_table("doctor_verification_requests")
    for column in ("verification_note", "license_expires_at", "verified_at", "verified_by_user_id", "verification_method"):
        op.drop_column("doctors", column)
