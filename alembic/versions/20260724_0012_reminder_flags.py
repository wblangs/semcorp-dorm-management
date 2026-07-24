"""per-user 接收缴费提醒 flag and per-bill 是否需要提醒 switch

Revision ID: 20260724_0012
Revises: 20260724_0011
Create Date: 2026-07-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260724_0012"
down_revision: Union[str, None] = "20260724_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "users" in tables:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "receive_bill_reminders" not in user_columns:
            op.add_column(
                "users",
                sa.Column("receive_bill_reminders", sa.Boolean(), nullable=False, server_default=sa.false()),
            )
            # Carry over recipients configured under the old utility_bill_recipients scheme.
            if "utility_bill_recipients" in tables:
                bind.execute(
                    sa.text(
                        "UPDATE users SET receive_bill_reminders = 1 WHERE id IN "
                        "(SELECT user_id FROM utility_bill_recipients WHERE is_deleted = 0)"
                    )
                )

    if "utility_bills" in tables:
        bill_columns = {column["name"] for column in inspector.get_columns("utility_bills")}
        if "remind_enabled" not in bill_columns:
            op.add_column(
                "utility_bills",
                sa.Column("remind_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    if "utility_bills" in tables:
        columns = {column["name"] for column in inspector.get_columns("utility_bills")}
        if "remind_enabled" in columns:
            op.drop_column("utility_bills", "remind_enabled")
    if "users" in tables:
        columns = {column["name"] for column in inspector.get_columns("users")}
        if "receive_bill_reminders" in columns:
            op.drop_column("users", "receive_bill_reminders")
