"""room light count

Revision ID: 20260610_0006
Revises: 20260609_0005
Create Date: 2026-06-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260610_0006"
down_revision: Union[str, None] = "20260609_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "rooms" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("rooms")}
    if "light_count" not in columns:
        op.add_column(
            "rooms",
            sa.Column("light_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "rooms" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("rooms")}
    if "light_count" in columns:
        op.drop_column("rooms", "light_count")
