"""车辆管理 V2 Phase 3: 事故与理赔、修理台账、提醒台账

vehicle_repairs 因外键依赖 vehicle_accidents，从设计文档的 Phase 2 挪到本 migration。

Revision ID: 20260817_0015
Revises: 20260817_0014
Create Date: 2026-08-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260817_0015"
down_revision: Union[str, None] = "20260817_0014"
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

    if "vehicle_accidents" not in tables:
        op.create_table(
            "vehicle_accidents",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False, index=True),
            sa.Column("accident_datetime", sa.DateTime(), nullable=False),
            sa.Column("location", sa.String(255), nullable=True),
            sa.Column("driver_person_id", sa.Integer(), sa.ForeignKey("people.id"), nullable=True, index=True),
            sa.Column("driver_name_text", sa.String(80), nullable=True),
            sa.Column("accident_type", sa.String(50), nullable=True),
            sa.Column("liability", sa.String(50), nullable=True),
            sa.Column("description", sa.String(1000), nullable=True),
            sa.Column("has_injury", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("injury_note", sa.String(500), nullable=True),
            sa.Column("police_report_no", sa.String(80), nullable=True),
            sa.Column("third_party_info", sa.String(500), nullable=True),
            sa.Column("estimated_loss", sa.Float(), nullable=True),
            sa.Column("policy_id", sa.Integer(), sa.ForeignKey("insurance_policies.id"), nullable=True, index=True),
            sa.Column("claim_no", sa.String(80), nullable=True),
            sa.Column("claim_status", sa.String(20), nullable=False, server_default="not_filed"),
            sa.Column("claim_amount", sa.Float(), nullable=True),
            sa.Column("settled_amount", sa.Float(), nullable=True),
            sa.Column("deductible_paid", sa.Float(), nullable=True),
            sa.Column("claim_filed_date", sa.Date(), nullable=True),
            sa.Column("claim_closed_date", sa.Date(), nullable=True),
            sa.Column("note", sa.String(500), nullable=True),
            *_common_columns(),
        )

    if "vehicle_repairs" not in tables:
        op.create_table(
            "vehicle_repairs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False, index=True),
            sa.Column("accident_id", sa.Integer(), sa.ForeignKey("vehicle_accidents.id"), nullable=True, index=True),
            sa.Column("reported_date", sa.Date(), nullable=False),
            sa.Column("repair_start_date", sa.Date(), nullable=True),
            sa.Column("repair_end_date", sa.Date(), nullable=True),
            sa.Column("fault_description", sa.String(500), nullable=True),
            sa.Column("repair_content", sa.String(500), nullable=True),
            sa.Column("vendor", sa.String(100), nullable=True),
            sa.Column("cost", sa.Float(), nullable=True),
            sa.Column("paid_by", sa.String(20), nullable=True),
            sa.Column("affects_availability", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("status", sa.String(20), nullable=False, server_default="reported"),
            sa.Column("note", sa.String(500), nullable=True),
            *_common_columns(),
        )

    if "vehicle_reminder_logs" not in tables:
        op.create_table(
            "vehicle_reminder_logs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("entity_type", sa.String(40), nullable=False),
            sa.Column("entity_id", sa.Integer(), nullable=False),
            sa.Column("remind_kind", sa.String(40), nullable=False),
            sa.Column("remind_stage", sa.Integer(), nullable=False),
            sa.Column("due_target_date", sa.Date(), nullable=False),
            sa.Column("reminded_on", sa.Date(), nullable=False),
            sa.UniqueConstraint(
                "entity_type", "entity_id", "remind_kind", "remind_stage", "due_target_date",
                name="uq_vehicle_reminder_once",
            ),
        )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    for table in ("vehicle_reminder_logs", "vehicle_repairs", "vehicle_accidents"):
        if table in tables:
            op.drop_table(table)
