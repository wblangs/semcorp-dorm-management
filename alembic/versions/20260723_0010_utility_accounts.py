"""utility accounts (缴费账户: provider account numbers/logins per dorm utility)

Revision ID: 20260723_0010
Revises: 20260723_0009
Create Date: 2026-07-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260723_0010"
down_revision: Union[str, None] = "20260723_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "utility_accounts" in inspector.get_table_names():
        return
    op.create_table(
        "utility_accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("dorm_id", sa.Integer(), nullable=False),
        sa.Column("fee_type", sa.String(length=50), nullable=False),
        sa.Column("provider", sa.String(length=100), nullable=True),
        sa.Column("account_number", sa.String(length=100), nullable=False),
        sa.Column("login_username", sa.String(length=100), nullable=True),
        sa.Column("login_password", sa.String(length=200), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["dorm_id"], ["dorms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_utility_accounts_dorm_id", "utility_accounts", ["dorm_id"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "utility_accounts" in inspector.get_table_names():
        op.drop_table("utility_accounts")
