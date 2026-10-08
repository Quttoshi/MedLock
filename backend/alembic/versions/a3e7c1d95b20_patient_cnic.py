"""patient_cnic: encrypted national ID with a keyed fingerprint for lookups

Revision ID: a3e7c1d95b20
Revises: f6d2b8c41a73
Create Date: 2026-10-09 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3e7c1d95b20"
down_revision: Union[str, None] = "f6d2b8c41a73"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing patients have no CNIC yet; they are asked to add it from their dashboard.
    op.add_column("patients", sa.Column("cnic_hash", sa.String(length=64), nullable=True))
    op.add_column("patients", sa.Column("cnic_encrypted", sa.LargeBinary(), nullable=True))
    op.add_column("patients", sa.Column("cnic_key_ref", sa.String(), nullable=True))
    op.create_index("ix_patients_cnic_hash", "patients", ["cnic_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_patients_cnic_hash", table_name="patients")
    op.drop_column("patients", "cnic_key_ref")
    op.drop_column("patients", "cnic_encrypted")
    op.drop_column("patients", "cnic_hash")
