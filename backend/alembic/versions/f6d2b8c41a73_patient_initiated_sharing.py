"""patient_initiated_sharing: record who started an access grant

Revision ID: f6d2b8c41a73
Revises: e2c9a4f7b815
Create Date: 2026-10-09 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6d2b8c41a73"
down_revision: Union[str, None] = "e2c9a4f7b815"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres cannot use a newly added enum value in the same transaction that added it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'records_shared'")

    # Every access so far started with a doctor's request.
    op.add_column(
        "access_requests",
        sa.Column("initiated_by", sa.String(), nullable=False, server_default="doctor"),
    )


def downgrade() -> None:
    # Postgres cannot remove enum values, so 'records_shared' remains.
    op.drop_column("access_requests", "initiated_by")
