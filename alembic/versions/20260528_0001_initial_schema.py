"""initial schema

Revision ID: 20260528_0001
Revises:
Create Date: 2026-05-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision: str = "20260528_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CORE_TABLES = ("dorms", "rooms", "people", "allocations", "stays")


def _has_table(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _add_common_columns(inspector, table_name: str) -> None:
    with op.batch_alter_table(table_name) as batch:
        if not _has_column(inspector, table_name, "created_at"):
            batch.add_column(sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")))
        if not _has_column(inspector, table_name, "updated_at"):
            batch.add_column(sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")))
        if not _has_column(inspector, table_name, "is_deleted"):
            batch.add_column(sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _has_table(inspector, "dorms"):
        op.create_table(
            "dorms",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("type", sa.String(50), nullable=False),
            sa.Column("address", sa.String(255), nullable=False),
            sa.Column("lease_start_date", sa.Date(), nullable=True),
            sa.Column("lease_end_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(20), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )

    inspector = inspect(bind)
    if not _has_table(inspector, "rooms"):
        op.create_table(
            "rooms",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("dorm_id", sa.Integer(), sa.ForeignKey("dorms.id"), nullable=False),
            sa.Column("room_name", sa.String(50), nullable=False),
            sa.Column("room_type", sa.String(50), nullable=False),
            sa.Column("bed_count", sa.Integer(), nullable=False),
            sa.Column("gender_limit", sa.String(10), nullable=True),
            sa.Column("status", sa.String(20), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )
        op.create_index("ix_rooms_dorm_id", "rooms", ["dorm_id"])

    inspector = inspect(bind)
    if not _has_table(inspector, "people"):
        op.create_table(
            "people",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("chinese_name", sa.String(50), nullable=False),
            sa.Column("english_name", sa.String(50), nullable=False),
            sa.Column("department", sa.String(100), nullable=False),
            sa.Column("person_type", sa.String(50), nullable=False),
            sa.Column("gender", sa.String(10), nullable=False),
            sa.Column("can_drive", sa.Boolean(), nullable=True),
            sa.Column("can_be_driver", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )

    inspector = inspect(bind)
    if not _has_table(inspector, "stays"):
        op.create_table(
            "stays",
            sa.Column("person_id", sa.Integer(), sa.ForeignKey("people.id"), primary_key=True),
            sa.Column("visa_type", sa.String(50), nullable=False),
            sa.Column("arrival_date", sa.Date(), nullable=False),
            sa.Column("planned_leave_date", sa.Date(), nullable=False),
            sa.Column("max_stay_date", sa.Date(), nullable=True),
            sa.Column("actual_leave_date", sa.Date(), nullable=True),
            sa.Column("note", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )

    inspector = inspect(bind)
    if not _has_table(inspector, "allocations"):
        op.create_table(
            "allocations",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("person_id", sa.Integer(), sa.ForeignKey("people.id"), nullable=False),
            sa.Column("dorm_id", sa.Integer(), sa.ForeignKey("dorms.id"), nullable=False),
            sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
            sa.Column("check_in_date", sa.Date(), nullable=False),
            sa.Column("expected_check_out_date", sa.Date(), nullable=True),
            sa.Column("actual_check_out_date", sa.Date(), nullable=True),
            sa.Column("note", sa.String(500), nullable=True),
            sa.Column("check_out_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(20), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )
        op.create_index("ix_allocations_person_id", "allocations", ["person_id"])
        op.create_index("ix_allocations_dorm_id", "allocations", ["dorm_id"])
        op.create_index("ix_allocations_room_id", "allocations", ["room_id"])

    inspector = inspect(bind)
    for table_name in CORE_TABLES:
        if _has_table(inspector, table_name):
            _add_common_columns(inspector, table_name)
            inspector = inspect(bind)

    if _has_table(inspector, "allocations"):
        with op.batch_alter_table("allocations") as batch:
            if not _has_column(inspector, "allocations", "expected_check_out_date"):
                batch.add_column(sa.Column("expected_check_out_date", sa.Date(), nullable=True))
            if not _has_column(inspector, "allocations", "actual_check_out_date"):
                batch.add_column(sa.Column("actual_check_out_date", sa.Date(), nullable=True))
            if not _has_column(inspector, "allocations", "note"):
                batch.add_column(sa.Column("note", sa.String(500), nullable=True))

    inspector = inspect(bind)
    if _has_table(inspector, "stays"):
        with op.batch_alter_table("stays") as batch:
            if not _has_column(inspector, "stays", "actual_leave_date"):
                batch.add_column(sa.Column("actual_leave_date", sa.Date(), nullable=True))
            if not _has_column(inspector, "stays", "note"):
                batch.add_column(sa.Column("note", sa.String(500), nullable=True))

    inspector = inspect(bind)
    if not _has_table(inspector, "vehicles"):
        op.create_table(
            "vehicles",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("plate_number", sa.String(50), nullable=False, unique=True),
            sa.Column("seat_count", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(20), nullable=True),
        )

    if not _has_table(inspector, "dictionaries"):
        op.create_table(
            "dictionaries",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("key", sa.String(80), nullable=False, unique=True),
            sa.Column("label", sa.String(100), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )
        op.create_index("ix_dictionaries_key", "dictionaries", ["key"])

    inspector = inspect(bind)
    if not _has_table(inspector, "dictionary_items"):
        op.create_table(
            "dictionary_items",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("dictionary_id", sa.Integer(), sa.ForeignKey("dictionaries.id"), nullable=False),
            sa.Column("label", sa.String(100), nullable=False),
            sa.Column("value", sa.String(100), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.UniqueConstraint("dictionary_id", "value", name="uq_dictionary_item_value"),
        )
        op.create_index("ix_dictionary_items_dictionary_id", "dictionary_items", ["dictionary_id"])

    inspector = inspect(bind)
    if not _has_table(inspector, "audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("entity_type", sa.String(80), nullable=False),
            sa.Column("entity_id", sa.String(80), nullable=False),
            sa.Column("action", sa.String(40), nullable=False),
            sa.Column("before_data", sa.Text(), nullable=True),
            sa.Column("after_data", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("operator", sa.String(80), nullable=False, server_default="admin"),
        )
        op.create_index("ix_audit_logs_entity_type", "audit_logs", ["entity_type"])
        op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"])

    for table_name in CORE_TABLES:
        if _has_table(inspector, table_name):
            bind.execute(text(f"UPDATE {table_name} SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
            bind.execute(text(f"UPDATE {table_name} SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"))
            bind.execute(text(f"UPDATE {table_name} SET is_deleted = 0 WHERE is_deleted IS NULL"))


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("dictionary_items")
    op.drop_table("dictionaries")
    op.drop_table("vehicles")
    op.drop_table("allocations")
    op.drop_table("stays")
    op.drop_table("people")
    op.drop_table("rooms")
    op.drop_table("dorms")
