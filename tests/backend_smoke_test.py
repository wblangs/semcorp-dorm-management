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
    AllocationUpdate,
    CheckoutRequest,
    DictionaryReplace,
    DormCreate,
    DormUpdate,
    PersonCreate,
    RoomCreate,
    RoomUpdate,
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

        checked_out = management.checkout_allocation(
            allocation.id,
            CheckoutRequest(check_out_date=date(2026, 5, 30)),
            self.db,
        )
        self.assertEqual(checked_out.status, "checked_out")
        self.assertEqual(checked_out.check_out_date, date(2026, 5, 30))

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

    def test_inactive_dorm_or_room_cannot_be_allocated(self):
        person = management.create_person(
            PersonCreate(
                chinese_name="李四",
                english_name=None,
                department="IT",
                person_type="Employee",
                gender="Male",
            ),
            self.db,
        )
        dorm = management.create_dorm(
            DormCreate(name="Inactive Test", type="House", address="2 Test Road"),
            self.db,
        )
        room = management.create_room(
            RoomCreate(
                dorm_id=dorm.id,
                room_name="201",
                room_type="Single",
                bed_count=1,
                gender_limit="Male",
            ),
            self.db,
        )

        management.update_room(room.id, RoomUpdate(status="inactive"), self.db)
        self.assertEqual(management.list_available_rooms(dorm.id, person.id, self.db), [])
        with self.assertRaises(HTTPException) as inactive_room:
            management.create_allocation(
                AllocationCreate(
                    person_id=person.id,
                    dorm_id=dorm.id,
                    room_id=room.id,
                    check_in_date=date(2026, 6, 2),
                ),
                self.db,
            )
        self.assertIn("房间不是 active 状态", inactive_room.exception.detail)

        management.update_room(room.id, RoomUpdate(status="active"), self.db)
        management.update_dorm(dorm.id, DormUpdate(status="inactive"), self.db)
        self.assertEqual(management.list_available_rooms(dorm.id, person.id, self.db), [])
        with self.assertRaises(HTTPException) as inactive_dorm:
            management.create_allocation(
                AllocationCreate(
                    person_id=person.id,
                    dorm_id=dorm.id,
                    room_id=room.id,
                    check_in_date=date(2026, 6, 2),
                ),
                self.db,
            )
        self.assertIn("宿舍不是 active 状态", inactive_dorm.exception.detail)

        active_dorm = management.create_dorm(
            DormCreate(name="Active Test", type="House", address="3 Test Road"),
            self.db,
        )
        active_room = management.create_room(
            RoomCreate(
                dorm_id=active_dorm.id,
                room_name="301",
                room_type="Single",
                bed_count=1,
                gender_limit="Male",
            ),
            self.db,
        )
        allocation = management.create_allocation(
            AllocationCreate(
                person_id=person.id,
                dorm_id=active_dorm.id,
                room_id=active_room.id,
                check_in_date=date(2026, 6, 2),
            ),
            self.db,
        )
        with self.assertRaises(HTTPException) as inactive_update:
            management.update_allocation(
                allocation.id,
                AllocationUpdate(dorm_id=dorm.id, room_id=room.id),
                self.db,
            )
        self.assertIn("宿舍不是 active 状态", inactive_update.exception.detail)

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
        self.assertEqual(vehicle["vehicle_type"], "SUV")
        # 建车时的初始宿舍生成首条调拨记录并写入缓存字段。
        self.assertEqual(vehicle["base_dorm_id"], dorm.id)
        assignments = management.list_vehicle_assignments(vehicle["id"], self.db)
        self.assertEqual(len(assignments), 1)

        updated = management.update_vehicle(
            vehicle["id"],
            VehicleUpdate(status="disabled", note="停用中"),
            self.db,
        )
        self.assertEqual(updated["status"], "disabled")

        management.delete_vehicle(vehicle["id"], self.db)
        self.assertEqual(management.list_vehicles(self.db), [])

        # 软删除不占坑：同车牌可以重新建档（唯一性只比对未删除记录）。
        again = management.create_vehicle(
            VehicleCreate(plate_number="TEST-001", seat_count=5),
            self.db,
        )
        self.assertEqual(again["plate_number"], "TEST-001")
        with self.assertRaises(HTTPException):
            management.create_vehicle(
                VehicleCreate(plate_number="TEST-001", seat_count=5),
                self.db,
            )

    def test_vehicle_v2_drivers_policies_and_status_linkage(self):
        from datetime import timedelta

        from backend.schemas import (
            InsurancePolicyCreate,
            PersonLicenseUpsert,
            VehicleAssign,
            VehicleDriverCreate,
            VehicleMaintenanceCreate,
            VehicleRepairCreate,
            VehicleRepairUpdate,
        )

        dorm_a = management.create_dorm(DormCreate(name="1号宿舍", type="House", address="A St"), self.db)
        dorm_b = management.create_dorm(DormCreate(name="2号宿舍", type="House", address="B St"), self.db)
        vehicle = management.create_vehicle(
            VehicleCreate(plate_number="JVK-4172", seat_count=7, base_dorm_id=dorm_a.id, odometer=48000),
            self.db,
        )
        vehicle_id = vehicle["id"]
        person_a = management.create_person(
            PersonCreate(chinese_name="张伟", department="IT", person_type="Employee", gender="Male"),
            self.db,
        )
        person_b = management.create_person(
            PersonCreate(chinese_name="李强", department="IT", person_type="Employee", gender="Male"),
            self.db,
        )
        person_c = management.create_person(
            PersonCreate(chinese_name="王磊", department="IT", person_type="Employee", gender="Male"),
            self.db,
        )
        management.upsert_person_license(
            PersonLicenseUpsert(person_id=person_a.id, license_number="A1", expire_date=date.today() + timedelta(days=900)),
            self.db,
        )

        # 挂靠: 无驾照的人 → 警告放行；上限 2 人；primary 唯一。
        first = management.add_vehicle_driver(
            vehicle_id, VehicleDriverCreate(person_id=person_a.id, role="primary"), self.db
        )
        self.assertEqual(first["warnings"], [])
        second = management.add_vehicle_driver(
            vehicle_id, VehicleDriverCreate(person_id=person_b.id), self.db
        )
        self.assertTrue(any("未维护驾照" in w for w in second["warnings"]))
        with self.assertRaises(HTTPException):
            management.add_vehicle_driver(
                vehicle_id, VehicleDriverCreate(person_id=person_c.id), self.db
            )

        # 保单: 续保自动过期旧保单并刷新缓存；快照记录当时挂靠人。
        p1 = management.create_vehicle_policy(
            vehicle_id,
            InsurancePolicyCreate(insurer="GEICO", start_date=date(2025, 9, 16), end_date=date(2026, 9, 15)),
            self.db,
        )
        self.assertIn("张伟", p1["policy"]["driver_snapshot"])
        p2 = management.create_vehicle_policy(
            vehicle_id,
            InsurancePolicyCreate(insurer="Progressive", start_date=date(2026, 9, 10), end_date=date(2027, 9, 9)),
            self.db,
        )
        self.assertTrue(p2["warnings"])  # 日期重叠警告放行
        detail = management.get_vehicle_detail(vehicle_id, self.db)
        self.assertEqual(detail["vehicle"]["insurance_expire_date"], date(2027, 9, 9))
        statuses = {p["id"]: p["status"] for p in detail["policies"]}
        self.assertEqual(statuses[p1["policy"]["id"]], "expired")
        # 删除生效保单 → 缓存清空（删除路径也刷新）。
        management.delete_vehicle_policy(p2["policy"]["id"], self.db)
        detail = management.get_vehicle_detail(vehicle_id, self.db)
        self.assertIsNone(detail["vehicle"]["insurance_expire_date"])

        # 保养: 自动推算下次到期（默认 5000mi/6mo 主数据），回写车辆里程。
        maintenance = management.create_vehicle_maintenance(
            vehicle_id,
            VehicleMaintenanceCreate(maintenance_date=date(2026, 2, 28), odometer=50000),
            self.db,
        )
        self.assertEqual(maintenance.next_due_date, date(2026, 8, 28))
        self.assertEqual(maintenance.next_due_mileage, 55000)
        detail = management.get_vehicle_detail(vehicle_id, self.db)
        self.assertEqual(detail["vehicle"]["odometer"], 50000)
        self.assertEqual(detail["vehicle"]["maintenance_due_date"], date(2026, 8, 28))

        # 修理联动: 在修且影响用车 → in_repair；结单 → available；手工 disabled 优先。
        repair = management.create_vehicle_repair(
            vehicle_id,
            VehicleRepairCreate(reported_date=date.today(), status="in_repair", affects_availability=True),
            self.db,
        )
        detail = management.get_vehicle_detail(vehicle_id, self.db)
        self.assertEqual(detail["vehicle"]["status"], "in_repair")
        management.update_vehicle(vehicle_id, VehicleUpdate(status="disabled"), self.db)
        management.update_vehicle_repair(repair.id, VehicleRepairUpdate(status="done"), self.db)
        detail = management.get_vehicle_detail(vehicle_id, self.db)
        self.assertEqual(detail["vehicle"]["status"], "disabled")  # 手工状态不被联动覆盖
        management.update_vehicle(vehicle_id, VehicleUpdate(status="available"), self.db)

        # 调拨: 自动结束旧记录并刷新 base_dorm_id。
        management.assign_vehicle(vehicle_id, VehicleAssign(dorm_id=dorm_b.id), self.db)
        detail = management.get_vehicle_detail(vehicle_id, self.db)
        self.assertEqual(detail["vehicle"]["base_dorm_id"], dorm_b.id)
        assignment_statuses = [a["status"] for a in detail["assignments"]]
        self.assertEqual(sorted(assignment_statuses), ["active", "ended"])

        # 提醒聚合: 30 天内到期的保养进 within30/within7/overdue 之一。
        alerts = management.vehicle_alerts(self.db)
        kinds = {item["kind"] for group in ("overdue", "within7", "within30") for item in alerts[group]}
        self.assertIn("maintenance_due", kinds)

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
