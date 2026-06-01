from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend.core.config import settings

DATABASE_URL = settings.database_url

engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=settings.database_type == "MySQL")


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def run_lightweight_migrations() -> None:
    if settings.database_type != "SQLite":
        return

    def safe_add_column(conn, ddl: str) -> None:
        try:
            conn.execute(text(ddl))
        except OperationalError as exc:
            if "duplicate column name" not in str(exc).lower():
                raise

    with engine.begin() as conn:
        for table_name in ("dorms", "rooms", "people", "allocations", "stays", "vehicles"):
            table_exists = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"),
                {"table_name": table_name},
            ).fetchone()
            if table_exists:
                columns = {
                    row[1]
                    for row in conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                }
                if "created_at" not in columns:
                    safe_add_column(conn, f"ALTER TABLE {table_name} ADD COLUMN created_at DATETIME")
                    conn.execute(text(f"UPDATE {table_name} SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
                if "updated_at" not in columns:
                    safe_add_column(conn, f"ALTER TABLE {table_name} ADD COLUMN updated_at DATETIME")
                    conn.execute(text(f"UPDATE {table_name} SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"))
                if "is_deleted" not in columns:
                    safe_add_column(conn, f"ALTER TABLE {table_name} ADD COLUMN is_deleted BOOLEAN DEFAULT 0 NOT NULL")

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

        vehicle_table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='vehicles'")
        ).fetchone()
        if vehicle_table_exists:
            vehicle_columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(vehicles)")).fetchall()
            }
            if "vehicle_type" not in vehicle_columns:
                safe_add_column(conn, "ALTER TABLE vehicles ADD COLUMN vehicle_type VARCHAR(50)")
            if "company" not in vehicle_columns:
                safe_add_column(conn, "ALTER TABLE vehicles ADD COLUMN company VARCHAR(100)")
            if "base_dorm_id" not in vehicle_columns:
                safe_add_column(conn, "ALTER TABLE vehicles ADD COLUMN base_dorm_id INTEGER")
            if "insurance_expire_date" not in vehicle_columns:
                safe_add_column(conn, "ALTER TABLE vehicles ADD COLUMN insurance_expire_date DATE")
            if "inspection_expire_date" not in vehicle_columns:
                safe_add_column(conn, "ALTER TABLE vehicles ADD COLUMN inspection_expire_date DATE")
            if "maintenance_due_date" not in vehicle_columns:
                safe_add_column(conn, "ALTER TABLE vehicles ADD COLUMN maintenance_due_date DATE")
            if "note" not in vehicle_columns:
                safe_add_column(conn, "ALTER TABLE vehicles ADD COLUMN note VARCHAR(500)")

        people_table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='people'")
        ).fetchone()
        if people_table_exists:
            people_columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(people)")).fetchall()
            }
            if "english_name" in people_columns:
                english_not_null = next(
                    row[3]
                    for row in conn.execute(text("PRAGMA table_info(people)")).fetchall()
                    if row[1] == "english_name"
                )
                if english_not_null:
                    conn.execute(text("PRAGMA foreign_keys=OFF"))
                    conn.execute(text("ALTER TABLE people RENAME TO people_legacy_nullable_english"))
                    conn.execute(
                        text(
                            """
                            CREATE TABLE people (
                                id INTEGER NOT NULL PRIMARY KEY,
                                chinese_name VARCHAR(50) NOT NULL,
                                english_name VARCHAR(50),
                                department VARCHAR(100) NOT NULL,
                                person_type VARCHAR(50) NOT NULL,
                                gender VARCHAR(10) NOT NULL,
                                created_at DATETIME,
                                updated_at DATETIME,
                                is_deleted BOOLEAN DEFAULT 0 NOT NULL
                            )
                            """
                        )
                    )
                    conn.execute(
                        text(
                            """
                            INSERT INTO people (
                                id, chinese_name, english_name, department, person_type, gender,
                                created_at, updated_at, is_deleted
                            )
                            SELECT
                                id, chinese_name, english_name, department, person_type, gender,
                                created_at, updated_at, is_deleted
                            FROM people_legacy_nullable_english
                            """
                        )
                    )
                    conn.execute(text("DROP TABLE people_legacy_nullable_english"))
                    conn.execute(text("PRAGMA foreign_keys=ON"))

        users_table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        ).fetchone()
        if not users_table_exists:
            conn.execute(
                text(
                    """
                    CREATE TABLE users (
                        id INTEGER NOT NULL PRIMARY KEY,
                        username VARCHAR(80) NOT NULL UNIQUE,
                        password_hash VARCHAR(255) NOT NULL,
                        display_name VARCHAR(100),
                        role VARCHAR(40) NOT NULL DEFAULT 'user',
                        status VARCHAR(40) NOT NULL DEFAULT 'active',
                        last_login_at DATETIME,
                        created_at DATETIME,
                        updated_at DATETIME,
                        is_deleted BOOLEAN DEFAULT 0 NOT NULL
                    )
                    """
                )
            )
            conn.execute(text("CREATE INDEX ix_users_username ON users (username)"))
