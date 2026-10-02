"""imaging_studies: DICOM studies and series

Revision ID: c5d82f1a9e47
Revises: a7c4e2b91d36
Create Date: 2026-10-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c5d82f1a9e47"
down_revision: Union[str, None] = "a7c4e2b91d36"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_NOTIFICATION_TYPES = ("imaging_processed", "imaging_processing_failed")


def upgrade() -> None:
    # Postgres cannot use a newly added enum value in the same transaction that added it.
    with op.get_context().autocommit_block():
        for value in NEW_NOTIFICATION_TYPES:
            op.execute(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'")

    op.create_table(
        "imaging_studies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "report_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("medical_reports.id", ondelete="CASCADE"), unique=True, nullable=False,
        ),
        sa.Column("study_uid", sa.String(), nullable=False),
        sa.Column("modality", sa.String(), nullable=True),
        sa.Column("body_part", sa.String(), nullable=True),
        sa.Column("study_date", sa.Date(), nullable=True),
        sa.Column("study_description", sa.String(), nullable=True),
        sa.Column("institution", sa.String(), nullable=True),
        sa.Column("manufacturer", sa.String(), nullable=True),
        sa.Column("series_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("instance_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processing_status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("processing_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processing_started_at", sa.DateTime(), nullable=True),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("staging_path", sa.String(), nullable=True),
        sa.Column("staging_key_ref", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_imaging_studies_study_uid", "imaging_studies", ["study_uid"])
    op.create_index("ix_imaging_studies_processing_status", "imaging_studies", ["processing_status"])

    op.create_table(
        "imaging_series",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "study_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("imaging_studies.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("series_uid", sa.String(), nullable=False),
        sa.Column("series_number", sa.Integer(), nullable=True),
        sa.Column("modality", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("body_part", sa.String(), nullable=True),
        sa.Column("instance_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows", sa.Integer(), nullable=True),
        sa.Column("columns", sa.Integer(), nullable=True),
        sa.Column("slice_thickness_mm", sa.Float(), nullable=True),
        sa.Column("pixel_spacing_mm", postgresql.JSONB(), nullable=True),
        sa.Column("sequence_name", sa.String(), nullable=True),
        sa.Column("magnetic_field_strength_t", sa.Float(), nullable=True),
        sa.Column("repetition_time_ms", sa.Float(), nullable=True),
        sa.Column("echo_time_ms", sa.Float(), nullable=True),
        sa.Column("contrast_agent", sa.String(), nullable=True),
        sa.Column("part_paths", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("preview_path", sa.String(), nullable=True),
        sa.Column("preview_key_ref", sa.String(), nullable=True),
    )
    op.create_index("ix_imaging_series_study_id", "imaging_series", ["study_id"])


def downgrade() -> None:
    # Postgres cannot remove enum values, so the added notification types remain.
    op.drop_index("ix_imaging_series_study_id", table_name="imaging_series")
    op.drop_table("imaging_series")
    op.drop_index("ix_imaging_studies_processing_status", table_name="imaging_studies")
    op.drop_index("ix_imaging_studies_study_uid", table_name="imaging_studies")
    op.drop_table("imaging_studies")
