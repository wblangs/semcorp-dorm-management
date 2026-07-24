"""utility bills (水电网气房费) and reminder recipients

Revision ID: 20260723_0009
Revises: 20260715_0008
Create Date: 2026-07-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260723_0009"
down_revision: Union[str, None] = "20260715_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()

    if "utility_bills" not in tables:
        op.create_table(
            "utility_bills",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("dorm_id", sa.Integer(), nullable=False),
            sa.Column("fee_type", sa.String(length=50), nullable=False),
            sa.Column("due_date", sa.Date(), nullable=False),
            sa.Column("amount", sa.Float(), nullable=True),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("reminded_on", sa.Date(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.ForeignKeyConstraint(["dorm_id"], ["dorms.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_utility_bills_dorm_id", "utility_bills", ["dorm_id"])
        op.create_index("ix_utility_bills_due_date", "utility_bills", ["due_date"])

    if "utility_bill_recipients" not in tables:
        op.create_table(
            "utility_bill_recipients",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", name="uq_utility_bill_recipient_user"),
        )
        op.create_index("ix_utility_bill_recipients_user_id", "utility_bill_recipients", ["user_id"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    if "utility_bill_recipients" in tables:
        op.drop_table("utility_bill_recipients")
    if "utility_bills" in tables:
        op.drop_table("utility_bills")
