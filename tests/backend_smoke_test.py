import unittest
from datetime import date
from pathlib import Path
import sys
import os
import subprocess
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.auth import require_admin, verify_password
from backend.models import AuditLog, Base, User
from backend.schemas import (
    AllocationCreate,
    CheckoutRequest,
    DictionaryReplace,
    DormCreate,
    PersonCreate,
    RoomCreate,
    UserCreate,
    UserUpdate,
    VehicleCreate,
    VehicleUpdate,
)
from backend.services import management


class BackendSmokeTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        management.seed_default_dictionaries(self.db)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_active_allocation_blocks_person_delete_then_checkout_allows_new_allocation(self):
        person = management.create_person(
            PersonCreate(
                chinese_name="张三",
                english_name=None,
                department="IT",
                person_type="Employee",
                gender="Male",
            ),
            self.db,
        )
        self.assertIsNone(person.english_name)
        dorm = management.create_dorm(
            DormCreate(name="634", type="House", address="634 Addy Ave"),
            self.db,
        )
        room = management.create_room(
            RoomCreate(
                dorm_id=dorm.id,
                room_name="101",
                room_type="Single",
                bed_count=1,
                gender_limit="Male",
            ),
            self.db,
        )
        allocation = management.create_allocation(
            AllocationCreate(
                person_id=person.id,
                dorm_id=dorm.id,
                room_id=room.id,
                check_in_date=date(2026, 5, 28),
            ),
            self.db,
        )

        with self.assertRaises(HTTPException) as blocked:
            management.delete_person(person.id, self.db)
        self.assertIn("active 入住记录", blocked.exception.detail)

        checked_out = management.checkout_allocation(allocation.id, CheckoutRequest(), self.db)
        self.assertEqual(checked_out.status, "checked_out")

        next_allocation = management.create_allocation(
            AllocationCreate(
                person_id=person.id,
                dorm_id=dorm.id,
                room_id=room.id,
                check_in_date=date(2026, 6, 1),
            ),
            self.db,
        )
        self.assertEqual(next_allocation.status, "active")

    def test_vehicle_crud_uses_soft_delete(self):
        dorm = management.create_dorm(
            DormCreate(name="Vehicle Base", type="House", address="1 Fleet Road"),
            self.db,
        )
        vehicle = management.create_vehicle(
            VehicleCreate(
                plate_number="TEST-001",
                seat_count=5,
                vehicle_type="SUV",
                base_dorm_id=dorm.id,
                status="available",
            ),
            self.db,
        )
        self.assertEqual(vehicle.vehicle_type, "SUV")

        updated = management.update_vehicle(
            vehicle.id,
            VehicleUpdate(status="maintenance", note="保养中"),
            self.db,
        )
        self.assertEqual(updated.status, "maintenance")

        management.delete_vehicle(vehicle.id, self.db)
        self.assertEqual(management.list_vehicles(self.db), [])

    def test_auth_permissions_and_audit_operator(self):
        admin = management.create_user(
            UserCreate(
                username="admin",
                password="Admin@123",
                display_name="管理员",
                role="admin",
                status="active",
            ),
            self.db,
            operator="system",
        )
        user = management.create_user(
            UserCreate(
                username="user1",
                password="User@123",
                display_name="普通用户",
                role="user",
                status="active",
            ),
            self.db,
            operator="admin",
        )
        disabled = management.create_user(
            UserCreate(
                username="disabled",
                password="Disabled@123",
                role="user",
                status="disabled",
            ),
            self.db,
            operator="admin",
        )

        admin_row = self.db.get(User, admin["id"])
        self.assertIsNotNone(admin_row)
        self.assertNotEqual(admin_row.password_hash, "Admin@123")
        self.assertTrue(verify_password("Admin@123", admin_row.password_hash))

        login_result = management.login("admin", "Admin@123", self.db)
        self.assertIn("token", login_result)
        self.assertEqual(login_result["user"]["username"], "admin")
        self.assertIsNotNone(self.db.get(User, admin["id"]).last_login_at)

        for username in ("admin", "Admin", "ADMIN"):
            result = management.login(username, "Admin@123", self.db)
            self.assertEqual(result["user"]["username"], "admin")

        with self.assertRaises(HTTPException) as wrong_password:
            management.login("admin", "bad-password", self.db)
        self.assertIn("用户名或密码错误", wrong_password.exception.detail)

        with self.assertRaises(HTTPException) as disabled_login:
            management.login("disabled", "Disabled@123", self.db)
        self.assertIn("用户已禁用", disabled_login.exception.detail)

        self.assertEqual(require_admin(self.db.get(User, admin["id"])).username, "admin")
        with self.assertRaises(HTTPException) as forbidden:
            require_admin(self.db.get(User, user["id"]))
        self.assertEqual(forbidden.exception.status_code, 403)

        info = management.system_info(self.db.get(User, admin["id"]))
        self.assertIn(info["database"], {"SQLite", "MySQL"})
        self.assertEqual(info["current_user"]["username"], "admin")
        self.assertNotIn("secret", str(info).lower())

        with self.assertRaises(HTTPException):
            management.update_user(admin["id"], UserUpdate(role="user"), self.db, operator="admin")

        management.replace_dictionary(
            "vehicleTypes",
            DictionaryReplace(items=[{"label": "SUV", "value": "SUV", "sort_order": 0}]),
            self.db,
            operator="admin",
        )
        latest_dictionary_log = (
            self.db.query(AuditLog)
            .filter(AuditLog.entity_type == "dictionary")
            .order_by(AuditLog.id.desc())
            .first()
        )
        self.assertEqual(latest_dictionary_log.operator, "admin")

        dorm = management.create_dorm(
            DormCreate(name="Auth Dorm", type="House", address="1 Auth Road"),
            self.db,
            operator="admin",
        )
        latest_dorm_log = (
            self.db.query(AuditLog)
            .filter(AuditLog.entity_type == "dorm", AuditLog.entity_id == str(dorm.id))
            .order_by(AuditLog.id.desc())
            .first()
        )
        self.assertEqual(latest_dorm_log.operator, "admin")

        management.delete_dorm(dorm.id, self.db, operator="admin")
        self.assertNotIn(dorm, management.list_dorms(self.db))

    def test_create_admin_script_creates_lowercase_admin(self):
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "script_admin.db"
            env = os.environ.copy()
            env["DATABASE_URL"] = f"sqlite:///{db_path}"
            result = subprocess.run(
                [
                    sys.executable,
                    str(repo_root / "scripts" / "create_admin.py"),
                    "--username",
                    "Admin",
                    "--password",
                    "Admin@123",
                    "--display-name",
                    "管理员",
                ],
                cwd=repo_root,
                env=env,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("admin", result.stdout)
            self.assertNotIn("pbkdf2", result.stdout)


if __name__ == "__main__":
    unittest.main()
