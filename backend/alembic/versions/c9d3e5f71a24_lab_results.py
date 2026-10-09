"""lab_results: normalised test results for tables, trends and summaries

Revision ID: c9d3e5f71a24
Revises: b8f4d2e60c17
Create Date: 2026-10-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c9d3e5f71a24"
down_revision: Union[str, None] = "b8f4d2e60c17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("medical_reports", sa.Column("document_kind", sa.String(), nullable=True))
    op.add_column("medical_reports", sa.Column("collected_on", sa.Date(), nullable=True))
    op.add_column("medical_reports", sa.Column("lab_name", sa.String(), nullable=True))

    op.create_table(
        "lab_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_code", sa.String(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(), nullable=False),
        sa.Column("ref_low", sa.Float(), nullable=True),
        sa.Column("ref_high", sa.Float(), nullable=True),
        sa.Column("ref_source", sa.String(), nullable=False, server_default="standard"),
        sa.Column("flag", sa.String(), nullable=False, server_default="normal"),
        sa.Column("collected_on", sa.Date(), nullable=False),
        sa.Column("confidence", sa.String(), nullable=False, server_default="medium"),
        sa.Column("review_reasons", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(), nullable=False, server_default="unconfirmed"),
        sa.Column("extracted_value", sa.Float(), nullable=True),
        sa.Column("confirmed_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("source_text", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("report_id", "test_code", name="uq_lab_result_report_test"),
    )
    op.create_index("ix_lab_results_report_id", "lab_results", ["report_id"])
    op.create_index("ix_lab_results_patient_id", "lab_results", ["patient_id"])
    op.create_index("ix_lab_results_test_code", "lab_results", ["test_code"])
    op.create_index("ix_lab_results_collected_on", "lab_results", ["collected_on"])


def downgrade() -> None:
    op.drop_index("ix_lab_results_collected_on", table_name="lab_results")
    op.drop_index("ix_lab_results_test_code", table_name="lab_results")
    op.drop_index("ix_lab_results_patient_id", table_name="lab_results")
    op.drop_index("ix_lab_results_report_id", table_name="lab_results")
    op.drop_table("lab_results")
    op.drop_column("medical_reports", "lab_name")
    op.drop_column("medical_reports", "collected_on")
    op.drop_column("medical_reports", "document_kind")
