"""center_types_affiliations: medical center types and multiple doctor affiliations

Revision ID: c1a7e5d39f02
Revises: b2e7f4c19d63
Create Date: 2026-10-08 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c1a7e5d39f02"
down_revision: Union[str, None] = "b2e7f4c19d63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres cannot use a newly added enum value in the same transaction that added it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'affiliation_ended'")

    # Existing centers were all registered as hospitals.
    op.add_column(
        "medical_centers",
        sa.Column("center_type", sa.String(), nullable=False, server_default="hospital"),
    )

    op.create_table(
        "doctor_affiliations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "medical_center_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("medical_centers.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "affiliation_request_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("affiliation_requests.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column(
            "ended_by_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("end_reason", sa.String(), nullable=True),
    )
    op.create_index("ix_doctor_affiliations_doctor_id", "doctor_affiliations", ["doctor_id"])
    op.create_index("ix_doctor_affiliations_medical_center_id", "doctor_affiliations", ["medical_center_id"])
    op.create_index(
        "uq_doctor_affiliations_active", "doctor_affiliations", ["doctor_id", "medical_center_id"],
        unique=True, postgresql_where=sa.text("status = 'active'"),
    )

    # Each doctor's single affiliation becomes an active membership, linked to the
    # request that was approved for it when there is one.
    op.execute("""
        INSERT INTO doctor_affiliations (id, doctor_id, medical_center_id, affiliation_request_id, status, joined_at)
        SELECT gen_random_uuid(), d.id, d.medical_center_id,
               (SELECT r.id FROM affiliation_requests r
                 WHERE r.doctor_id = d.id AND r.medical_center_id = d.medical_center_id AND r.status = 'approved'
                 ORDER BY r.decided_at DESC NULLS LAST LIMIT 1),
               'active', COALESCE(d.verified_at, now())
        FROM doctors d
        WHERE d.medical_center_id IS NOT NULL
    """)

    op.drop_column("doctors", "medical_center_id")


def downgrade() -> None:
    # Postgres cannot remove enum values, so 'affiliation_ended' remains.
    op.add_column(
        "doctors",
        sa.Column(
            "medical_center_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("medical_centers.id", ondelete="SET NULL"), nullable=True,
        ),
    )
    # Only one center fits the old column: keep each doctor's earliest active membership.
    op.execute("""
        UPDATE doctors d SET medical_center_id = (
            SELECT a.medical_center_id FROM doctor_affiliations a
            WHERE a.doctor_id = d.id AND a.status = 'active'
            ORDER BY a.joined_at LIMIT 1
        )
    """)
    op.drop_index("uq_doctor_affiliations_active", table_name="doctor_affiliations")
    op.drop_index("ix_doctor_affiliations_medical_center_id", table_name="doctor_affiliations")
    op.drop_index("ix_doctor_affiliations_doctor_id", table_name="doctor_affiliations")
    op.drop_table("doctor_affiliations")
    op.drop_column("medical_centers", "center_type")
