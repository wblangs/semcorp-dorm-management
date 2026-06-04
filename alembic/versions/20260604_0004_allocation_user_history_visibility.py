"""allocation user history visibility

Revision ID: 20260604_0004
Revises: 20260601_0003
Create Date: 2026-06-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260604_0004"
down_revision: Union[str, None] = "20260601_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "allocations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("allocations")}
    if "hidden_from_user_history" not in columns:
        op.add_column(
            "allocations",
            sa.Column(
                "hidden_from_user_history",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "allocations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("allocations")}
    if "hidden_from_user_history" in columns:
        op.drop_column("allocations", "hidden_from_user_history")
