"""add_ocr_status_metadata

Revision ID: d8f4c2a91b7e
Revises: b4cec4915cb4
Create Date: 2026-05-14 03:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8f4c2a91b7e"
down_revision: Union[str, None] = "b4cec4915cb4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ocr_results", sa.Column("status", sa.String(), nullable=False, server_default="completed"))
    op.add_column("ocr_results", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column("ocr_results", sa.Column("parser_version", sa.String(), nullable=False, server_default="medical-ocr-v2"))
    op.add_column("ocr_results", sa.Column("ocr_engine", sa.String(), nullable=True))
    op.add_column("ocr_results", sa.Column("raw_text_length", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("ocr_results", sa.Column("structured_count", sa.Integer(), nullable=False, server_default="0"))

    op.alter_column("ocr_results", "status", server_default=None)
    op.alter_column("ocr_results", "parser_version", server_default=None)
    op.alter_column("ocr_results", "raw_text_length", server_default=None)
    op.alter_column("ocr_results", "structured_count", server_default=None)


def downgrade() -> None:
    op.drop_column("ocr_results", "structured_count")
    op.drop_column("ocr_results", "raw_text_length")
    op.drop_column("ocr_results", "ocr_engine")
    op.drop_column("ocr_results", "parser_version")
    op.drop_column("ocr_results", "error_message")
    op.drop_column("ocr_results", "status")
