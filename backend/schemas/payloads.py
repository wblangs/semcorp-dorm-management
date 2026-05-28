from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class DormCreate(BaseModel):
    name: str
    type: str
    address: str
    lease_start_date: Optional[date] = None
    lease_end_date: Optional[date] = None
    status: str = "active"


class DormUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    lease_start_date: Optional[date] = None
    lease_end_date: Optional[date] = None
    status: Optional[str] = None


class RoomCreate(BaseModel):
    dorm_id: int
    room_name: str
    room_type: str
    bed_count: int = Field(gt=0)
    gender_limit: Literal["Male", "Female", "Any"] = "Any"
    status: str = "active"


class RoomUpdate(BaseModel):
    dorm_id: Optional[int] = None
    room_name: Optional[str] = None
    room_type: Optional[str] = None
    bed_count: Optional[int] = Field(default=None, gt=0)
    gender_limit: Optional[Literal["Male", "Female", "Any"]] = None
    status: Optional[str] = None


class PersonCreate(BaseModel):
    chinese_name: str
    english_name: str
    department: str
    person_type: str
    gender: Literal["Male", "Female"]
    can_drive: bool = False
    can_be_driver: bool = False


class PersonUpdate(BaseModel):
    chinese_name: Optional[str] = None
    english_name: Optional[str] = None
    department: Optional[str] = None
    person_type: Optional[str] = None
    gender: Optional[Literal["Male", "Female"]] = None
    can_drive: Optional[bool] = None
    can_be_driver: Optional[bool] = None


class AllocationCreate(BaseModel):
    person_id: int
    dorm_id: int
    room_id: int
    check_in_date: date
    expected_check_out_date: Optional[date] = None
    note: Optional[str] = None


class CheckoutRequest(BaseModel):
    check_out_date: Optional[date] = None


class AllocationUpdate(BaseModel):
    dorm_id: Optional[int] = None
    room_id: Optional[int] = None
    check_in_date: Optional[date] = None
    expected_check_out_date: Optional[date] = None
    note: Optional[str] = None


class VehicleCreate(BaseModel):
    plate_number: str
    seat_count: int = Field(gt=0)
    status: str = "available"


class StayUpsert(BaseModel):
    person_id: int
    visa_type: str
    arrival_date: date
    planned_leave_date: date
    max_stay_date: Optional[date] = None
    actual_leave_date: Optional[date] = None
    note: Optional[str] = None
