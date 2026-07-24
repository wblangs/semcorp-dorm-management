"""utility bill 宿舍账号 free-text field

Revision ID: 20260724_0011
Revises: 20260723_0010
Create Date: 2026-07-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260724_0011"
down_revision: Union[str, None] = "20260723_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "utility_bills" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("utility_bills")}
    if "account" not in columns:
        op.add_column("utility_bills", sa.Column("account", sa.String(length=200), nullable=True))


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "utility_bills" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("utility_bills")}
    if "account" in columns:
        op.drop_column("utility_bills", "account")
