"""room furniture tracking (bed size, light type, nightstand/trash counts)

Revision ID: 20260609_0005
Revises: 20260604_0004
Create Date: 2026-06-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260609_0005"
down_revision: Union[str, None] = "20260604_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "rooms" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("rooms")}
    if "bed_size" not in columns:
        op.add_column("rooms", sa.Column("bed_size", sa.String(length=20), nullable=True))
    if "light_type" not in columns:
        op.add_column("rooms", sa.Column("light_type", sa.String(length=20), nullable=True))
    if "nightstand_count" not in columns:
        op.add_column(
            "rooms",
            sa.Column("nightstand_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )
    if "trash_can_count" not in columns:
        op.add_column(
            "rooms",
            sa.Column("trash_can_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "rooms" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("rooms")}
    for name in ("trash_can_count", "nightstand_count", "light_type", "bed_size"):
        if name in columns:
            op.drop_column("rooms", name)
