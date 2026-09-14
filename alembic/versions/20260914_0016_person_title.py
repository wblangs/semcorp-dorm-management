"""人员职称字段（汇总报表"职称"列的数据来源，选项在字典 personTitles 维护）

Revision ID: 20260914_0016
Revises: 20260817_0015
Create Date: 2026-09-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260914_0016"
down_revision: Union[str, None] = "20260817_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "people" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("people")}
        if "title" not in columns:
            op.add_column("people", sa.Column("title", sa.String(50), nullable=True))


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "people" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("people")}
        if "title" in columns:
            op.drop_column("people", "title")
