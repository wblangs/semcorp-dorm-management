import unittest
from datetime import date
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.models import Base
from backend.schemas import AllocationCreate, CheckoutRequest, DormCreate, PersonCreate, RoomCreate
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
                english_name="Zhang San",
                department="IT",
                person_type="Employee",
                gender="Male",
            ),
            self.db,
        )
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


if __name__ == "__main__":
    unittest.main()
