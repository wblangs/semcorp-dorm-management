from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

DATABASE_URL = "sqlite:///./dorm_commute.db"

engine = create_engine(DATABASE_URL, future=True)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def run_lightweight_migrations() -> None:
    def safe_add_column(conn, ddl: str) -> None:
        try:
            conn.execute(text(ddl))
        except OperationalError as exc:
            if "duplicate column name" not in str(exc).lower():
                raise

    with engine.begin() as conn:
        allocation_table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='allocations'")
        ).fetchone()
        if allocation_table_exists:
            allocation_columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(allocations)")).fetchall()
            }
            if "expected_check_out_date" not in allocation_columns:
                safe_add_column(conn, "ALTER TABLE allocations ADD COLUMN expected_check_out_date DATE")
            if "actual_check_out_date" not in allocation_columns:
                safe_add_column(conn, "ALTER TABLE allocations ADD COLUMN actual_check_out_date DATE")
            if "note" not in allocation_columns:
                safe_add_column(conn, "ALTER TABLE allocations ADD COLUMN note VARCHAR(500)")

        stay_table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='stays'")
        ).fetchone()
        if stay_table_exists:
            stay_columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(stays)")).fetchall()
            }
            if "actual_leave_date" not in stay_columns:
                safe_add_column(conn, "ALTER TABLE stays ADD COLUMN actual_leave_date DATE")
            if "note" not in stay_columns:
                safe_add_column(conn, "ALTER TABLE stays ADD COLUMN note VARCHAR(500)")
