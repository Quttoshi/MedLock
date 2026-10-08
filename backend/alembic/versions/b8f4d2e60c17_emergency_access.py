"""emergency_access: break-the-glass access with per-report blockchain events

Revision ID: b8f4d2e60c17
Revises: a3e7c1d95b20
Create Date: 2026-10-09 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b8f4d2e60c17"
down_revision: Union[str, None] = "a3e7c1d95b20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_NOTIFICATION_TYPES = ("emergency_access_started", "emergency_access_ended", "emergency_access_flagged")


def upgrade() -> None:
    # Postgres cannot use a newly added enum value in the same transaction that added it.
    with op.get_context().autocommit_block():
        for value in NEW_NOTIFICATION_TYPES:
            op.execute(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'")
        op.execute("ALTER TYPE blockchain_event_type ADD VALUE IF NOT EXISTS 'emergency_access'")

    op.create_table(
        "emergency_accesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "medical_center_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("medical_centers.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("reason_code", sa.String(), nullable=False),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("ended_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("flagged_at", sa.DateTime(), nullable=True),
        sa.Column("flag_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
    )
    op.create_index("ix_emergency_accesses_doctor_id", "emergency_accesses", ["doctor_id"])
    op.create_index("ix_emergency_accesses_patient_id", "emergency_accesses", ["patient_id"])

    op.create_table(
        "emergency_access_views",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "emergency_access_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("emergency_accesses.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("first_viewed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("emergency_access_id", "report_id", name="uq_emergency_view_report"),
    )
    op.create_index("ix_emergency_access_views_emergency_access_id", "emergency_access_views", ["emergency_access_id"])


def downgrade() -> None:
    # Postgres cannot remove enum values, so the added notification and blockchain types remain.
    op.drop_index("ix_emergency_access_views_emergency_access_id", table_name="emergency_access_views")
    op.drop_table("emergency_access_views")
    op.drop_index("ix_emergency_accesses_patient_id", table_name="emergency_accesses")
    op.drop_index("ix_emergency_accesses_doctor_id", table_name="emergency_accesses")
    op.drop_table("emergency_accesses")
