"""车辆管理 V2 Phase 2: 保单与续保历史、保养台账

Revision ID: 20260817_0014
Revises: 20260817_0013
Create Date: 2026-08-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260817_0014"
down_revision: Union[str, None] = "20260817_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _common_columns():
    return [
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    ]


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()

    if "insurance_policies" not in tables:
        op.create_table(
            "insurance_policies",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False, index=True),
            sa.Column("insurer", sa.String(100), nullable=False),
            sa.Column("policy_number", sa.String(80), nullable=True),
            sa.Column("coverage_type", sa.String(50), nullable=True),
            sa.Column("coverage_amount", sa.Float(), nullable=True),
            sa.Column("deductible", sa.Float(), nullable=True),
            sa.Column("premium", sa.Float(), nullable=True),
            sa.Column("premium_cycle", sa.String(20), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False, index=True),
            sa.Column("driver_snapshot", sa.String(200), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("attachment_note", sa.String(255), nullable=True),
            sa.Column("note", sa.String(500), nullable=True),
            *_common_columns(),
        )

    if "vehicle_maintenances" not in tables:
        op.create_table(
            "vehicle_maintenances",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False, index=True),
            sa.Column("maintenance_date", sa.Date(), nullable=False),
            sa.Column("odometer", sa.Integer(), nullable=True),
            sa.Column("items", sa.String(255), nullable=True),
            sa.Column("vendor", sa.String(100), nullable=True),
            sa.Column("cost", sa.Float(), nullable=True),
            sa.Column("invoice_no", sa.String(80), nullable=True),
            sa.Column("next_due_date", sa.Date(), nullable=True),
            sa.Column("next_due_mileage", sa.Integer(), nullable=True),
            sa.Column("note", sa.String(500), nullable=True),
            *_common_columns(),
        )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    for table in ("vehicle_maintenances", "insurance_policies"):
        if table in tables:
            op.drop_table(table)
