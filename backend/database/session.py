from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import Session

DATABASE_URL = "sqlite:///./dorm_commute.db"

engine = create_engine(DATABASE_URL, future=True)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def run_lightweight_migrations() -> None:
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='allocations'")
        ).fetchone()
        if not table_exists:
            return

        columns = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(allocations)")).fetchall()
        }
        if "expected_check_out_date" not in columns:
            conn.execute(text("ALTER TABLE allocations ADD COLUMN expected_check_out_date DATE"))
        if "actual_check_out_date" not in columns:
            conn.execute(text("ALTER TABLE allocations ADD COLUMN actual_check_out_date DATE"))
        if "note" not in columns:
            conn.execute(text("ALTER TABLE allocations ADD COLUMN note VARCHAR(500)"))
