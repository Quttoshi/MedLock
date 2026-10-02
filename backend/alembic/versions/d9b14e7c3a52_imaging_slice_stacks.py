"""imaging_slice_stacks: per-series slice images for the viewer

Revision ID: d9b14e7c3a52
Revises: c5d82f1a9e47
Create Date: 2026-10-02 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d9b14e7c3a52"
down_revision: Union[str, None] = "c5d82f1a9e47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("imaging_series", sa.Column("slice_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "imaging_series",
        sa.Column("slice_stack_parts", postgresql.JSONB(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("imaging_series", "slice_stack_parts")
    op.drop_column("imaging_series", "slice_count")
