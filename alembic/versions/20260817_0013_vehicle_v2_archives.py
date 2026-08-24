"""车辆管理 V2 Phase 1: 车辆档案扩展、人员驾照、挂靠人、宿舍调拨

- vehicles 表重建为 V2 结构（线上/本地均 0 行数据，带行数保护）：
  新增 VIN/品牌车型/产权/租赁/注册到期/里程/保养间隔字段，删除未使用的 company，
  车牌唯一约束降级为服务层校验（软删除行不再占住唯一索引）。
- 新表 person_licenses / vehicle_drivers / vehicle_assignments。
- users 新增 receive_vehicle_reminders（车辆提醒接收人，与缴费提醒独立）。

Revision ID: 20260817_0013
Revises: 20260724_0012
Create Date: 2026-08-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260817_0013"
down_revision: Union[str, None] = "20260724_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


VEHICLES_V2_COLUMNS = [
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column("plate_number", sa.String(50), nullable=False, index=True),
    sa.Column("vin", sa.String(32), nullable=True, index=True),
    sa.Column("make", sa.String(50), nullable=True),
    sa.Column("model", sa.String(50), nullable=True),
    sa.Column("model_year", sa.Integer(), nullable=True),
    sa.Column("color", sa.String(30), nullable=True),
    sa.Column("seat_count", sa.Integer(), nullable=False),
    sa.Column("vehicle_type", sa.String(50), nullable=True),
    sa.Column("ownership_type", sa.String(20), nullable=False, server_default="owned"),
    sa.Column("purchase_date", sa.Date(), nullable=True),
    sa.Column("purchase_price", sa.Float(), nullable=True),
    sa.Column("lease_company", sa.String(100), nullable=True),
    sa.Column("lease_start_date", sa.Date(), nullable=True),
    sa.Column("lease_end_date", sa.Date(), nullable=True),
    sa.Column("lease_monthly_fee", sa.Float(), nullable=True),
    sa.Column("base_dorm_id", sa.Integer(), sa.ForeignKey("dorms.id"), nullable=True, index=True),
    sa.Column("insurance_expire_date", sa.Date(), nullable=True),
    sa.Column("inspection_expire_date", sa.Date(), nullable=True),
    sa.Column("registration_expire_date", sa.Date(), nullable=True),
    sa.Column("maintenance_due_date", sa.Date(), nullable=True),
    sa.Column("maintenance_due_mileage", sa.Integer(), nullable=True),
    sa.Column("odometer", sa.Integer(), nullable=True),
    sa.Column("odometer_updated_on", sa.Date(), nullable=True),
    sa.Column("maintenance_interval_miles", sa.Integer(), nullable=True),
    sa.Column("maintenance_interval_months", sa.Integer(), nullable=True),
    sa.Column("note", sa.String(500), nullable=True),
    sa.Column("status", sa.String(20), nullable=True, server_default="available"),
    sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
]


def _common_columns():
    return [
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    ]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "vehicles" in tables:
        row_count = bind.execute(sa.text("SELECT COUNT(*) FROM vehicles")).scalar() or 0
        if row_count > 0:
            raise RuntimeError(
                f"vehicles 表存在 {row_count} 行数据，本 migration 预期空表重建。"
                "请先导出数据或改用 ALTER 路径后再执行。"
            )
        op.drop_table("vehicles")
    op.create_table("vehicles", *VEHICLES_V2_COLUMNS)

    if "person_licenses" not in tables:
        op.create_table(
            "person_licenses",
            sa.Column("person_id", sa.Integer(), sa.ForeignKey("people.id"), primary_key=True),
            sa.Column("license_number", sa.String(50), nullable=True),
            sa.Column("license_state", sa.String(20), nullable=True),
            sa.Column("license_class", sa.String(20), nullable=True),
            sa.Column("issue_date", sa.Date(), nullable=True),
            sa.Column("expire_date", sa.Date(), nullable=True),
            sa.Column("note", sa.String(500), nullable=True),
            *_common_columns(),
        )

    if "vehicle_drivers" not in tables:
        op.create_table(
            "vehicle_drivers",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False, index=True),
            sa.Column("person_id", sa.Integer(), sa.ForeignKey("people.id"), nullable=False, index=True),
            sa.Column("role", sa.String(20), nullable=False, server_default="secondary"),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("note", sa.String(500), nullable=True),
            *_common_columns(),
        )

    if "vehicle_assignments" not in tables:
        op.create_table(
            "vehicle_assignments",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False, index=True),
            sa.Column("dorm_id", sa.Integer(), sa.ForeignKey("dorms.id"), nullable=False, index=True),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("note", sa.String(500), nullable=True),
            *_common_columns(),
        )

    if "users" in tables:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "receive_vehicle_reminders" not in user_columns:
            op.add_column(
                "users",
                sa.Column("receive_vehicle_reminders", sa.Boolean(), nullable=False, server_default=sa.false()),
            )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    for table in ("vehicle_assignments", "vehicle_drivers", "person_licenses"):
        if table in tables:
            op.drop_table(table)
    if "users" in tables:
        columns = {column["name"] for column in inspector.get_columns("users")}
        if "receive_vehicle_reminders" in columns:
            op.drop_column("users", "receive_vehicle_reminders")
    # vehicles 表不回滚到 V1 结构（空表重建，回滚无意义）。
