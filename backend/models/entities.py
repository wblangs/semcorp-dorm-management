from datetime import date, datetime
from typing import Literal, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampSoftDeleteMixin


class User(TimestampSoftDeleteMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    role: Mapped[str] = mapped_column(String(40), default="user", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # DingTalk userid for 免登 (auto-login) account linking.
    dingtalk_userid: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    # 是否接收水电房费的钉钉缴费提醒 (managed on the Users page).
    receive_bill_reminders: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 是否接收车辆到期钉钉提醒 (与缴费提醒独立，managed on the Users page).
    receive_vehicle_reminders: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Dorm(TimestampSoftDeleteMixin, Base):
    __tablename__ = "dorms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    lease_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    lease_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")

    rooms: Mapped[list["Room"]] = relationship(back_populates="dorm", cascade="all, delete-orphan")


class Room(TimestampSoftDeleteMixin, Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dorm_id: Mapped[int] = mapped_column(ForeignKey("dorms.id"), nullable=False, index=True)
    room_name: Mapped[str] = mapped_column(String(50), nullable=False)
    room_type: Mapped[str] = mapped_column(String(50), nullable=False)
    bed_count: Mapped[int] = mapped_column(Integer, nullable=False)
    gender_limit: Mapped[Literal["Male", "Female", "Any"]] = mapped_column(String(10), default="Any")
    status: Mapped[str] = mapped_column(String(20), default="active")
    # 床 bed size: Twin / Full / Queen / King
    bed_size: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # 灯 light type: 落地灯 / 顶灯
    light_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # 灯 light count
    light_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 床头柜 nightstand count
    nightstand_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 垃圾桶 trash can count
    trash_can_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    dorm: Mapped["Dorm"] = relationship(back_populates="rooms")
    allocations: Mapped[list["Allocation"]] = relationship(back_populates="room")


class RoomItem(TimestampSoftDeleteMixin, Base):
    """A flexible inventory item belonging to a room (床/灯/床头柜/垃圾桶/任意自定义物品)."""

    __tablename__ = "room_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    item_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class Person(TimestampSoftDeleteMixin, Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chinese_name: Mapped[str] = mapped_column(String(50), nullable=False)
    english_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    person_type: Mapped[str] = mapped_column(String(50), nullable=False)
    gender: Mapped[Literal["Male", "Female"]] = mapped_column(String(10), nullable=False)
    stay: Mapped[Optional["Stay"]] = relationship(
        back_populates="person", uselist=False, cascade="all, delete-orphan"
    )
    allocations: Mapped[list["Allocation"]] = relationship(back_populates="person")


class Stay(TimestampSoftDeleteMixin, Base):
    __tablename__ = "stays"

    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), primary_key=True)
    visa_type: Mapped[str] = mapped_column(String(50), nullable=False)
    arrival_date: Mapped[date] = mapped_column(Date, nullable=False)
    planned_leave_date: Mapped[date] = mapped_column(Date, nullable=False)
    max_stay_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_leave_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    person: Mapped["Person"] = relationship(back_populates="stay")


class Allocation(TimestampSoftDeleteMixin, Base):
    __tablename__ = "allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), nullable=False, index=True)
    dorm_id: Mapped[int] = mapped_column(ForeignKey("dorms.id"), nullable=False, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_check_out_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_check_out_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    check_out_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # 临时空出: the resident is away and the bed is temporarily available.
    temp_leave_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    temp_leave_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[Literal["active", "checked_out"]] = mapped_column(String(20), default="active")
    hidden_from_user_history: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    person: Mapped["Person"] = relationship(back_populates="allocations")
    room: Mapped["Room"] = relationship(back_populates="allocations")


class Vehicle(TimestampSoftDeleteMixin, Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 车牌/VIN 唯一性在服务层校验（仅比对未删除记录）；不建 DB 唯一索引，
    # 否则软删除的行会永远占住索引、同车牌无法重录。
    plate_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    vin: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    make: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    model_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # owned 自购 / leased 租赁
    ownership_type: Mapped[str] = mapped_column(String(20), default="owned", nullable=False)
    purchase_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    purchase_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lease_company: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lease_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    lease_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    lease_monthly_fee: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 派生缓存: 当前 active 调拨记录的宿舍。只能经 refresh_vehicle_caches() 写入。
    base_dorm_id: Mapped[Optional[int]] = mapped_column(ForeignKey("dorms.id"), nullable=True, index=True)
    # 派生缓存: 当前 active 保单的到期日。只能经 refresh_vehicle_caches() 写入。
    insurance_expire_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    inspection_expire_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    registration_expire_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # 派生缓存: 最近一次保养推算的下次到期日/里程。只能经 refresh_vehicle_caches() 写入。
    maintenance_due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    maintenance_due_mileage: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    odometer: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    odometer_updated_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # 保养间隔，留空时取字典 maintenanceIntervalDefaults 的主数据默认值。
    maintenance_interval_miles: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    maintenance_interval_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # available / in_repair / disabled / disposed。优先级 disposed > disabled > 自动联动:
    # 手工置 disabled/disposed 后，修理单的开单结单不再改状态。
    status: Mapped[str] = mapped_column(String(20), default="available")


class PersonLicense(TimestampSoftDeleteMixin, Base):
    """人员驾照信息，与 stays 同构：主键即 person_id，1:1 挂在人员档案上。"""

    __tablename__ = "person_licenses"

    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), primary_key=True)
    license_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    license_state: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    license_class: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    issue_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expire_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class VehicleDriver(TimestampSoftDeleteMixin, Base):
    """车辆挂保险人。每车 active 最多 MAX_INSURED_DRIVERS 个；换人置 removed 保留历史。"""

    __tablename__ = "vehicle_drivers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), nullable=False, index=True)
    # primary 主要驾驶人 / secondary 第二驾驶人
    role: Mapped[str] = mapped_column(String(20), default="secondary", nullable=False)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # active / removed
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class InsurancePolicy(TimestampSoftDeleteMixin, Base):
    """保单档案。同车同时间仅 1 张 active；续保新增一条并自动过期旧保单。"""

    __tablename__ = "insurance_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    insurer: Mapped[str] = mapped_column(String(100), nullable=False)
    policy_number: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    coverage_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    coverage_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    deductible: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    premium: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 缴费周期: monthly / semiannual / annual 等自由文本
    premium_cycle: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # 登记时 active 挂靠人姓名快照，只作历史追溯，不参与校验。
    driver_snapshot: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # active / expired / cancelled
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    # 保单文件存放位置（共享盘路径等），附件上传暂不做。
    attachment_note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class VehicleMaintenance(TimestampSoftDeleteMixin, Base):
    """保养台账。保存时回写车辆里程并刷新下次保养缓存。"""

    __tablename__ = "vehicle_maintenances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    maintenance_date: Mapped[date] = mapped_column(Date, nullable=False)
    odometer: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 保养项目，多选后逗号拼接（字典 maintenanceItems）
    items: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    vendor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    invoice_no: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    next_due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_due_mileage: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class VehicleAccident(TimestampSoftDeleteMixin, Base):
    """事故与理赔（一次事故对应一次理赔，同表维护）。"""

    __tablename__ = "vehicle_accidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    accident_datetime: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    driver_person_id: Mapped[Optional[int]] = mapped_column(ForeignKey("people.id"), nullable=True, index=True)
    # 当事人不在人员档案时（外部司机等）填这里
    driver_name_text: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    accident_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    liability: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    has_injury: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    injury_note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    police_report_no: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    third_party_info: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    estimated_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # ---- 理赔 ----
    policy_id: Mapped[Optional[int]] = mapped_column(ForeignKey("insurance_policies.id"), nullable=True, index=True)
    claim_no: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    # not_filed / filed / surveying / approved / paid / rejected / closed
    claim_status: Mapped[str] = mapped_column(String(20), default="not_filed", nullable=False)
    claim_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    settled_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    deductible_paid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    claim_filed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    claim_closed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class VehicleRepair(TimestampSoftDeleteMixin, Base):
    """修理台账。在修且影响用车时自动联动车辆状态（见 _sync_vehicle_repair_status）。"""

    __tablename__ = "vehicle_repairs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    accident_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vehicle_accidents.id"), nullable=True, index=True)
    reported_date: Mapped[date] = mapped_column(Date, nullable=False)
    repair_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    repair_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fault_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    repair_content: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    vendor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # company 公司 / insurance 保险 / driver 个人
    paid_by: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    affects_availability: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # reported / in_repair / done / cancelled
    status: Mapped[str] = mapped_column(String(20), default="reported", nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class VehicleAssignment(TimestampSoftDeleteMixin, Base):
    """车辆宿舍调拨历史。同一时间仅 1 条 active，新调拨自动结束旧记录。"""

    __tablename__ = "vehicle_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    dorm_id: Mapped[int] = mapped_column(ForeignKey("dorms.id"), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # active / ended
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class VehicleReminderLog(Base):
    """车辆类到期提醒台账。唯一键含 due_target_date：到期日一变自动重新武装，
    循环提醒（理赔滞留）每期一行。"""

    __tablename__ = "vehicle_reminder_logs"
    __table_args__ = (
        UniqueConstraint(
            "entity_type", "entity_id", "remind_kind", "remind_stage", "due_target_date",
            name="uq_vehicle_reminder_once",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # vehicle / insurance_policy / person_license / vehicle_accident
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # insurance_expire / inspection_expire / registration_expire / maintenance_due /
    # maintenance_mileage / lease_expire / license_expire / claim_stalled
    remind_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    # 提前天数档位（30/15/7），maintenance_mileage 用 90 表示 90% 阈值
    remind_stage: Mapped[int] = mapped_column(Integer, nullable=False)
    # 本次提醒针对的到期日
    due_target_date: Mapped[date] = mapped_column(Date, nullable=False)
    reminded_on: Mapped[date] = mapped_column(Date, nullable=False)


class UtilityBill(TimestampSoftDeleteMixin, Base):
    """水电网气房费: a monthly payment item for a dorm (rent/water/electricity/internet/gas)."""

    __tablename__ = "utility_bills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dorm_id: Mapped[int] = mapped_column(ForeignKey("dorms.id"), nullable=False, index=True)
    # Fee type value from the feeTypes dictionary (房租/水费/电费/网费/燃气费/...).
    fee_type: Mapped[str] = mapped_column(String(50), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # 宿舍账号: free-text account note (e.g. the provider account this bill is paid under).
    account: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[Literal["pending", "paid"]] = mapped_column(String(20), default="pending", nullable=False)
    # 是否需要提醒: per-bill switch for the DingTalk due-date reminder.
    remind_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Date the DingTalk reminder was sent; None until sent (also the idempotency guard).
    reminded_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class UtilityAccount(TimestampSoftDeleteMixin, Base):
    """缴费账户: the provider account (户号/登录信息) behind a dorm's utility service."""

    __tablename__ = "utility_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dorm_id: Mapped[int] = mapped_column(ForeignKey("dorms.id"), nullable=False, index=True)
    # Fee type value from the feeTypes dictionary (房租/水费/电费/网费/燃气费/...).
    fee_type: Mapped[str] = mapped_column(String(50), nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    account_number: Mapped[str] = mapped_column(String(100), nullable=False)
    login_username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    login_password: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class UtilityBillRecipient(TimestampSoftDeleteMixin, Base):
    """A system user who receives DingTalk reminders for utility bill due dates."""

    __tablename__ = "utility_bill_recipients"
    __table_args__ = (UniqueConstraint("user_id", name="uq_utility_bill_recipient_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)


class Dictionary(TimestampSoftDeleteMixin, Base):
    __tablename__ = "dictionaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    items: Mapped[list["DictionaryItem"]] = relationship(
        back_populates="dictionary",
        cascade="all, delete-orphan",
    )


class DictionaryItem(TimestampSoftDeleteMixin, Base):
    __tablename__ = "dictionary_items"
    __table_args__ = (UniqueConstraint("dictionary_id", "value", name="uq_dictionary_item_value"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dictionary_id: Mapped[int] = mapped_column(ForeignKey("dictionaries.id"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    dictionary: Mapped["Dictionary"] = relationship(back_populates="items")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    before_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    after_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    operator: Mapped[str] = mapped_column(String(80), default="admin", nullable=False)
