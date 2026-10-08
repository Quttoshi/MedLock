"""center_licence_checks: regulator licence details for medical centers

Revision ID: e2c9a4f7b815
Revises: d4b8f2a61c93
Create Date: 2026-10-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2c9a4f7b815"
down_revision: Union[str, None] = "d4b8f2a61c93"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres cannot use a newly added enum value in the same transaction that added it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'medical_center_licence_expired'")

    # Existing centers have no regulator: approved ones keep working and are shown as
    # approved before licence checks; pending ones are asked for their licence details.
    op.add_column("medical_centers", sa.Column("regulator", sa.String(), nullable=True))
    op.add_column("medical_centers", sa.Column("license_expires_at", sa.Date(), nullable=True))
    op.add_column("medical_centers", sa.Column("verification_note", sa.String(), nullable=True))


def downgrade() -> None:
    # Postgres cannot remove enum values, so 'medical_center_licence_expired' remains.
    op.drop_column("medical_centers", "verification_note")
    op.drop_column("medical_centers", "license_expires_at")
    op.drop_column("medical_centers", "regulator")
