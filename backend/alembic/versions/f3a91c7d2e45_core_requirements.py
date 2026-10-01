"""core_requirements: notification types, blockchain retries, revoked tokens

Revision ID: f3a91c7d2e45
Revises: d8f4c2a91b7e
Create Date: 2026-10-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3a91c7d2e45"
down_revision: Union[str, None] = "d8f4c2a91b7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_NOTIFICATION_TYPES = (
    "medical_center_registered",
    "report_consent_approved",
    "report_consent_rejected",
    "affiliation_approved",
    "affiliation_rejected",
    "blockchain_failed",
)


def upgrade() -> None:
    # Postgres cannot use a newly added enum value in the same transaction that added it.
    with op.get_context().autocommit_block():
        for value in NEW_NOTIFICATION_TYPES:
            op.execute(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column("blockchain_logs", sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("blockchain_logs", sa.Column("last_error", sa.Text(), nullable=True))
    op.alter_column("blockchain_logs", "attempts", server_default=None)

    op.create_table(
        "revoked_tokens",
        sa.Column("jti", sa.String(), primary_key=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_revoked_tokens_expires_at", "revoked_tokens", ["expires_at"])


def downgrade() -> None:
    # Postgres cannot remove enum values, so the added notification types remain.
    op.drop_index("ix_revoked_tokens_expires_at", table_name="revoked_tokens")
    op.drop_table("revoked_tokens")
    op.drop_column("blockchain_logs", "last_error")
    op.drop_column("blockchain_logs", "attempts")
