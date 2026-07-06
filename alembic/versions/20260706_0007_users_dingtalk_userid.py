"""users dingtalk userid for 免登 account linking

Revision ID: 20260706_0007
Revises: 20260610_0006
Create Date: 2026-07-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260706_0007"
down_revision: Union[str, None] = "20260610_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "users" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "dingtalk_userid" not in columns:
        op.add_column("users", sa.Column("dingtalk_userid", sa.String(length=80), nullable=True))
        op.create_index("ix_users_dingtalk_userid", "users", ["dingtalk_userid"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "users" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "dingtalk_userid" in columns:
        op.drop_index("ix_users_dingtalk_userid", table_name="users")
        op.drop_column("users", "dingtalk_userid")
