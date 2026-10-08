"""report_threads: private patient-doctor question threads on reports

Revision ID: d4b8f2a61c93
Revises: c1a7e5d39f02
Create Date: 2026-10-08 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d4b8f2a61c93"
down_revision: Union[str, None] = "c1a7e5d39f02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_NOTIFICATION_TYPES = ("report_question", "report_reply")


def upgrade() -> None:
    # Postgres cannot use a newly added enum value in the same transaction that added it.
    with op.get_context().autocommit_block():
        for value in NEW_NOTIFICATION_TYPES:
            op.execute(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'")

    op.create_table(
        "report_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "report_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "doctor_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "patient_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("status", sa.String(), nullable=False, server_default="open"),
        sa.Column(
            "resolved_by_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_message_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("patient_last_read_at", sa.DateTime(), nullable=True),
        sa.Column("doctor_last_read_at", sa.DateTime(), nullable=True),
        sa.Column("patient_last_emailed_at", sa.DateTime(), nullable=True),
        sa.Column("doctor_last_emailed_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("report_id", "doctor_id", name="uq_report_thread_doctor"),
    )
    op.create_index("ix_report_threads_report_id", "report_threads", ["report_id"])
    op.create_index("ix_report_threads_doctor_id", "report_threads", ["doctor_id"])
    op.create_index("ix_report_threads_patient_id", "report_threads", ["patient_id"])

    op.create_table(
        "report_thread_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "thread_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("report_threads.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "sender_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("sender_role", sa.String(), nullable=False),
        sa.Column("body_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("body_key_ref", sa.String(), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_report_thread_messages_thread_id", "report_thread_messages", ["thread_id"])


def downgrade() -> None:
    # Postgres cannot remove enum values, so the added notification types remain.
    op.drop_index("ix_report_thread_messages_thread_id", table_name="report_thread_messages")
    op.drop_table("report_thread_messages")
    op.drop_index("ix_report_threads_patient_id", table_name="report_threads")
    op.drop_index("ix_report_threads_doctor_id", table_name="report_threads")
    op.drop_index("ix_report_threads_report_id", table_name="report_threads")
    op.drop_table("report_threads")
