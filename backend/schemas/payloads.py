from datetime import date, datetime
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
    bed_size: Optional[str] = None
    light_type: Optional[str] = None
    light_count: int = Field(default=0, ge=0)
    nightstand_count: int = Field(default=0, ge=0)
    trash_can_count: int = Field(default=0, ge=0)


class RoomUpdate(BaseModel):
    dorm_id: Optional[int] = None
    room_name: Optional[str] = None
    room_type: Optional[str] = None
    bed_count: Optional[int] = Field(default=None, gt=0)
    gender_limit: Optional[Literal["Male", "Female", "Any"]] = None
    status: Optional[str] = None
    bed_size: Optional[str] = None
    light_type: Optional[str] = None
    light_count: Optional[int] = Field(default=None, ge=0)
    nightstand_count: Optional[int] = Field(default=None, ge=0)
    trash_can_count: Optional[int] = Field(default=None, ge=0)


class RoomItemCreate(BaseModel):
    room_id: int
    name: str
    item_type: Optional[str] = None
    count: int = Field(default=1, ge=0)


class RoomItemUpdate(BaseModel):
    name: Optional[str] = None
    item_type: Optional[str] = None
    count: Optional[int] = Field(default=None, ge=0)


class PersonCreate(BaseModel):
    chinese_name: str
    english_name: Optional[str] = None
    department: str
    person_type: str
    gender: Literal["Male", "Female"]


class PersonUpdate(BaseModel):
    chinese_name: Optional[str] = None
    english_name: Optional[str] = None
    department: Optional[str] = None
    person_type: Optional[str] = None
    gender: Optional[Literal["Male", "Female"]] = None


class AllocationCreate(BaseModel):
    person_id: int
    dorm_id: int
    room_id: int
    check_in_date: date
    expected_check_out_date: Optional[date] = None
    note: Optional[str] = None


class CheckoutRequest(BaseModel):
    check_out_date: Optional[date] = None


class AllocationTempLeave(BaseModel):
    """Set both dates to mark 临时空出; send both as null to clear it."""

    start_date: Optional[date] = None
    end_date: Optional[date] = None


class AllocationUpdate(BaseModel):
    dorm_id: Optional[int] = None
    room_id: Optional[int] = None
    check_in_date: Optional[date] = None
    expected_check_out_date: Optional[date] = None
    note: Optional[str] = None


class UtilityBillCreate(BaseModel):
    dorm_id: int
    fee_type: str
    due_date: date
    account: Optional[str] = None
    amount: Optional[float] = None
    note: Optional[str] = None
    status: str = "pending"
    remind_enabled: bool = True


class UtilityBillUpdate(BaseModel):
    dorm_id: Optional[int] = None
    fee_type: Optional[str] = None
    due_date: Optional[date] = None
    account: Optional[str] = None
    amount: Optional[float] = None
    note: Optional[str] = None
    status: Optional[str] = None
    remind_enabled: Optional[bool] = None


class UtilityAccountCreate(BaseModel):
    dorm_id: int
    fee_type: str
    account_number: str
    provider: Optional[str] = None
    login_username: Optional[str] = None
    login_password: Optional[str] = None
    website: Optional[str] = None
    note: Optional[str] = None


class UtilityAccountUpdate(BaseModel):
    dorm_id: Optional[int] = None
    fee_type: Optional[str] = None
    account_number: Optional[str] = None
    provider: Optional[str] = None
    login_username: Optional[str] = None
    login_password: Optional[str] = None
    website: Optional[str] = None
    note: Optional[str] = None


# 注意: insurance_expire_date / maintenance_due_date / base_dorm_id 是派生缓存字段，
# 有意不出现在 VehicleCreate/VehicleUpdate 里（base_dorm_id 建车时例外，用于生成首条调拨）。
class VehicleCreate(BaseModel):
    plate_number: str
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    model_year: Optional[int] = Field(default=None, ge=1980, le=2100)
    color: Optional[str] = None
    seat_count: int = Field(gt=0)
    vehicle_type: Optional[str] = None
    ownership_type: Literal["owned", "leased"] = "owned"
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = Field(default=None, ge=0)
    lease_company: Optional[str] = None
    lease_start_date: Optional[date] = None
    lease_end_date: Optional[date] = None
    lease_monthly_fee: Optional[float] = Field(default=None, ge=0)
    # 建车时的初始宿舍：会生成第一条调拨记录，之后归属只能走调拨接口。
    base_dorm_id: Optional[int] = None
    inspection_expire_date: Optional[date] = None
    registration_expire_date: Optional[date] = None
    odometer: Optional[int] = Field(default=None, ge=0)
    maintenance_interval_miles: Optional[int] = Field(default=None, gt=0)
    maintenance_interval_months: Optional[int] = Field(default=None, gt=0)
    note: Optional[str] = None
    status: Literal["available", "in_repair", "disabled", "disposed"] = "available"


class VehicleUpdate(BaseModel):
    plate_number: Optional[str] = None
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    model_year: Optional[int] = Field(default=None, ge=1980, le=2100)
    color: Optional[str] = None
    seat_count: Optional[int] = Field(default=None, gt=0)
    vehicle_type: Optional[str] = None
    ownership_type: Optional[Literal["owned", "leased"]] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = Field(default=None, ge=0)
    lease_company: Optional[str] = None
    lease_start_date: Optional[date] = None
    lease_end_date: Optional[date] = None
    lease_monthly_fee: Optional[float] = Field(default=None, ge=0)
    inspection_expire_date: Optional[date] = None
    registration_expire_date: Optional[date] = None
    maintenance_interval_miles: Optional[int] = Field(default=None, gt=0)
    maintenance_interval_months: Optional[int] = Field(default=None, gt=0)
    note: Optional[str] = None
    status: Optional[Literal["available", "in_repair", "disabled", "disposed"]] = None


class VehicleOdometerUpdate(BaseModel):
    odometer: int = Field(ge=0)
    # 新里程小于当前里程时（换表/录错），前端二次确认后带 force=true 提交。
    force: bool = False


class VehicleAssign(BaseModel):
    dorm_id: int
    start_date: Optional[date] = None
    note: Optional[str] = None


class VehicleDriverCreate(BaseModel):
    person_id: int
    role: Literal["primary", "secondary"] = "secondary"
    start_date: Optional[date] = None
    note: Optional[str] = None


class VehicleDriverUpdate(BaseModel):
    role: Optional[Literal["primary", "secondary"]] = None
    start_date: Optional[date] = None
    note: Optional[str] = None


class PersonLicenseUpsert(BaseModel):
    person_id: int
    license_number: Optional[str] = None
    license_state: Optional[str] = None
    license_class: Optional[str] = None
    issue_date: Optional[date] = None
    expire_date: Optional[date] = None
    note: Optional[str] = None


class InsurancePolicyCreate(BaseModel):
    insurer: str
    policy_number: Optional[str] = None
    coverage_type: Optional[str] = None
    coverage_amount: Optional[float] = Field(default=None, ge=0)
    deductible: Optional[float] = Field(default=None, ge=0)
    premium: Optional[float] = Field(default=None, ge=0)
    premium_cycle: Optional[str] = None
    start_date: date
    end_date: date
    attachment_note: Optional[str] = None
    note: Optional[str] = None


class InsurancePolicyUpdate(BaseModel):
    insurer: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_type: Optional[str] = None
    coverage_amount: Optional[float] = Field(default=None, ge=0)
    deductible: Optional[float] = Field(default=None, ge=0)
    premium: Optional[float] = Field(default=None, ge=0)
    premium_cycle: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[Literal["active", "expired", "cancelled"]] = None
    attachment_note: Optional[str] = None
    note: Optional[str] = None


class VehicleMaintenanceCreate(BaseModel):
    maintenance_date: date
    odometer: Optional[int] = Field(default=None, ge=0)
    items: Optional[str] = None
    vendor: Optional[str] = None
    cost: Optional[float] = Field(default=None, ge=0)
    invoice_no: Optional[str] = None
    # 留空时按车辆保养间隔自动推算
    next_due_date: Optional[date] = None
    next_due_mileage: Optional[int] = Field(default=None, ge=0)
    note: Optional[str] = None


class VehicleMaintenanceUpdate(BaseModel):
    maintenance_date: Optional[date] = None
    odometer: Optional[int] = Field(default=None, ge=0)
    items: Optional[str] = None
    vendor: Optional[str] = None
    cost: Optional[float] = Field(default=None, ge=0)
    invoice_no: Optional[str] = None
    next_due_date: Optional[date] = None
    next_due_mileage: Optional[int] = Field(default=None, ge=0)
    note: Optional[str] = None


class VehicleRepairCreate(BaseModel):
    accident_id: Optional[int] = None
    reported_date: date
    repair_start_date: Optional[date] = None
    repair_end_date: Optional[date] = None
    fault_description: Optional[str] = None
    repair_content: Optional[str] = None
    vendor: Optional[str] = None
    cost: Optional[float] = Field(default=None, ge=0)
    paid_by: Optional[Literal["company", "insurance", "driver"]] = None
    affects_availability: bool = True
    status: Literal["reported", "in_repair", "done", "cancelled"] = "reported"
    note: Optional[str] = None


class VehicleRepairUpdate(BaseModel):
    accident_id: Optional[int] = None
    reported_date: Optional[date] = None
    repair_start_date: Optional[date] = None
    repair_end_date: Optional[date] = None
    fault_description: Optional[str] = None
    repair_content: Optional[str] = None
    vendor: Optional[str] = None
    cost: Optional[float] = Field(default=None, ge=0)
    paid_by: Optional[Literal["company", "insurance", "driver"]] = None
    affects_availability: Optional[bool] = None
    status: Optional[Literal["reported", "in_repair", "done", "cancelled"]] = None
    note: Optional[str] = None


class VehicleAccidentCreate(BaseModel):
    accident_datetime: datetime
    location: Optional[str] = None
    driver_person_id: Optional[int] = None
    driver_name_text: Optional[str] = None
    accident_type: Optional[str] = None
    liability: Optional[str] = None
    description: Optional[str] = None
    has_injury: bool = False
    injury_note: Optional[str] = None
    police_report_no: Optional[str] = None
    third_party_info: Optional[str] = None
    estimated_loss: Optional[float] = Field(default=None, ge=0)
    policy_id: Optional[int] = None
    claim_no: Optional[str] = None
    claim_status: Literal["not_filed", "filed", "surveying", "approved", "paid", "rejected", "closed"] = "not_filed"
    claim_amount: Optional[float] = Field(default=None, ge=0)
    settled_amount: Optional[float] = Field(default=None, ge=0)
    deductible_paid: Optional[float] = Field(default=None, ge=0)
    claim_filed_date: Optional[date] = None
    claim_closed_date: Optional[date] = None
    note: Optional[str] = None


class VehicleAccidentUpdate(BaseModel):
    accident_datetime: Optional[datetime] = None
    location: Optional[str] = None
    driver_person_id: Optional[int] = None
    driver_name_text: Optional[str] = None
    accident_type: Optional[str] = None
    liability: Optional[str] = None
    description: Optional[str] = None
    has_injury: Optional[bool] = None
    injury_note: Optional[str] = None
    police_report_no: Optional[str] = None
    third_party_info: Optional[str] = None
    estimated_loss: Optional[float] = Field(default=None, ge=0)
    policy_id: Optional[int] = None
    claim_no: Optional[str] = None
    claim_status: Optional[Literal["not_filed", "filed", "surveying", "approved", "paid", "rejected", "closed"]] = None
    claim_amount: Optional[float] = Field(default=None, ge=0)
    settled_amount: Optional[float] = Field(default=None, ge=0)
    deductible_paid: Optional[float] = Field(default=None, ge=0)
    claim_filed_date: Optional[date] = None
    claim_closed_date: Optional[date] = None
    note: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    role: Literal["admin", "user", "viewer"] = "user"
    status: Literal["active", "disabled"] = "active"


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[Literal["admin", "user", "viewer"]] = None
    status: Optional[Literal["active", "disabled"]] = None
    dingtalk_userid: Optional[str] = None
    receive_bill_reminders: Optional[bool] = None
    receive_vehicle_reminders: Optional[bool] = None


class DingTalkLoginRequest(BaseModel):
    auth_code: str


class UserPasswordReset(BaseModel):
    password: str


class StayUpsert(BaseModel):
    person_id: int
    visa_type: str
    arrival_date: date
    planned_leave_date: date
    max_stay_date: Optional[date] = None
    actual_leave_date: Optional[date] = None
    note: Optional[str] = None


class DictionaryItemPayload(BaseModel):
    label: str
    value: str
    sort_order: int = 0


class DictionaryReplace(BaseModel):
    label: Optional[str] = None
    items: list[DictionaryItemPayload]
