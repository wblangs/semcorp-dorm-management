"""users auth

Revision ID: 20260601_0003
Revises: 20260528_0002
Create Date: 2026-06-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260601_0003"
down_revision: Union[str, None] = "20260528_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "users" not in inspector.get_table_names():
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("username", sa.String(80), nullable=False, unique=True),
            sa.Column("password_hash", sa.String(255), nullable=False),
            sa.Column("display_name", sa.String(100), nullable=True),
            sa.Column("role", sa.String(40), nullable=False, server_default="user"),
            sa.Column("status", sa.String(40), nullable=False, server_default="active"),
            sa.Column("last_login_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )
        op.create_index("ix_users_username", "users", ["username"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "users" in inspector.get_table_names():
        op.drop_table("users")
