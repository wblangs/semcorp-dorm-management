"""mvp scope cleanup

Revision ID: 20260528_0002
Revises: 20260528_0001
Create Date: 2026-05-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260528_0002"
down_revision: Union[str, None] = "20260528_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "people" in inspector.get_table_names():
        columns = {column["name"]: column for column in inspector.get_columns("people")}
        if "english_name" in columns and not columns["english_name"]["nullable"]:
            with op.batch_alter_table("people") as batch:
                batch.alter_column("english_name", existing_type=sa.String(50), nullable=True)


def downgrade() -> None:
    pass
