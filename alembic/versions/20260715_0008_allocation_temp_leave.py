"""allocation temp leave (临时空出) date range

Revision ID: 20260715_0008
Revises: 20260706_0007
Create Date: 2026-07-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260715_0008"
down_revision: Union[str, None] = "20260706_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "allocations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("allocations")}
    if "temp_leave_start" not in columns:
        op.add_column("allocations", sa.Column("temp_leave_start", sa.Date(), nullable=True))
    if "temp_leave_end" not in columns:
        op.add_column("allocations", sa.Column("temp_leave_end", sa.Date(), nullable=True))


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "allocations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("allocations")}
    for name in ("temp_leave_end", "temp_leave_start"):
        if name in columns:
            op.drop_column("allocations", name)
