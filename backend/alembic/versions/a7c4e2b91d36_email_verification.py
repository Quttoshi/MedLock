"""email_verification: users.email_verified_at

Revision ID: a7c4e2b91d36
Revises: f3a91c7d2e45
Create Date: 2026-10-01 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c4e2b91d36"
down_revision: Union[str, None] = "f3a91c7d2e45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(), nullable=True))
    # Accounts created before verification existed keep working without confirming.
    op.execute("UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL")


def downgrade() -> None:
    op.drop_column("users", "email_verified_at")
