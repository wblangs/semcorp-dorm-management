import json
import secrets
from datetime import date, datetime, timedelta
from typing import Optional, Union

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth import create_access_token, hash_password, normalize_username, verify_password
from backend.core.clock import local_now, local_today
from backend.core.config import settings
from backend.models import (
    AuditLog,
    Allocation,
    Dictionary,
    DictionaryItem,
    Dorm,
    InsurancePolicy,
    Person,
    PersonLicense,
    Room,
    RoomItem,
    Stay,
    User,
    UtilityAccount,
    UtilityBill,
    UtilityBillRecipient,
    Vehicle,
    VehicleAccident,
    VehicleAssignment,
    VehicleDriver,
    VehicleMaintenance,
    VehicleReminderLog,
    VehicleRepair,
)
from backend.schemas import (
    AllocationCreate,
    AllocationUpdate,
    CheckoutRequest,
    DictionaryReplace,
    DormCreate,
    DormUpdate,
    InsurancePolicyCreate,
    InsurancePolicyUpdate,
    PersonCreate,
    PersonLicenseUpsert,
    PersonUpdate,
    RoomCreate,
    RoomUpdate,
    RoomItemCreate,
    RoomItemUpdate,
    StayUpsert,
    UtilityAccountCreate,
    UtilityAccountUpdate,
    UtilityBillCreate,
    UtilityBillUpdate,
    VehicleAccidentCreate,
    VehicleAccidentUpdate,
    VehicleAssign,
    VehicleCreate,
    VehicleDriverCreate,
    VehicleDriverUpdate,
    VehicleMaintenanceCreate,
    VehicleMaintenanceUpdate,
    VehicleOdometerUpdate,
    VehicleRepairCreate,
    VehicleRepairUpdate,
    VehicleUpdate,
    UserCreate,
    UserPasswordReset,
    UserUpdate,
)

DEFAULT_DICTIONARIES = {
    "dormTypes": {
        "label": "宿舍类型",
        "items": [("House", "House"), ("Apartment", "Apartment"), ("Hotel", "Hotel")],
    },
    "roomTypes": {
        "label": "房间类型",
        "items": [("Single", "Single"), ("Double", "Double"), ("Suite", "Suite")],
    },
    "assetItems": {
        "label": "资产物品",
        "items": [("床", "床"), ("灯", "灯"), ("床头柜", "床头柜"), ("垃圾桶", "垃圾桶")],
    },
    "personTypes": {
        "label": "人员类型",
        "items": [("Employee", "Employee"), ("Contractor", "Contractor"), ("Visitor", "Visitor")],
    },
    "feeTypes": {
        "label": "缴费类型",
        "items": [("房租", "房租"), ("水费", "水费"), ("电费", "电费"), ("网费", "网费"), ("燃气费", "燃气费")],
    },
    "departments": {
        "label": "部门",
        "items": [
            ("IT", "IT"),
            ("质量", "质量"),
            ("生产", "生产"),
            ("技术", "技术"),
            ("设备", "设备"),
            ("EHS", "EHS"),
            ("仓库", "仓库"),
            ("HR", "HR"),
            ("财务", "财务"),
            ("行政", "行政"),
            ("采购", "采购"),
            ("物流", "物流"),
        ],
    },
    "visaTypes": {
        "label": "签证类型",
        "items": [("B1/B2", "B1/B2"), ("L1", "L1"), ("H1B", "H1B"), ("ESTA", "ESTA")],
    },
    "statuses": {
        "label": "状态",
        "items": [("active", "active"), ("inactive", "inactive")],
    },
    "vehicleTypes": {
        "label": "车辆类型",
        "items": [("SUV", "SUV"), ("Sedan", "Sedan"), ("Van", "Van"), ("Pickup", "Pickup"), ("Other", "Other")],
    },
    "insuranceCoverageTypes": {
        "label": "险种",
        "items": [
            ("Liability", "Liability"),
            ("Collision", "Collision"),
            ("Comprehensive", "Comprehensive"),
            ("Full Coverage", "Full Coverage"),
        ],
    },
    "maintenanceItems": {
        "label": "保养项目",
        "items": [
            ("换机油", "换机油"),
            ("换机油滤", "换机油滤"),
            ("换空气滤", "换空气滤"),
            ("轮胎更换", "轮胎更换"),
            ("四轮定位", "四轮定位"),
            ("刹车片", "刹车片"),
            ("电瓶", "电瓶"),
            ("变速箱油", "变速箱油"),
        ],
    },
    "accidentTypes": {
        "label": "事故类型",
        "items": [
            ("单方事故", "单方事故"),
            ("双方碰撞", "双方碰撞"),
            ("停车剐蹭", "停车剐蹭"),
            ("被追尾", "被追尾"),
            ("车辆被撞（无人在车）", "车辆被撞（无人在车）"),
            ("其他", "其他"),
        ],
    },
    "liabilityTypes": {
        "label": "责任判定",
        "items": [
            ("全责", "全责"),
            ("主要责任", "主要责任"),
            ("同等责任", "同等责任"),
            ("次要责任", "次要责任"),
            ("无责", "无责"),
            ("待定", "待定"),
        ],
    },
    "vehicleVendors": {
        "label": "车辆供应商",
        "items": [],
    },
    # 保养间隔主数据: value 格式 "miles:5000" / "months:6"，admin 在字典页维护数字部分。
    "maintenanceIntervalDefaults": {
        "label": "保养间隔默认值",
        "items": [("保养里程间隔 (miles)", "miles:5000"), ("保养月数间隔 (months)", "months:6")],
    },
}


def _json_default(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _model_data(model) -> dict:
    return {
        column.name: getattr(model, column.name)
        for column in model.__table__.columns
    }


def _audit(
    db: Session,
    *,
    entity_type: str,
    entity_id: Union[int, str],
    action: str,
    before_data: Optional[dict],
    after_data: Optional[dict],
    operator: str = "admin",
) -> None:
    db.add(
        AuditLog(
            entity_type=entity_type,
            entity_id=str(entity_id),
            action=action,
            before_data=json.dumps(before_data, ensure_ascii=False, default=_json_default) if before_data else None,
            after_data=json.dumps(after_data, ensure_ascii=False, default=_json_default) if after_data else None,
            operator=operator,
        )
    )


def _active_stmt(model):
    return select(model).where(model.is_deleted.is_(False))


def _get_active(db: Session, model, entity_id):
    entity = db.get(model, entity_id)
    if not entity or entity.is_deleted:
        return None
    return entity


def _validate_department_option(db: Session, department: Optional[str]) -> None:
    if not department:
        return
    dictionary = db.scalar(
        select(Dictionary).where(
            Dictionary.key == "departments",
            Dictionary.is_deleted.is_(False),
        )
    )
    if not dictionary:
        return
    exists = db.scalar(
        select(func.count(DictionaryItem.id)).where(
            DictionaryItem.dictionary_id == dictionary.id,
            DictionaryItem.value == department,
            DictionaryItem.is_deleted.is_(False),
        )
    )
    if not exists:
        raise HTTPException(status_code=400, detail="部门不在字典选项中")


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role,
        "status": user.status,
        "last_login_at": user.last_login_at,
        "dingtalk_userid": user.dingtalk_userid,
        "receive_bill_reminders": user.receive_bill_reminders,
        "receive_vehicle_reminders": user.receive_vehicle_reminders,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


def serialize_user(user: User) -> dict:
    return _serialize_user(user)


def _ensure_role_and_status(role: str, status: str) -> None:
    if role not in {"admin", "user", "viewer"}:
        raise HTTPException(status_code=400, detail="角色不支持")
    if status not in {"active", "disabled"}:
        raise HTTPException(status_code=400, detail="状态不支持")


def _active_admin_count(db: Session) -> int:
    return db.scalar(
        select(func.count(User.id)).where(
            User.role == "admin",
            User.status == "active",
            User.is_deleted.is_(False),
        )
    ) or 0


def login(username: str, password: str, db: Session):
    normalized_username = normalize_username(username)
    user = db.scalar(select(User).where(User.username == normalized_username, User.is_deleted.is_(False)))
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="用户已禁用")
    user.last_login_at = local_now()
    db.commit()
    db.refresh(user)
    return {"token": create_access_token(user.username), "user": _serialize_user(user)}


def dingtalk_login(auth_code: str, db: Session):
    """免登: exchange a DingTalk authCode for a session token.

    First-time DingTalk users are auto-provisioned as read-only viewers; an
    admin can later raise their role (or link the DingTalk ID to an existing
    account) in 用户管理.
    """
    from backend.services.dingtalk import get_user_by_auth_code

    info = get_user_by_auth_code(auth_code)
    user = db.scalar(
        select(User).where(User.dingtalk_userid == info["userid"], User.is_deleted.is_(False))
    )
    if not user:
        username = normalize_username(f"dd_{info['userid']}")[:80]
        existing = db.scalar(select(User).where(User.username == username, User.is_deleted.is_(False)))
        if existing:
            user = existing
            user.dingtalk_userid = info["userid"]
        else:
            user = User(
                username=username,
                # Random unusable password: this account only logs in via DingTalk
                # until an admin resets a password for it.
                password_hash=hash_password(secrets.token_urlsafe(24)),
                display_name=info["name"] or username,
                role="viewer",
                status="active",
                dingtalk_userid=info["userid"],
            )
            db.add(user)
            db.flush()
            _audit(
                db,
                entity_type="user",
                entity_id=user.id,
                action="create",
                before_data=None,
                after_data=_serialize_user(user),
                operator="dingtalk",
            )
    if user.status != "active":
        raise HTTPException(status_code=403, detail="用户已禁用")
    # Keep the display name in sync with the DingTalk directory, and heal
    # accounts created before the name lookup permission was granted.
    if info.get("name") and user.display_name != info["name"]:
        user.display_name = info["name"]
    user.last_login_at = local_now()
    db.commit()
    db.refresh(user)
    return {"token": create_access_token(user.username), "user": _serialize_user(user)}


def list_users(db: Session):
    return [_serialize_user(user) for user in db.scalars(_active_stmt(User).order_by(User.id.asc())).all()]


def create_user(payload: UserCreate, db: Session, operator: str = "admin"):
    if not payload.password:
        raise HTTPException(status_code=400, detail="密码不能为空")
    _ensure_role_and_status(payload.role, payload.status)
    normalized_username = normalize_username(payload.username)
    existing = db.scalar(select(User).where(User.username == normalized_username, User.is_deleted.is_(False)))
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(
        username=normalized_username,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        role=payload.role,
        status=payload.status,
    )
    db.add(user)
    db.flush()
    _audit(db, entity_type="user", entity_id=user.id, action="create", before_data=None, after_data=_serialize_user(user), operator=operator)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


def update_user(user_id: int, payload: UserUpdate, db: Session, operator: str = "admin"):
    user = _get_active(db, User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    next_role = payload.role if payload.role is not None else user.role
    next_status = payload.status if payload.status is not None else user.status
    _ensure_role_and_status(next_role, next_status)
    if user.role == "admin" and user.status == "active" and (next_role != "admin" or next_status != "active"):
        if _active_admin_count(db) <= 1:
            raise HTTPException(status_code=400, detail="不能禁用或降级最后一个 active admin")
    before = _serialize_user(user)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(user, key, value)
    db.flush()
    _audit(db, entity_type="user", entity_id=user.id, action="update", before_data=before, after_data=_serialize_user(user), operator=operator)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


def delete_user(user_id: int, db: Session, operator: str = "admin", operator_id: Optional[int] = None):
    user = _get_active(db, User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if operator_id is not None and user.id == operator_id:
        raise HTTPException(status_code=400, detail="不能删除当前登录的账号")
    if user.role == "admin" and user.status == "active" and _active_admin_count(db) <= 1:
        raise HTTPException(status_code=400, detail="不能删除最后一个 active admin")
    before = _serialize_user(user)
    user.is_deleted = True
    db.flush()
    _audit(db, entity_type="user", entity_id=user.id, action="delete", before_data=before, after_data=_serialize_user(user), operator=operator)
    db.commit()
    return {"deleted": True}


def reset_user_password(user_id: int, payload: UserPasswordReset, db: Session, operator: str = "admin"):
    if not payload.password:
        raise HTTPException(status_code=400, detail="密码不能为空")
    user = _get_active(db, User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    before = _serialize_user(user)
    user.password_hash = hash_password(payload.password)
    db.flush()
    _audit(db, entity_type="user", entity_id=user.id, action="reset_password", before_data=before, after_data=_serialize_user(user), operator=operator)
    db.commit()
    return {"updated": True}


def system_info(current_user: User) -> dict:
    return {
        "version": settings.app_version,
        "database": settings.database_type,
        "environment": settings.app_env,
        "current_user": _serialize_user(current_user),
    }


def _serialize_stay(stay: Optional[Stay], person: Person, today: date):
    max_stay_date = stay.max_stay_date if stay else None
    remaining_legal_days = (max_stay_date - today).days if max_stay_date else None
    if remaining_legal_days is None:
        risk_level = "unknown"
    elif remaining_legal_days <= 30:
        risk_level = "red"
    elif remaining_legal_days <= 60:
        risk_level = "yellow"
    else:
        risk_level = "green"

    days_in_us = (today - stay.arrival_date).days if stay else None
    remaining_planned_days = (stay.planned_leave_date - today).days if stay else None
    return {
        "id": person.id if stay else None,
        "person_id": person.id,
        "person": {
            "id": person.id,
            "chinese_name": person.chinese_name,
            "english_name": person.english_name or "",
            "department": person.department,
            "person_type": person.person_type,
            "gender": person.gender,
        },
        "visa_type": stay.visa_type if stay else None,
        "arrival_date": stay.arrival_date if stay else None,
        "planned_leave_date": stay.planned_leave_date if stay else None,
        "max_stay_date": max_stay_date,
        "actual_leave_date": stay.actual_leave_date if stay else None,
        "note": stay.note if stay else None,
        "days_in_us": days_in_us,
        "remaining_planned_days": remaining_planned_days,
        "remaining_legal_days": remaining_legal_days,
        "risk_level": risk_level,
    }




def _active_room_count(room_id: int, db: Session, exclude_allocation_id: Optional[int] = None) -> int:
    stmt = select(func.count(Allocation.id)).where(
        Allocation.room_id == room_id,
        Allocation.status == "active",
        Allocation.is_deleted.is_(False),
    )
    if exclude_allocation_id is not None:
        stmt = stmt.where(Allocation.id != exclude_allocation_id)
    return db.scalar(stmt) or 0


def _is_active_status(value: Optional[str]) -> bool:
    return (value or "").strip().lower() == "active"


def _validate_allocation_inputs(
    *,
    person: Optional[Person],
    dorm: Optional[Dorm],
    room: Optional[Room],
    check_in_date: Optional[date],
    db: Session,
    allocation_id_for_update: Optional[int] = None,
):
    if not person:
        raise HTTPException(status_code=400, detail="人员不存在")
    if not dorm:
        raise HTTPException(status_code=400, detail="宿舍不存在")
    if not room:
        raise HTTPException(status_code=400, detail="房间不存在")
    if person.is_deleted:
        raise HTTPException(status_code=400, detail="人员已删除")
    if dorm.is_deleted:
        raise HTTPException(status_code=400, detail="宿舍已删除")
    if room.is_deleted:
        raise HTTPException(status_code=400, detail="房间已删除")
    if not check_in_date:
        raise HTTPException(status_code=400, detail="入住日期不能为空")
    if room.dorm_id != dorm.id:
        raise HTTPException(status_code=400, detail="所选房间不属于该宿舍")
    if not _is_active_status(dorm.status):
        raise HTTPException(status_code=400, detail="宿舍不是 active 状态，不能入住")
    if not _is_active_status(room.status):
        raise HTTPException(status_code=400, detail="房间不是 active 状态，不能入住")
    if room.gender_limit != "Any" and room.gender_limit != person.gender:
        raise HTTPException(status_code=400, detail="人员性别与房间限制不匹配")
    room_active_count = _active_room_count(room.id, db, exclude_allocation_id=allocation_id_for_update)
    if room_active_count >= room.bed_count:
        raise HTTPException(status_code=400, detail="房间床位已满")


def list_dorms(db: Session):
    return db.scalars(_active_stmt(Dorm).order_by(Dorm.id.desc())).all()


def create_dorm(payload: DormCreate, db: Session, operator: str = "admin"):
    dorm = Dorm(**payload.model_dump())
    db.add(dorm)
    db.flush()
    _audit(db, entity_type="dorm", entity_id=dorm.id, action="create", before_data=None, after_data=_model_data(dorm), operator=operator)
    db.commit()
    db.refresh(dorm)
    return dorm


def update_dorm(dorm_id: int, payload: DormUpdate, db: Session, operator: str = "admin"):
    dorm = _get_active(db, Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="Dorm not found")
    before = _model_data(dorm)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(dorm, key, value)
    db.flush()
    _audit(db, entity_type="dorm", entity_id=dorm.id, action="update", before_data=before, after_data=_model_data(dorm), operator=operator)
    db.commit()
    db.refresh(dorm)
    return dorm


def delete_dorm(dorm_id: int, db: Session, operator: str = "admin"):
    dorm = _get_active(db, Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="Dorm not found")
    room_count = db.scalar(
        select(func.count(Room.id)).where(Room.dorm_id == dorm_id, Room.is_deleted.is_(False))
    ) or 0
    if room_count > 0:
        raise HTTPException(status_code=400, detail="该宿舍下还有房间，请先删除所有房间后再删除宿舍")
    vehicle_count = db.scalar(
        select(func.count(Vehicle.id)).where(Vehicle.base_dorm_id == dorm_id, Vehicle.is_deleted.is_(False))
    ) or 0
    if vehicle_count > 0:
        raise HTTPException(status_code=400, detail="该宿舍下还有车辆，请先调整车辆的常驻宿舍后再删除")
    before = _model_data(dorm)
    dorm.is_deleted = True
    db.flush()
    _audit(db, entity_type="dorm", entity_id=dorm.id, action="delete", before_data=before, after_data=_model_data(dorm), operator=operator)
    db.commit()
    return {"deleted": True}


def list_rooms(dorm_id: Optional[int], db: Session):
    stmt = _active_stmt(Room).order_by(Room.id.desc())
    if dorm_id is not None:
        stmt = stmt.where(Room.dorm_id == dorm_id)
    return db.scalars(stmt).all()


def create_room(payload: RoomCreate, db: Session, operator: str = "admin"):
    if not _get_active(db, Dorm, payload.dorm_id):
        raise HTTPException(status_code=400, detail="Dorm does not exist")
    room = Room(**payload.model_dump())
    db.add(room)
    db.flush()
    _audit(db, entity_type="room", entity_id=room.id, action="create", before_data=None, after_data=_model_data(room), operator=operator)
    db.commit()
    db.refresh(room)
    return room


def update_room(room_id: int, payload: RoomUpdate, db: Session, operator: str = "admin"):
    room = _get_active(db, Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    # exclude_unset: only update fields the client actually sent. This lets the Room
    # Assets page clear a value (send null explicitly) while leaving untouched fields
    # (e.g. assets when editing basic room info) unchanged.
    values = payload.model_dump(exclude_unset=True)
    if "dorm_id" in values and not _get_active(db, Dorm, values["dorm_id"]):
        raise HTTPException(status_code=400, detail="Dorm does not exist")
    before = _model_data(room)
    for key, value in values.items():
        setattr(room, key, value)
    db.flush()
    _audit(db, entity_type="room", entity_id=room.id, action="update", before_data=before, after_data=_model_data(room), operator=operator)
    db.commit()
    db.refresh(room)
    return room


def delete_room(room_id: int, db: Session, operator: str = "admin"):
    room = _get_active(db, Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    active_count = db.scalar(
        select(func.count(Allocation.id)).where(
            Allocation.room_id == room_id,
            Allocation.status == "active",
            Allocation.is_deleted.is_(False),
        )
    ) or 0
    if active_count > 0:
        raise HTTPException(status_code=400, detail="该房间内有人居住，不能删除")
    before = _model_data(room)
    room.is_deleted = True
    # Clean up the room's assets so they don't linger pointing at a deleted room.
    for item in db.scalars(_active_stmt(RoomItem).where(RoomItem.room_id == room_id)).all():
        item.is_deleted = True
    db.flush()
    _audit(db, entity_type="room", entity_id=room.id, action="delete", before_data=before, after_data=_model_data(room), operator=operator)
    db.commit()
    return {"deleted": True}


# ---- Room items (flexible per-room inventory) ----

def list_room_items(db: Session, room_id: Optional[int] = None):
    stmt = _active_stmt(RoomItem).order_by(RoomItem.id.asc())
    if room_id is not None:
        stmt = stmt.where(RoomItem.room_id == room_id)
    return db.scalars(stmt).all()


def create_room_item(payload: RoomItemCreate, db: Session, operator: str = "admin"):
    if not _get_active(db, Room, payload.room_id):
        raise HTTPException(status_code=400, detail="房间不存在")
    item = RoomItem(
        room_id=payload.room_id,
        name=payload.name.strip(),
        item_type=(payload.item_type or "").strip() or None,
        count=payload.count,
    )
    db.add(item)
    db.flush()
    _audit(db, entity_type="room_item", entity_id=item.id, action="create", before_data=None, after_data=_model_data(item), operator=operator)
    db.commit()
    db.refresh(item)
    return item


def update_room_item(item_id: int, payload: RoomItemUpdate, db: Session, operator: str = "admin"):
    item = _get_active(db, RoomItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="资产不存在")
    values = payload.model_dump(exclude_unset=True)
    before = _model_data(item)
    if "name" in values and values["name"] is not None:
        item.name = values["name"].strip()
    if "item_type" in values:
        item.item_type = (values["item_type"] or "").strip() or None if values["item_type"] is not None else None
    if "count" in values and values["count"] is not None:
        item.count = values["count"]
    db.flush()
    _audit(db, entity_type="room_item", entity_id=item.id, action="update", before_data=before, after_data=_model_data(item), operator=operator)
    db.commit()
    db.refresh(item)
    return item


def delete_room_item(item_id: int, db: Session, operator: str = "admin"):
    item = _get_active(db, RoomItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="资产不存在")
    before = _model_data(item)
    item.is_deleted = True
    db.flush()
    _audit(db, entity_type="room_item", entity_id=item.id, action="delete", before_data=before, after_data=_model_data(item), operator=operator)
    db.commit()
    return {"deleted": True}


def backfill_room_items(db: Session) -> None:
    """One-time migration of legacy fixed asset columns into room_items.

    Runs only when the room_items table is completely empty, so it won't
    re-create items a user has since deleted.
    """
    existing = db.scalar(select(func.count(RoomItem.id))) or 0
    if existing > 0:
        return
    rooms = db.scalars(_active_stmt(Room)).all()
    added = False
    for room in rooms:
        legacy = [
            ("床", getattr(room, "bed_size", None), getattr(room, "bed_count", 0) or 0),
            ("灯", getattr(room, "light_type", None), getattr(room, "light_count", 0) or 0),
            ("床头柜", None, getattr(room, "nightstand_count", 0) or 0),
            ("垃圾桶", None, getattr(room, "trash_can_count", 0) or 0),
        ]
        for name, item_type, count in legacy:
            if count > 0 or item_type:
                db.add(RoomItem(room_id=room.id, name=name, item_type=item_type, count=count or 1))
                added = True
    if added:
        db.commit()


def list_people(db: Session):
    return db.scalars(_active_stmt(Person).order_by(Person.id.desc())).all()


def create_person(payload: PersonCreate, db: Session, operator: str = "admin"):
    _validate_department_option(db, payload.department)
    person = Person(**payload.model_dump())
    db.add(person)
    db.flush()
    _audit(db, entity_type="person", entity_id=person.id, action="create", before_data=None, after_data=_model_data(person), operator=operator)
    db.commit()
    db.refresh(person)
    return person


def update_person(person_id: int, payload: PersonUpdate, db: Session, operator: str = "admin"):
    person = _get_active(db, Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    if payload.department is not None:
        _validate_department_option(db, payload.department)
    before = _model_data(person)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(person, key, value)
    db.flush()
    _audit(db, entity_type="person", entity_id=person.id, action="update", before_data=before, after_data=_model_data(person), operator=operator)
    db.commit()
    db.refresh(person)
    return person


def delete_person(person_id: int, db: Session, operator: str = "admin"):
    person = _get_active(db, Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    active_count = db.scalar(
        select(func.count(Allocation.id)).where(
            Allocation.person_id == person_id,
            Allocation.status == "active",
            Allocation.is_deleted.is_(False),
        )
    ) or 0
    if active_count > 0:
        raise HTTPException(status_code=400, detail="人员存在 active 入住记录，不能删除")
    before = _model_data(person)
    person.is_deleted = True
    if person.stay and not person.stay.is_deleted:
        person.stay.is_deleted = True
    db.flush()
    _audit(db, entity_type="person", entity_id=person.id, action="delete", before_data=before, after_data=_model_data(person), operator=operator)
    db.commit()
    return {"deleted": True}


def list_stay(db: Session):
    people = db.scalars(_active_stmt(Person).order_by(Person.id.asc())).all()
    stays = db.scalars(_active_stmt(Stay)).all()
    stay_map = {stay.person_id: stay for stay in stays}
    today = local_today()
    return [_serialize_stay(stay_map.get(person.id), person, today) for person in people]


def get_stay(person_id: int, db: Session):
    person = _get_active(db, Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    today = local_today()
    stay = _get_active(db, Stay, person_id)
    return _serialize_stay(stay, person, today)


def upsert_stay(payload: StayUpsert, db: Session, operator: str = "admin"):
    person = _get_active(db, Person, payload.person_id)
    if not person:
        raise HTTPException(status_code=400, detail="人员不存在")
    if payload.actual_leave_date and payload.actual_leave_date < payload.arrival_date:
        raise HTTPException(status_code=400, detail="实际离美日期不能早于赴美日期")
    stay = _get_active(db, Stay, payload.person_id)
    if stay:
        before = _model_data(stay)
        for key, value in payload.model_dump().items():
            setattr(stay, key, value)
        action = "update"
    else:
        stay = Stay(**payload.model_dump())
        db.add(stay)
        before = None
        action = "create"
    db.flush()
    _audit(db, entity_type="stay", entity_id=stay.person_id, action=action, before_data=before, after_data=_model_data(stay), operator=operator)
    db.commit()
    db.refresh(stay)
    return _serialize_stay(stay, person, local_today())


def delete_stay(stay_id: int, db: Session, operator: str = "admin"):
    stay = _get_active(db, Stay, stay_id)
    if not stay:
        raise HTTPException(status_code=404, detail="Stay 记录不存在")
    before = _model_data(stay)
    stay.is_deleted = True
    db.flush()
    _audit(db, entity_type="stay", entity_id=stay.person_id, action="delete", before_data=before, after_data=_model_data(stay), operator=operator)
    db.commit()
    return {"deleted": True}


def list_stay_risks(db: Session):
    rows = list_stay(db)
    risk_summary = {"red": 0, "yellow": 0, "green": 0, "unknown": 0}
    expiring30 = []
    expiring60 = []
    overstayed = []
    for item in rows:
        risk_summary[item["risk_level"]] += 1
        remaining_legal_days = item["remaining_legal_days"]
        if remaining_legal_days is not None and remaining_legal_days <= 30:
            expiring30.append(item)
        if remaining_legal_days is not None and remaining_legal_days <= 60:
            expiring60.append(item)
        if (
            remaining_legal_days is not None
            and remaining_legal_days < 0
            and item["actual_leave_date"] is None
            and item["id"] is not None
        ):
            overstayed.append(item)

    expiring30.sort(key=lambda x: x["remaining_legal_days"])
    expiring60.sort(key=lambda x: x["remaining_legal_days"])
    overstayed.sort(key=lambda x: x["remaining_legal_days"])
    return {
        "riskSummary": risk_summary,
        "expiring30": expiring30,
        "expiring60": expiring60,
        "overstayed": overstayed,
    }


def list_allocations(db: Session):
    return db.scalars(
        _active_stmt(Allocation)
        .where(Allocation.hidden_from_user_history.is_(False))
        .order_by(Allocation.id.desc())
    ).all()


def list_allocation_backup_history(db: Session):
    return db.scalars(_active_stmt(Allocation).order_by(Allocation.id.desc())).all()


def create_allocation(payload: AllocationCreate, db: Session, operator: str = "admin"):
    person = _get_active(db, Person, payload.person_id)
    dorm = _get_active(db, Dorm, payload.dorm_id)
    room = _get_active(db, Room, payload.room_id)
    _validate_allocation_inputs(
        person=person,
        dorm=dorm,
        room=room,
        check_in_date=payload.check_in_date,
        db=db,
    )
    active_person_stmt = select(func.count(Allocation.id)).where(
        Allocation.person_id == payload.person_id,
        Allocation.status == "active",
        Allocation.is_deleted.is_(False),
    )
    if db.scalar(active_person_stmt) > 0:
        raise HTTPException(status_code=400, detail="该人员已有在住记录，请先退宿")

    allocation = Allocation(
        person_id=payload.person_id,
        dorm_id=payload.dorm_id,
        room_id=payload.room_id,
        check_in_date=payload.check_in_date,
        expected_check_out_date=payload.expected_check_out_date,
        note=payload.note,
        status="active",
    )
    db.add(allocation)
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="create",
        before_data=None,
        after_data=_model_data(allocation),
        operator=operator,
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def update_allocation(allocation_id: int, payload: AllocationUpdate, db: Session, operator: str = "admin"):
    allocation = _get_active(db, Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    if allocation.status != "active":
        raise HTTPException(status_code=400, detail="仅在住记录允许修改")

    next_dorm_id = payload.dorm_id if payload.dorm_id is not None else allocation.dorm_id
    next_room_id = payload.room_id if payload.room_id is not None else allocation.room_id
    next_check_in = payload.check_in_date if payload.check_in_date is not None else allocation.check_in_date

    person = _get_active(db, Person, allocation.person_id)
    dorm = _get_active(db, Dorm, next_dorm_id)
    room = _get_active(db, Room, next_room_id)
    _validate_allocation_inputs(
        person=person,
        dorm=dorm,
        room=room,
        check_in_date=next_check_in,
        db=db,
        allocation_id_for_update=allocation.id,
    )

    update_data = payload.model_dump(exclude_none=True)
    before = _model_data(allocation)
    for key, value in update_data.items():
        setattr(allocation, key, value)
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="update",
        before_data=before,
        after_data=_model_data(allocation),
        operator=operator,
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def set_allocation_temp_leave(allocation_id: int, payload, db: Session, operator: str = "admin"):
    allocation = _get_active(db, Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    if allocation.status != "active":
        raise HTTPException(status_code=400, detail="仅在住记录可设置临时空出")
    if (payload.start_date is None) != (payload.end_date is None):
        raise HTTPException(status_code=400, detail="请同时填写开始和结束日期")
    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="结束日期不能早于开始日期")
    before = _model_data(allocation)
    allocation.temp_leave_start = payload.start_date
    allocation.temp_leave_end = payload.end_date
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="temp_leave",
        before_data=before,
        after_data=_model_data(allocation),
        operator=operator,
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def checkout_allocation(allocation_id: int, payload: CheckoutRequest, db: Session, operator: str = "admin"):
    allocation = _get_active(db, Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    if allocation.status == "checked_out":
        raise HTTPException(status_code=400, detail="该入住记录已退宿")
    before = _model_data(allocation)
    checkout_date = payload.check_out_date or local_today()
    allocation.actual_check_out_date = checkout_date
    allocation.check_out_date = checkout_date
    allocation.status = "checked_out"
    # A checked-out record can't be temporarily away.
    allocation.temp_leave_start = None
    allocation.temp_leave_end = None
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="checkout",
        before_data=before,
        after_data=_model_data(allocation),
        operator=operator,
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def hide_allocation_from_user_history(allocation_id: int, db: Session, operator: str = "admin"):
    allocation = _get_active(db, Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    if allocation.status == "active":
        raise HTTPException(status_code=400, detail="active 入住记录不能直接删除，请先退房")
    if allocation.status != "checked_out":
        raise HTTPException(status_code=400, detail="仅已退宿入住记录允许从用户历史中删除")
    before = _model_data(allocation)
    allocation.hidden_from_user_history = True
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="hide_from_user_history",
        before_data=before,
        after_data=_model_data(allocation),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


def delete_allocation_backup(allocation_id: int, db: Session, operator: str = "admin"):
    allocation = _get_active(db, Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住备份记录不存在")
    if allocation.status == "active":
        raise HTTPException(status_code=400, detail="active 入住记录不能直接删除，请先退房")
    before = _model_data(allocation)
    allocation.is_deleted = True
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="delete_backup",
        before_data=before,
        after_data=_model_data(allocation),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


def recover_allocation_user_history(allocation_id: int, db: Session, operator: str = "admin"):
    allocation = _get_active(db, Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住备份记录不存在")
    before = _model_data(allocation)
    allocation.hidden_from_user_history = False
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="recover_user_history",
        before_data=before,
        after_data=_model_data(allocation),
        operator=operator,
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def list_available_rooms(dorm_id: int, person_id: int, db: Session):
    person = _get_active(db, Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    dorm = _get_active(db, Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="宿舍不存在")
    if not _is_active_status(dorm.status):
        return []

    rooms = db.scalars(
        _active_stmt(Room).where(Room.dorm_id == dorm_id).order_by(Room.id.asc())
    ).all()
    result = []
    for room in rooms:
        if not _is_active_status(room.status):
            continue
        if room.gender_limit != "Any" and room.gender_limit != person.gender:
            continue
        active_count = _active_room_count(room.id, db)
        if active_count >= room.bed_count:
            continue
        result.append(
            {
                "id": room.id,
                "dorm_id": room.dorm_id,
                "room_name": room.room_name,
                "room_type": room.room_type,
                "bed_count": room.bed_count,
                "gender_limit": room.gender_limit,
                "status": room.status,
                "active_occupancy": active_count,
                "available_beds": room.bed_count - active_count,
            }
        )
    return result


# ---------------- 车辆管理 V2 ----------------
# 工作流状态是固定值域（不进字典）: 值参与状态联动/进度条/统计口径，
# admin 改字典 value 会静默破坏逻辑，见 docs/VEHICLE_MODULE_DESIGN.md §3.11。

MAX_INSURED_DRIVERS = 2
VEHICLE_STATUSES = {"available", "in_repair", "disabled", "disposed"}
REPAIR_STATUSES = {"reported", "in_repair", "done", "cancelled"}
CLAIM_OPEN_STATUSES = {"filed", "surveying", "approved"}
DEFAULT_MAINTENANCE_INTERVAL_MILES = 5000
DEFAULT_MAINTENANCE_INTERVAL_MONTHS = 6
VEHICLE_REMINDER_SEND_HOUR = 9
# 提前提醒档位；0 表示已过期后的一次性提醒。每次只发最贴近的档位（min applicable）。
VEHICLE_REMINDER_STAGES = {
    "insurance_expire": [30, 15, 7, 0],
    "inspection_expire": [30, 7, 0],
    "registration_expire": [30, 7, 0],
    "maintenance_due": [15, 0],
    "lease_expire": [60, 30, 0],
    "license_expire": [30, 7, 0],
}
VEHICLE_REMIND_KIND_LABELS = {
    "insurance_expire": "保险到期",
    "inspection_expire": "年检到期",
    "registration_expire": "注册到期",
    "maintenance_due": "保养到期",
    "maintenance_mileage": "保养里程临近",
    "lease_expire": "租赁合同到期",
    "license_expire": "驾照到期",
    "claim_stalled": "理赔超期未结案",
}


def _add_months(base: date, months: int) -> date:
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    # Clamp the day for shorter target months (e.g. Jan 31 + 1 month -> Feb 28).
    day = min(base.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                         31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


def _maintenance_interval_defaults(db: Session) -> tuple[int, int]:
    """主数据默认保养间隔，字典 maintenanceIntervalDefaults，value 形如 miles:5000 / months:6。"""
    miles, months = DEFAULT_MAINTENANCE_INTERVAL_MILES, DEFAULT_MAINTENANCE_INTERVAL_MONTHS
    dictionary = db.scalar(
        select(Dictionary).where(Dictionary.key == "maintenanceIntervalDefaults", Dictionary.is_deleted.is_(False))
    )
    if dictionary:
        for item in db.scalars(
            _active_stmt(DictionaryItem).where(DictionaryItem.dictionary_id == dictionary.id)
        ).all():
            kind, _, raw = (item.value or "").partition(":")
            try:
                number = int(raw.strip())
            except ValueError:
                continue
            if kind.strip() == "miles" and number > 0:
                miles = number
            elif kind.strip() == "months" and number > 0:
                months = number
    return miles, months


def _vehicle_intervals(vehicle: Vehicle, db: Session) -> tuple[int, int]:
    default_miles, default_months = _maintenance_interval_defaults(db)
    return (
        vehicle.maintenance_interval_miles or default_miles,
        vehicle.maintenance_interval_months or default_months,
    )


def _ensure_vehicle_identity_unique(
    db: Session, plate_number: str, vin: Optional[str], exclude_id: Optional[int]
) -> None:
    """车牌/VIN 唯一性服务层校验：只比对未删除记录（软删除行不占坑）。"""
    stmt = select(func.count(Vehicle.id)).where(
        Vehicle.plate_number == plate_number, Vehicle.is_deleted.is_(False)
    )
    if exclude_id is not None:
        stmt = stmt.where(Vehicle.id != exclude_id)
    if (db.scalar(stmt) or 0) > 0:
        raise HTTPException(status_code=400, detail="车牌号已存在")
    if vin:
        stmt = select(func.count(Vehicle.id)).where(Vehicle.vin == vin, Vehicle.is_deleted.is_(False))
        if exclude_id is not None:
            stmt = stmt.where(Vehicle.id != exclude_id)
        if (db.scalar(stmt) or 0) > 0:
            raise HTTPException(status_code=400, detail="车架号 VIN 已存在")


def refresh_vehicle_caches(db: Session, vehicle_id: int) -> None:
    """派生缓存的唯一写入口：保单/保养/调拨的任何增改删之后都必须调用。

    覆盖删除路径很关键——删掉当前生效保单后 insurance_expire_date 必须清空，
    否则缓存悬空。不 commit，由调用方统一提交。
    """
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle:
        return
    active_policy = db.scalar(
        _active_stmt(InsurancePolicy)
        .where(InsurancePolicy.vehicle_id == vehicle_id, InsurancePolicy.status == "active")
        .order_by(InsurancePolicy.end_date.desc(), InsurancePolicy.id.desc())
    )
    vehicle.insurance_expire_date = active_policy.end_date if active_policy else None
    latest_maintenance = db.scalar(
        _active_stmt(VehicleMaintenance)
        .where(VehicleMaintenance.vehicle_id == vehicle_id)
        .order_by(VehicleMaintenance.maintenance_date.desc(), VehicleMaintenance.id.desc())
    )
    vehicle.maintenance_due_date = latest_maintenance.next_due_date if latest_maintenance else None
    vehicle.maintenance_due_mileage = latest_maintenance.next_due_mileage if latest_maintenance else None
    active_assignment = db.scalar(
        _active_stmt(VehicleAssignment)
        .where(VehicleAssignment.vehicle_id == vehicle_id, VehicleAssignment.status == "active")
        .order_by(VehicleAssignment.id.desc())
    )
    vehicle.base_dorm_id = active_assignment.dorm_id if active_assignment else None
    db.flush()


def _sync_vehicle_repair_status(db: Session, vehicle: Vehicle) -> None:
    """在修联动。优先级 disposed > disabled > 自动联动：手工停用/处置后联动不碰状态。"""
    if vehicle.status in ("disabled", "disposed"):
        return
    blocking = db.scalar(
        select(func.count(VehicleRepair.id)).where(
            VehicleRepair.vehicle_id == vehicle.id,
            VehicleRepair.is_deleted.is_(False),
            VehicleRepair.status == "in_repair",
            VehicleRepair.affects_availability.is_(True),
        )
    ) or 0
    vehicle.status = "in_repair" if blocking else "available"
    db.flush()


def _serialize_license(license_row: Optional[PersonLicense]) -> Optional[dict]:
    if not license_row:
        return None
    return _model_data(license_row)


def _driver_warnings(person: Optional[Person], license_row: Optional[PersonLicense], stay: Optional[Stay]) -> list[str]:
    """驾照缺失/过期、人员已离场 → 警告放行（已确认决策），同时进提醒页。"""
    warnings: list[str] = []
    name = person.chinese_name if person else "该人员"
    today = local_today()
    if not license_row or not license_row.expire_date:
        warnings.append(f"{name} 未维护驾照信息")
    elif license_row.expire_date < today:
        warnings.append(f"{name} 的驾照已于 {license_row.expire_date.isoformat()} 过期")
    if stay and stay.actual_leave_date and stay.actual_leave_date <= today:
        warnings.append(f"{name} 已于 {stay.actual_leave_date.isoformat()} 离场，需更换被保险人")
    return warnings


def _serialize_vehicle_driver(
    driver: VehicleDriver,
    person: Optional[Person],
    license_row: Optional[PersonLicense],
) -> dict:
    data = _model_data(driver)
    data["person"] = (
        {
            "id": person.id,
            "chinese_name": person.chinese_name,
            "english_name": person.english_name,
            "department": person.department,
            "person_type": person.person_type,
        }
        if person
        else None
    )
    data["license"] = _serialize_license(license_row)
    return data


def _vehicle_driver_rows(db: Session, vehicle_ids: Optional[list[int]] = None, only_active: bool = True):
    stmt = (
        select(VehicleDriver, Person, PersonLicense)
        .join(Person, VehicleDriver.person_id == Person.id, isouter=True)
        .join(
            PersonLicense,
            (PersonLicense.person_id == VehicleDriver.person_id) & PersonLicense.is_deleted.is_(False),
            isouter=True,
        )
        .where(VehicleDriver.is_deleted.is_(False))
        .order_by(VehicleDriver.id.asc())
    )
    if only_active:
        stmt = stmt.where(VehicleDriver.status == "active")
    if vehicle_ids is not None:
        stmt = stmt.where(VehicleDriver.vehicle_id.in_(vehicle_ids))
    return db.execute(stmt).all()


def list_vehicles(db: Session):
    vehicles = db.scalars(_active_stmt(Vehicle).order_by(Vehicle.id.desc())).all()
    drivers_by_vehicle: dict[int, list[dict]] = {}
    for driver, person, license_row in _vehicle_driver_rows(db):
        drivers_by_vehicle.setdefault(driver.vehicle_id, []).append(
            _serialize_vehicle_driver(driver, person, license_row)
        )
    result = []
    for vehicle in vehicles:
        data = _model_data(vehicle)
        data["drivers"] = drivers_by_vehicle.get(vehicle.id, [])
        result.append(data)
    return result


def get_vehicle_detail(vehicle_id: int, db: Session):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    stays = {
        stay.person_id: stay
        for stay in db.scalars(_active_stmt(Stay)).all()
    }
    active_drivers = []
    warnings: list[str] = []
    for driver, person, license_row in _vehicle_driver_rows(db, [vehicle_id]):
        active_drivers.append(_serialize_vehicle_driver(driver, person, license_row))
        warnings.extend(_driver_warnings(person, license_row, stays.get(driver.person_id)))
    driver_history = [
        _serialize_vehicle_driver(driver, person, license_row)
        for driver, person, license_row in _vehicle_driver_rows(db, [vehicle_id], only_active=False)
    ]
    policies = [
        _model_data(row)
        for row in db.scalars(
            _active_stmt(InsurancePolicy)
            .where(InsurancePolicy.vehicle_id == vehicle_id)
            .order_by(InsurancePolicy.end_date.desc(), InsurancePolicy.id.desc())
        ).all()
    ]
    maintenances = [
        _model_data(row)
        for row in db.scalars(
            _active_stmt(VehicleMaintenance)
            .where(VehicleMaintenance.vehicle_id == vehicle_id)
            .order_by(VehicleMaintenance.maintenance_date.desc(), VehicleMaintenance.id.desc())
        ).all()
    ]
    repairs = [
        _model_data(row)
        for row in db.scalars(
            _active_stmt(VehicleRepair)
            .where(VehicleRepair.vehicle_id == vehicle_id)
            .order_by(VehicleRepair.reported_date.desc(), VehicleRepair.id.desc())
        ).all()
    ]
    accidents = [
        _model_data(row)
        for row in db.scalars(
            _active_stmt(VehicleAccident)
            .where(VehicleAccident.vehicle_id == vehicle_id)
            .order_by(VehicleAccident.accident_datetime.desc(), VehicleAccident.id.desc())
        ).all()
    ]
    assignments = [
        _model_data(row)
        for row in db.scalars(
            _active_stmt(VehicleAssignment)
            .where(VehicleAssignment.vehicle_id == vehicle_id)
            .order_by(VehicleAssignment.start_date.desc(), VehicleAssignment.id.desc())
        ).all()
    ]
    interval_miles, interval_months = _vehicle_intervals(vehicle, db)
    data = _model_data(vehicle)
    data["effective_interval_miles"] = interval_miles
    data["effective_interval_months"] = interval_months
    return {
        "vehicle": data,
        "drivers": active_drivers,
        "driver_history": driver_history,
        "driver_warnings": warnings,
        "policies": policies,
        "maintenances": maintenances,
        "repairs": repairs,
        "accidents": accidents,
        "assignments": assignments,
    }


def create_vehicle(payload: VehicleCreate, db: Session, operator: str = "admin"):
    data = payload.model_dump()
    data["plate_number"] = data["plate_number"].strip()
    data["vin"] = (data.get("vin") or "").strip() or None
    _ensure_vehicle_identity_unique(db, data["plate_number"], data["vin"], None)
    base_dorm_id = data.pop("base_dorm_id", None)
    if base_dorm_id and not _get_active(db, Dorm, base_dorm_id):
        raise HTTPException(status_code=400, detail="所属宿舍不存在")
    if data.get("odometer") is not None:
        data["odometer_updated_on"] = local_today()
    vehicle = Vehicle(**data)
    db.add(vehicle)
    db.flush()
    if base_dorm_id:
        db.add(
            VehicleAssignment(
                vehicle_id=vehicle.id,
                dorm_id=base_dorm_id,
                start_date=local_today(),
                status="active",
                note="建档初始宿舍",
            )
        )
        db.flush()
        refresh_vehicle_caches(db, vehicle.id)
    _audit(
        db,
        entity_type="vehicle",
        entity_id=vehicle.id,
        action="create",
        before_data=None,
        after_data=_model_data(vehicle),
        operator=operator,
    )
    db.commit()
    db.refresh(vehicle)
    return _model_data(vehicle)


def update_vehicle(vehicle_id: int, payload: VehicleUpdate, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    # exclude_unset: 允许显式送 null 清空可空字段（如租赁信息），未送字段不动。
    values = payload.model_dump(exclude_unset=True)
    next_plate = (values.get("plate_number") or vehicle.plate_number).strip()
    next_vin = values["vin"].strip() if values.get("vin") else (None if "vin" in values else vehicle.vin)
    _ensure_vehicle_identity_unique(db, next_plate, next_vin, vehicle.id)
    if "plate_number" in values:
        values["plate_number"] = next_plate
    if "vin" in values:
        values["vin"] = next_vin
    before = _model_data(vehicle)
    for key, value in values.items():
        setattr(vehicle, key, value)
    # 手工把状态改回 available/in_repair 时，让在修联动立即重算，保持一致。
    if values.get("status") in ("available", "in_repair"):
        _sync_vehicle_repair_status(db, vehicle)
    db.flush()
    _audit(
        db,
        entity_type="vehicle",
        entity_id=vehicle.id,
        action="update",
        before_data=before,
        after_data=_model_data(vehicle),
        operator=operator,
    )
    db.commit()
    db.refresh(vehicle)
    return _model_data(vehicle)


def update_vehicle_odometer(vehicle_id: int, payload: VehicleOdometerUpdate, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    if vehicle.odometer is not None and payload.odometer < vehicle.odometer and not payload.force:
        raise HTTPException(
            status_code=409,
            detail=f"新里程 {payload.odometer} 小于当前里程 {vehicle.odometer}，可能是换表或录错；确认无误请再次提交",
        )
    before = _model_data(vehicle)
    vehicle.odometer = payload.odometer
    vehicle.odometer_updated_on = local_today()
    db.flush()
    _audit(
        db,
        entity_type="vehicle",
        entity_id=vehicle.id,
        action="update_odometer",
        before_data=before,
        after_data=_model_data(vehicle),
        operator=operator,
    )
    db.commit()
    db.refresh(vehicle)
    return _model_data(vehicle)


def delete_vehicle(vehicle_id: int, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    before = _model_data(vehicle)
    vehicle.is_deleted = True
    db.flush()
    _audit(
        db,
        entity_type="vehicle",
        entity_id=vehicle.id,
        action="delete",
        before_data=before,
        after_data=_model_data(vehicle),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


# ---- 宿舍调拨 ----

def list_vehicle_assignments(vehicle_id: int, db: Session):
    if not _get_active(db, Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="车辆不存在")
    return db.scalars(
        _active_stmt(VehicleAssignment)
        .where(VehicleAssignment.vehicle_id == vehicle_id)
        .order_by(VehicleAssignment.start_date.desc(), VehicleAssignment.id.desc())
    ).all()


def assign_vehicle(vehicle_id: int, payload: VehicleAssign, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    dorm = _get_active(db, Dorm, payload.dorm_id)
    if not dorm:
        raise HTTPException(status_code=400, detail="宿舍不存在")
    start_date = payload.start_date or local_today()
    current = db.scalar(
        _active_stmt(VehicleAssignment).where(
            VehicleAssignment.vehicle_id == vehicle_id, VehicleAssignment.status == "active"
        )
    )
    if current and current.dorm_id == payload.dorm_id:
        raise HTTPException(status_code=400, detail="车辆已在该宿舍，无需调拨")
    if current:
        current.status = "ended"
        current.end_date = start_date
    assignment = VehicleAssignment(
        vehicle_id=vehicle_id,
        dorm_id=payload.dorm_id,
        start_date=start_date,
        status="active",
        note=payload.note,
    )
    db.add(assignment)
    db.flush()
    refresh_vehicle_caches(db, vehicle_id)
    _audit(
        db,
        entity_type="vehicle_assignment",
        entity_id=assignment.id,
        action="assign",
        before_data=_model_data(current) if current else None,
        after_data=_model_data(assignment),
        operator=operator,
    )
    db.commit()
    db.refresh(assignment)
    return assignment


# ---- 挂靠人（被保险人） ----

def list_vehicle_drivers(vehicle_id: int, db: Session):
    if not _get_active(db, Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="车辆不存在")
    return [
        _serialize_vehicle_driver(driver, person, license_row)
        for driver, person, license_row in _vehicle_driver_rows(db, [vehicle_id], only_active=False)
    ]


def add_vehicle_driver(vehicle_id: int, payload: VehicleDriverCreate, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    person = _get_active(db, Person, payload.person_id)
    if not person:
        raise HTTPException(status_code=400, detail="人员不存在")
    active = db.scalars(
        _active_stmt(VehicleDriver).where(
            VehicleDriver.vehicle_id == vehicle_id, VehicleDriver.status == "active"
        )
    ).all()
    if any(driver.person_id == payload.person_id for driver in active):
        raise HTTPException(status_code=400, detail="该人员已挂靠在这辆车上")
    if len(active) >= MAX_INSURED_DRIVERS:
        raise HTTPException(status_code=400, detail=f"每辆车最多挂 {MAX_INSURED_DRIVERS} 个被保险人，请先解除现有挂靠")
    if payload.role == "primary" and any(driver.role == "primary" for driver in active):
        raise HTTPException(status_code=400, detail="已存在主要驾驶人，请先调整现有挂靠角色")
    driver = VehicleDriver(
        vehicle_id=vehicle_id,
        person_id=payload.person_id,
        role=payload.role,
        start_date=payload.start_date or local_today(),
        status="active",
        note=payload.note,
    )
    db.add(driver)
    db.flush()
    _audit(
        db,
        entity_type="vehicle_driver",
        entity_id=driver.id,
        action="create",
        before_data=None,
        after_data=_model_data(driver),
        operator=operator,
    )
    db.commit()
    db.refresh(driver)
    license_row = _get_active(db, PersonLicense, payload.person_id)
    stay = _get_active(db, Stay, payload.person_id)
    return {
        "driver": _serialize_vehicle_driver(driver, person, license_row),
        "warnings": _driver_warnings(person, license_row, stay),
    }


def update_vehicle_driver(driver_id: int, payload: VehicleDriverUpdate, db: Session, operator: str = "admin"):
    driver = _get_active(db, VehicleDriver, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="挂靠记录不存在")
    values = payload.model_dump(exclude_unset=True)
    if values.get("role") == "primary" and driver.status == "active":
        conflict = db.scalar(
            select(func.count(VehicleDriver.id)).where(
                VehicleDriver.vehicle_id == driver.vehicle_id,
                VehicleDriver.status == "active",
                VehicleDriver.role == "primary",
                VehicleDriver.id != driver.id,
                VehicleDriver.is_deleted.is_(False),
            )
        ) or 0
        if conflict:
            raise HTTPException(status_code=400, detail="已存在主要驾驶人，请先调整现有挂靠角色")
    before = _model_data(driver)
    for key, value in values.items():
        setattr(driver, key, value)
    db.flush()
    _audit(
        db,
        entity_type="vehicle_driver",
        entity_id=driver.id,
        action="update",
        before_data=before,
        after_data=_model_data(driver),
        operator=operator,
    )
    db.commit()
    db.refresh(driver)
    return driver


def remove_vehicle_driver(driver_id: int, db: Session, operator: str = "admin"):
    """解除挂靠：置 removed 并写 end_date，保留历史，不物理删除。"""
    driver = _get_active(db, VehicleDriver, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="挂靠记录不存在")
    if driver.status != "active":
        raise HTTPException(status_code=400, detail="该挂靠已解除")
    before = _model_data(driver)
    driver.status = "removed"
    driver.end_date = local_today()
    db.flush()
    _audit(
        db,
        entity_type="vehicle_driver",
        entity_id=driver.id,
        action="remove",
        before_data=before,
        after_data=_model_data(driver),
        operator=operator,
    )
    db.commit()
    return {"removed": True}


# ---- 人员驾照 ----

def get_person_license(person_id: int, db: Session):
    person = _get_active(db, Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    license_row = _get_active(db, PersonLicense, person_id)
    return _serialize_license(license_row) or {"person_id": person_id}


def list_person_licenses(db: Session):
    return [_model_data(row) for row in db.scalars(_active_stmt(PersonLicense)).all()]


def upsert_person_license(payload: PersonLicenseUpsert, db: Session, operator: str = "admin"):
    person = _get_active(db, Person, payload.person_id)
    if not person:
        raise HTTPException(status_code=400, detail="人员不存在")
    license_row = db.get(PersonLicense, payload.person_id)
    if license_row:
        before = _model_data(license_row)
        for key, value in payload.model_dump().items():
            setattr(license_row, key, value)
        license_row.is_deleted = False
        action = "update"
    else:
        license_row = PersonLicense(**payload.model_dump())
        db.add(license_row)
        before = None
        action = "create"
    db.flush()
    _audit(
        db,
        entity_type="person_license",
        entity_id=license_row.person_id,
        action=action,
        before_data=before,
        after_data=_model_data(license_row),
        operator=operator,
    )
    db.commit()
    db.refresh(license_row)
    return _model_data(license_row)


# ---- 保单与续保 ----

def list_vehicle_policies(vehicle_id: int, db: Session):
    if not _get_active(db, Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="车辆不存在")
    return db.scalars(
        _active_stmt(InsurancePolicy)
        .where(InsurancePolicy.vehicle_id == vehicle_id)
        .order_by(InsurancePolicy.end_date.desc(), InsurancePolicy.id.desc())
    ).all()


def create_vehicle_policy(vehicle_id: int, payload: InsurancePolicyCreate, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="到期日不能早于起保日")
    warnings: list[str] = []
    # 同车同时间仅 1 张 active：登记新保单自动过期旧保单（即续保动作本身）。
    current_active = db.scalars(
        _active_stmt(InsurancePolicy).where(
            InsurancePolicy.vehicle_id == vehicle_id, InsurancePolicy.status == "active"
        )
    ).all()
    for old in current_active:
        if payload.start_date < old.end_date:
            warnings.append(
                f"新保单起保日 {payload.start_date.isoformat()} 早于原保单到期日 {old.end_date.isoformat()}，日期重叠（续保常见，放行）"
            )
        old.status = "expired"
    # 承保驾驶人快照：登记那一刻的 active 挂靠人姓名，只作历史追溯。
    driver_names = [
        person.chinese_name
        for _, person, _ in _vehicle_driver_rows(db, [vehicle_id])
        if person
    ]
    policy = InsurancePolicy(
        vehicle_id=vehicle_id,
        driver_snapshot="、".join(driver_names) or None,
        status="active",
        **payload.model_dump(),
    )
    db.add(policy)
    db.flush()
    refresh_vehicle_caches(db, vehicle_id)
    _audit(
        db,
        entity_type="insurance_policy",
        entity_id=policy.id,
        action="create",
        before_data=None,
        after_data=_model_data(policy),
        operator=operator,
    )
    db.commit()
    db.refresh(policy)
    return {"policy": _model_data(policy), "warnings": warnings}


def update_vehicle_policy(policy_id: int, payload: InsurancePolicyUpdate, db: Session, operator: str = "admin"):
    policy = _get_active(db, InsurancePolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="保单不存在")
    values = payload.model_dump(exclude_unset=True)
    if values.get("status") == "active":
        # 把历史保单改回 active 前，先确认没有别的 active 保单。
        conflict = db.scalar(
            select(func.count(InsurancePolicy.id)).where(
                InsurancePolicy.vehicle_id == policy.vehicle_id,
                InsurancePolicy.status == "active",
                InsurancePolicy.id != policy.id,
                InsurancePolicy.is_deleted.is_(False),
            )
        ) or 0
        if conflict:
            raise HTTPException(status_code=400, detail="该车已有生效中的保单，同一时间只允许一张 active 保单")
    before = _model_data(policy)
    for key, value in values.items():
        setattr(policy, key, value)
    next_start = policy.start_date
    next_end = policy.end_date
    if next_end and next_start and next_end < next_start:
        raise HTTPException(status_code=400, detail="到期日不能早于起保日")
    db.flush()
    refresh_vehicle_caches(db, policy.vehicle_id)
    _audit(
        db,
        entity_type="insurance_policy",
        entity_id=policy.id,
        action="update",
        before_data=before,
        after_data=_model_data(policy),
        operator=operator,
    )
    db.commit()
    db.refresh(policy)
    return policy


def delete_vehicle_policy(policy_id: int, db: Session, operator: str = "admin"):
    policy = _get_active(db, InsurancePolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="保单不存在")
    before = _model_data(policy)
    policy.is_deleted = True
    db.flush()
    refresh_vehicle_caches(db, policy.vehicle_id)
    _audit(
        db,
        entity_type="insurance_policy",
        entity_id=policy.id,
        action="delete",
        before_data=before,
        after_data=_model_data(policy),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


# ---- 保养台账 ----

def list_vehicle_maintenances(vehicle_id: int, db: Session):
    if not _get_active(db, Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="车辆不存在")
    return db.scalars(
        _active_stmt(VehicleMaintenance)
        .where(VehicleMaintenance.vehicle_id == vehicle_id)
        .order_by(VehicleMaintenance.maintenance_date.desc(), VehicleMaintenance.id.desc())
    ).all()


def create_vehicle_maintenance(vehicle_id: int, payload: VehicleMaintenanceCreate, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    data = payload.model_dump()
    interval_miles, interval_months = _vehicle_intervals(vehicle, db)
    if data.get("next_due_date") is None:
        data["next_due_date"] = _add_months(data["maintenance_date"], interval_months)
    if data.get("next_due_mileage") is None and data.get("odometer") is not None:
        data["next_due_mileage"] = data["odometer"] + interval_miles
    maintenance = VehicleMaintenance(vehicle_id=vehicle_id, **data)
    db.add(maintenance)
    # 回写车辆里程：只在新里程更大时更新（换表/录错走里程接口的 force 流程）。
    if data.get("odometer") is not None and (vehicle.odometer is None or data["odometer"] > vehicle.odometer):
        vehicle.odometer = data["odometer"]
        vehicle.odometer_updated_on = data["maintenance_date"]
    db.flush()
    refresh_vehicle_caches(db, vehicle_id)
    _audit(
        db,
        entity_type="vehicle_maintenance",
        entity_id=maintenance.id,
        action="create",
        before_data=None,
        after_data=_model_data(maintenance),
        operator=operator,
    )
    db.commit()
    db.refresh(maintenance)
    return maintenance


def update_vehicle_maintenance(maintenance_id: int, payload: VehicleMaintenanceUpdate, db: Session, operator: str = "admin"):
    maintenance = _get_active(db, VehicleMaintenance, maintenance_id)
    if not maintenance:
        raise HTTPException(status_code=404, detail="保养记录不存在")
    values = payload.model_dump(exclude_unset=True)
    before = _model_data(maintenance)
    for key, value in values.items():
        setattr(maintenance, key, value)
    db.flush()
    refresh_vehicle_caches(db, maintenance.vehicle_id)
    _audit(
        db,
        entity_type="vehicle_maintenance",
        entity_id=maintenance.id,
        action="update",
        before_data=before,
        after_data=_model_data(maintenance),
        operator=operator,
    )
    db.commit()
    db.refresh(maintenance)
    return maintenance


def delete_vehicle_maintenance(maintenance_id: int, db: Session, operator: str = "admin"):
    maintenance = _get_active(db, VehicleMaintenance, maintenance_id)
    if not maintenance:
        raise HTTPException(status_code=404, detail="保养记录不存在")
    before = _model_data(maintenance)
    maintenance.is_deleted = True
    db.flush()
    refresh_vehicle_caches(db, maintenance.vehicle_id)
    _audit(
        db,
        entity_type="vehicle_maintenance",
        entity_id=maintenance.id,
        action="delete",
        before_data=before,
        after_data=_model_data(maintenance),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


# ---- 修理台账 ----

def list_vehicle_repairs(vehicle_id: int, db: Session):
    if not _get_active(db, Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="车辆不存在")
    return db.scalars(
        _active_stmt(VehicleRepair)
        .where(VehicleRepair.vehicle_id == vehicle_id)
        .order_by(VehicleRepair.reported_date.desc(), VehicleRepair.id.desc())
    ).all()


def _validate_repair_accident(db: Session, vehicle_id: int, accident_id: Optional[int]) -> None:
    if accident_id is None:
        return
    accident = _get_active(db, VehicleAccident, accident_id)
    if not accident or accident.vehicle_id != vehicle_id:
        raise HTTPException(status_code=400, detail="关联事故不存在或不属于该车辆")


def create_vehicle_repair(vehicle_id: int, payload: VehicleRepairCreate, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    _validate_repair_accident(db, vehicle_id, payload.accident_id)
    repair = VehicleRepair(vehicle_id=vehicle_id, **payload.model_dump())
    db.add(repair)
    db.flush()
    _sync_vehicle_repair_status(db, vehicle)
    _audit(
        db,
        entity_type="vehicle_repair",
        entity_id=repair.id,
        action="create",
        before_data=None,
        after_data=_model_data(repair),
        operator=operator,
    )
    db.commit()
    db.refresh(repair)
    return repair


def update_vehicle_repair(repair_id: int, payload: VehicleRepairUpdate, db: Session, operator: str = "admin"):
    repair = _get_active(db, VehicleRepair, repair_id)
    if not repair:
        raise HTTPException(status_code=404, detail="修理记录不存在")
    values = payload.model_dump(exclude_unset=True)
    if "accident_id" in values:
        _validate_repair_accident(db, repair.vehicle_id, values["accident_id"])
    before = _model_data(repair)
    for key, value in values.items():
        setattr(repair, key, value)
    db.flush()
    vehicle = _get_active(db, Vehicle, repair.vehicle_id)
    if vehicle:
        _sync_vehicle_repair_status(db, vehicle)
    _audit(
        db,
        entity_type="vehicle_repair",
        entity_id=repair.id,
        action="update",
        before_data=before,
        after_data=_model_data(repair),
        operator=operator,
    )
    db.commit()
    db.refresh(repair)
    return repair


def delete_vehicle_repair(repair_id: int, db: Session, operator: str = "admin"):
    repair = _get_active(db, VehicleRepair, repair_id)
    if not repair:
        raise HTTPException(status_code=404, detail="修理记录不存在")
    before = _model_data(repair)
    repair.is_deleted = True
    db.flush()
    vehicle = _get_active(db, Vehicle, repair.vehicle_id)
    if vehicle:
        _sync_vehicle_repair_status(db, vehicle)
    _audit(
        db,
        entity_type="vehicle_repair",
        entity_id=repair.id,
        action="delete",
        before_data=before,
        after_data=_model_data(repair),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


# ---- 事故与理赔 ----

def list_vehicle_accidents(vehicle_id: int, db: Session):
    if not _get_active(db, Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="车辆不存在")
    return db.scalars(
        _active_stmt(VehicleAccident)
        .where(VehicleAccident.vehicle_id == vehicle_id)
        .order_by(VehicleAccident.accident_datetime.desc(), VehicleAccident.id.desc())
    ).all()


def _default_accident_policy(db: Session, vehicle_id: int, accident_date: date) -> Optional[int]:
    policy = db.scalar(
        _active_stmt(InsurancePolicy)
        .where(
            InsurancePolicy.vehicle_id == vehicle_id,
            InsurancePolicy.start_date <= accident_date,
            InsurancePolicy.end_date >= accident_date,
        )
        .order_by(InsurancePolicy.id.desc())
    )
    return policy.id if policy else None


def _accident_warnings(data: dict) -> list[str]:
    warnings = []
    settled = data.get("settled_amount")
    estimated = data.get("estimated_loss")
    if settled is not None and estimated is not None and settled > estimated:
        warnings.append(f"实际赔付 {settled:g} 大于定损金额 {estimated:g}，请复核")
    return warnings


def create_vehicle_accident(vehicle_id: int, payload: VehicleAccidentCreate, db: Session, operator: str = "admin"):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    data = payload.model_dump()
    if data.get("driver_person_id") and not _get_active(db, Person, data["driver_person_id"]):
        raise HTTPException(status_code=400, detail="当事驾驶人不存在")
    if data.get("policy_id") is None:
        # 默认取事故日期覆盖的保单。
        data["policy_id"] = _default_accident_policy(db, vehicle_id, data["accident_datetime"].date())
    elif not _get_active(db, InsurancePolicy, data["policy_id"]):
        raise HTTPException(status_code=400, detail="出险保单不存在")
    warnings = _accident_warnings(data)
    accident = VehicleAccident(vehicle_id=vehicle_id, **data)
    db.add(accident)
    db.flush()
    _audit(
        db,
        entity_type="vehicle_accident",
        entity_id=accident.id,
        action="create",
        before_data=None,
        after_data=_model_data(accident),
        operator=operator,
    )
    db.commit()
    db.refresh(accident)
    return {"accident": _model_data(accident), "warnings": warnings}


def update_vehicle_accident(accident_id: int, payload: VehicleAccidentUpdate, db: Session, operator: str = "admin"):
    accident = _get_active(db, VehicleAccident, accident_id)
    if not accident:
        raise HTTPException(status_code=404, detail="事故记录不存在")
    values = payload.model_dump(exclude_unset=True)
    if values.get("driver_person_id") and not _get_active(db, Person, values["driver_person_id"]):
        raise HTTPException(status_code=400, detail="当事驾驶人不存在")
    if values.get("policy_id") and not _get_active(db, InsurancePolicy, values["policy_id"]):
        raise HTTPException(status_code=400, detail="出险保单不存在")
    before = _model_data(accident)
    for key, value in values.items():
        setattr(accident, key, value)
    if accident.claim_status == "closed" and accident.claim_closed_date is None:
        accident.claim_closed_date = local_today()
    db.flush()
    warnings = _accident_warnings(_model_data(accident))
    _audit(
        db,
        entity_type="vehicle_accident",
        entity_id=accident.id,
        action="update",
        before_data=before,
        after_data=_model_data(accident),
        operator=operator,
    )
    db.commit()
    db.refresh(accident)
    return {"accident": _model_data(accident), "warnings": warnings}


def delete_vehicle_accident(accident_id: int, db: Session, operator: str = "admin"):
    accident = _get_active(db, VehicleAccident, accident_id)
    if not accident:
        raise HTTPException(status_code=404, detail="事故记录不存在")
    before = _model_data(accident)
    accident.is_deleted = True
    # 解除修理单上的事故关联，避免指向已删除记录。
    for repair in db.scalars(
        _active_stmt(VehicleRepair).where(VehicleRepair.accident_id == accident_id)
    ).all():
        repair.accident_id = None
    db.flush()
    _audit(
        db,
        entity_type="vehicle_accident",
        entity_id=accident.id,
        action="delete",
        before_data=before,
        after_data=_model_data(accident),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


# ---- 车辆提醒（页面聚合 + 钉钉推送共用口径） ----

def _vehicle_alert_items(db: Session):
    """所有车辆类到期/缺失项的统一口径，供 /vehicles/alerts 页面与钉钉提醒共用。"""
    today = local_today()
    vehicles = db.scalars(
        _active_stmt(Vehicle).where(Vehicle.status != "disposed").order_by(Vehicle.id.asc())
    ).all()
    dorm_names = {dorm.id: dorm.name for dorm in db.scalars(_active_stmt(Dorm)).all()}
    drivers_by_vehicle: dict[int, list] = {}
    for driver, person, license_row in _vehicle_driver_rows(db):
        drivers_by_vehicle.setdefault(driver.vehicle_id, []).append((driver, person, license_row))

    date_items = []
    missing_items = []

    def base(vehicle, kind, due, extra=None, entity_type="vehicle", entity_id=None, remind_kind=None):
        return {
            "vehicle_id": vehicle.id,
            "plate_number": vehicle.plate_number,
            "vehicle_label": " ".join(filter(None, [vehicle.make, vehicle.model])) or None,
            "dorm_id": vehicle.base_dorm_id,
            "dorm_name": dorm_names.get(vehicle.base_dorm_id) if vehicle.base_dorm_id else None,
            "kind": kind,
            "kind_label": VEHICLE_REMIND_KIND_LABELS.get(kind, kind),
            "due_date": due,
            "days_left": (due - today).days if due else None,
            "extra": extra,
            "_entity_type": entity_type,
            "_entity_id": entity_id if entity_id is not None else vehicle.id,
            "_remind_kind": remind_kind or kind,
        }

    for vehicle in vehicles:
        drivers = drivers_by_vehicle.get(vehicle.id, [])
        if vehicle.insurance_expire_date:
            date_items.append(base(vehicle, "insurance_expire", vehicle.insurance_expire_date))
        else:
            missing_items.append(base(vehicle, "insurance_expire", None, extra="未上保险"))
        if not drivers:
            missing_items.append(base(vehicle, "license_expire", None, extra="未挂靠被保险人"))
        if not vehicle.base_dorm_id:
            missing_items.append(base(vehicle, "lease_expire", None, extra="未分配宿舍"))
        if vehicle.inspection_expire_date:
            date_items.append(base(vehicle, "inspection_expire", vehicle.inspection_expire_date))
        if vehicle.registration_expire_date:
            date_items.append(base(vehicle, "registration_expire", vehicle.registration_expire_date))
        if vehicle.ownership_type == "leased" and vehicle.lease_end_date:
            extra = f"{vehicle.lease_company or ''}"
            if vehicle.lease_monthly_fee is not None:
                extra = f"{extra} ${vehicle.lease_monthly_fee:g}/月".strip()
            date_items.append(base(vehicle, "lease_expire", vehicle.lease_end_date, extra=extra.strip() or None))
        if vehicle.maintenance_due_date:
            extra = None
            if vehicle.odometer is not None and vehicle.maintenance_due_mileage is not None:
                extra = f"{vehicle.odometer:,} / {vehicle.maintenance_due_mileage:,} mi"
            date_items.append(base(vehicle, "maintenance_due", vehicle.maintenance_due_date, extra=extra))
            # 里程口径：达到间隔 90% 时进提醒（一次性，锚定本保养周期）。
            interval_miles, _ = _vehicle_intervals(vehicle, db)
            if (
                vehicle.odometer is not None
                and vehicle.maintenance_due_mileage is not None
                and vehicle.odometer >= vehicle.maintenance_due_mileage - interval_miles * 0.1
            ):
                date_items.append(
                    base(
                        vehicle,
                        "maintenance_mileage",
                        vehicle.maintenance_due_date,
                        extra=f"当前 {vehicle.odometer:,} mi，目标 {vehicle.maintenance_due_mileage:,} mi",
                        remind_kind="maintenance_mileage",
                    )
                )
        for driver, person, license_row in drivers:
            if license_row and license_row.expire_date:
                item = base(
                    vehicle,
                    "license_expire",
                    license_row.expire_date,
                    extra=f"{person.chinese_name if person else '?'} · {'主要' if driver.role == 'primary' else '第二'}驾驶人",
                    entity_type="person_license",
                    entity_id=driver.person_id,
                )
                date_items.append(item)

    # 理赔滞留：已报案未结案超过 30 天，每 30 天提醒一次。
    stalled_items = []
    accidents = db.scalars(
        _active_stmt(VehicleAccident).where(
            VehicleAccident.claim_status.in_(CLAIM_OPEN_STATUSES),
            VehicleAccident.claim_filed_date.is_not(None),
        )
    ).all()
    vehicle_map = {vehicle.id: vehicle for vehicle in vehicles}
    for accident in accidents:
        vehicle = vehicle_map.get(accident.vehicle_id)
        if not vehicle:
            continue
        days_open = (today - accident.claim_filed_date).days
        if days_open >= 30:
            item = base(
                vehicle,
                "claim_stalled",
                accident.claim_filed_date,
                extra=f"案号 {accident.claim_no or '-'} 已报案 {days_open} 天未结案",
                entity_type="vehicle_accident",
                entity_id=accident.id,
            )
            item["days_open"] = days_open
            stalled_items.append(item)

    return date_items, missing_items, stalled_items


def vehicle_alerts(db: Session):
    date_items, missing_items, stalled_items = _vehicle_alert_items(db)

    def clean(item):
        return {key: value for key, value in item.items() if not key.startswith("_")}

    overdue = [clean(i) for i in date_items if i["days_left"] is not None and i["days_left"] < 0 and i["kind"] != "claim_stalled"]
    within7 = [clean(i) for i in date_items if i["days_left"] is not None and 0 <= i["days_left"] <= 7]
    horizon = lambda i: 60 if i["kind"] == "lease_expire" else 30  # noqa: E731
    within30 = [
        clean(i)
        for i in date_items
        if i["days_left"] is not None and 7 < i["days_left"] <= horizon(i)
    ]
    for group in (overdue, within7, within30):
        group.sort(key=lambda item: (item["days_left"], item["plate_number"]))
    return {
        "missing": [clean(i) for i in missing_items],
        "overdue": overdue,
        "within7": within7,
        "within30": within30,
        "claimStalled": [clean(i) for i in stalled_items],
    }


def vehicle_summary(db: Session):
    dorm_names = {dorm.id: dorm.name for dorm in db.scalars(_active_stmt(Dorm)).all()}
    vehicles = db.scalars(_active_stmt(Vehicle)).all()
    by_dorm: dict = {}
    for vehicle in vehicles:
        key = vehicle.base_dorm_id
        entry = by_dorm.setdefault(key, {"dorm_id": key, "dorm_name": dorm_names.get(key, "未分配"), "vehicles": 0})
        entry["vehicles"] += 1
    year = local_today().year
    year_start = date(year, 1, 1)
    maintenance_total = db.scalar(
        select(func.coalesce(func.sum(VehicleMaintenance.cost), 0)).where(
            VehicleMaintenance.is_deleted.is_(False),
            VehicleMaintenance.maintenance_date >= year_start,
        )
    ) or 0
    repair_total = db.scalar(
        select(func.coalesce(func.sum(VehicleRepair.cost), 0)).where(
            VehicleRepair.is_deleted.is_(False),
            VehicleRepair.reported_date >= year_start,
        )
    ) or 0
    return {
        "byDorm": sorted(by_dorm.values(), key=lambda item: (item["dorm_id"] is None, item["dorm_id"] or 0)),
        "year": year,
        "maintenanceCostYtd": maintenance_total,
        "repairCostYtd": repair_total,
    }


def _vehicle_recipient_dingtalk_ids(db: Session) -> list[str]:
    return [
        user.dingtalk_userid
        for user in db.scalars(
            _active_stmt(User).where(
                User.receive_vehicle_reminders.is_(True),
                User.dingtalk_userid.is_not(None),
            )
        ).all()
        if user.dingtalk_userid
    ]


def _reminder_logged(db: Session, item: dict, stage: int, due_target: date) -> bool:
    return bool(
        db.scalar(
            select(func.count(VehicleReminderLog.id)).where(
                VehicleReminderLog.entity_type == item["_entity_type"],
                VehicleReminderLog.entity_id == item["_entity_id"],
                VehicleReminderLog.remind_kind == item["_remind_kind"],
                VehicleReminderLog.remind_stage == stage,
                VehicleReminderLog.due_target_date == due_target,
            )
        )
    )


def run_vehicle_reminders(db: Session, respect_send_hour: bool = True) -> dict:
    """车辆类钉钉到期提醒。幂等键 (entity, kind, stage, due_target_date)：
    到期日一变自动重新武装；每次只发最贴近的档位。"""
    from backend.services import dingtalk

    if respect_send_hour and local_now().hour < VEHICLE_REMINDER_SEND_HOUR:
        return {"sent": 0, "reason": f"未到发送时间（每天 {VEHICLE_REMINDER_SEND_HOUR} 点后发送）"}

    today = local_today()
    date_items, _missing, stalled_items = _vehicle_alert_items(db)

    pending: list[tuple[dict, int, date, str]] = []
    for item in date_items:
        due = item["due_date"]
        days_left = item["days_left"]
        if due is None or days_left is None:
            continue
        kind = item["_remind_kind"]
        if kind == "maintenance_mileage":
            # 里程触发：一次性，锚定本周期的下次保养日期，档位固定 90。
            if not _reminder_logged(db, item, 90, due):
                line = f"· {item['plate_number']}（{item['dorm_name'] or '未分配'}）保养里程临近：{item['extra']}"
                pending.append((item, 90, due, line))
            continue
        stages = VEHICLE_REMINDER_STAGES.get(kind)
        if not stages:
            continue
        applicable = [stage for stage in stages if days_left <= stage]
        if not applicable:
            continue
        stage = min(applicable)
        if _reminder_logged(db, item, stage, due):
            continue
        when = f"已过期 {-days_left} 天" if days_left < 0 else ("今天到期" if days_left == 0 else f"{days_left} 天后到期")
        line = f"· {item['plate_number']}（{item['dorm_name'] or '未分配'}）{item['kind_label']}：{due.isoformat()}（{when}）"
        if item.get("extra"):
            line += f"，{item['extra']}"
        pending.append((item, stage, due, line))

    for item in stalled_items:
        # 每 30 天一期：第 k 期的 due_target = 报案日 + 30k 天。
        k = item["days_open"] // 30
        due_target = item["due_date"] + timedelta(days=30 * k)
        if _reminder_logged(db, item, k, due_target):
            continue
        line = f"· {item['plate_number']}（{item['dorm_name'] or '未分配'}）{item['kind_label']}：{item['extra']}"
        pending.append((item, k, due_target, line))

    if not pending:
        return {"sent": 0, "reason": "没有需要提醒的车辆事项"}
    if not dingtalk.can_send_messages():
        return {"sent": 0, "reason": "钉钉消息未配置（缺少 DINGTALK_AGENT_ID 等环境变量）"}
    userids = _vehicle_recipient_dingtalk_ids(db)
    if not userids:
        return {"sent": 0, "reason": "没有绑定钉钉的车辆提醒接收人"}

    lines = ["【车辆到期提醒】以下事项需要处理："]
    lines.extend(line for _, _, _, line in pending)
    lines.append("请及时处理。")
    dingtalk.send_work_message(userids, "\n".join(lines))
    for item, stage, due_target, _line in pending:
        db.add(
            VehicleReminderLog(
                entity_type=item["_entity_type"],
                entity_id=item["_entity_id"],
                remind_kind=item["_remind_kind"],
                remind_stage=stage,
                due_target_date=due_target,
                reminded_on=today,
            )
        )
    db.commit()
    return {"sent": len(pending), "recipients": len(userids)}


def send_vehicle_test_message(db: Session) -> dict:
    from backend.services import dingtalk

    userids = _vehicle_recipient_dingtalk_ids(db)
    if not userids:
        raise HTTPException(
            status_code=400,
            detail="没有绑定钉钉的车辆提醒接收人：请在用户管理中为用户开启「接收车辆提醒」，且用户需要用钉钉登录过本系统一次以完成绑定",
        )
    return dingtalk.send_work_message(
        userids, f"【车辆到期提醒】这是一条测试消息（{local_today().isoformat()}），钉钉提醒配置成功。"
    )


# ---------------- 水电网气房费 (utility bills) ----------------

# Reminder goes out this many days before the due date...
UTILITY_REMINDER_DAYS_AHEAD = 3
# ...at (or as soon as possible after) this local hour of the day.
UTILITY_REMINDER_SEND_HOUR = 9

UTILITY_BILL_STATUSES = {"pending", "paid"}


def list_utility_bills(db: Session):
    return db.scalars(
        _active_stmt(UtilityBill).order_by(UtilityBill.due_date.desc(), UtilityBill.id.desc())
    ).all()


def create_utility_bill(payload: UtilityBillCreate, db: Session, operator: str = "admin"):
    if not _get_active(db, Dorm, payload.dorm_id):
        raise HTTPException(status_code=400, detail="宿舍不存在")
    if payload.status not in UTILITY_BILL_STATUSES:
        raise HTTPException(status_code=400, detail="状态仅支持 pending/paid")
    bill = UtilityBill(**payload.model_dump())
    db.add(bill)
    db.flush()
    _audit(
        db,
        entity_type="utility_bill",
        entity_id=bill.id,
        action="create",
        before_data=None,
        after_data=_model_data(bill),
        operator=operator,
    )
    db.commit()
    db.refresh(bill)
    return bill


def update_utility_bill(bill_id: int, payload: UtilityBillUpdate, db: Session, operator: str = "admin"):
    bill = _get_active(db, UtilityBill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="缴费记录不存在")
    values = payload.model_dump(exclude_unset=True)
    if "dorm_id" in values and not _get_active(db, Dorm, values["dorm_id"]):
        raise HTTPException(status_code=400, detail="宿舍不存在")
    if "status" in values and values["status"] not in UTILITY_BILL_STATUSES:
        raise HTTPException(status_code=400, detail="状态仅支持 pending/paid")
    before = _model_data(bill)
    for key, value in values.items():
        setattr(bill, key, value)
    # A moved due date re-arms the reminder.
    if "due_date" in values and values["due_date"] != before.get("due_date"):
        bill.reminded_on = None
    db.flush()
    _audit(
        db,
        entity_type="utility_bill",
        entity_id=bill.id,
        action="update",
        before_data=before,
        after_data=_model_data(bill),
        operator=operator,
    )
    db.commit()
    db.refresh(bill)
    return bill


def delete_utility_bill(bill_id: int, db: Session, operator: str = "admin"):
    bill = _get_active(db, UtilityBill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="缴费记录不存在")
    before = _model_data(bill)
    bill.is_deleted = True
    db.flush()
    _audit(
        db,
        entity_type="utility_bill",
        entity_id=bill.id,
        action="delete",
        before_data=before,
        after_data=_model_data(bill),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


def list_utility_accounts(db: Session):
    return db.scalars(
        _active_stmt(UtilityAccount).order_by(UtilityAccount.dorm_id, UtilityAccount.fee_type, UtilityAccount.id)
    ).all()


def create_utility_account(payload: UtilityAccountCreate, db: Session, operator: str = "admin"):
    if not _get_active(db, Dorm, payload.dorm_id):
        raise HTTPException(status_code=400, detail="宿舍不存在")
    account = UtilityAccount(**payload.model_dump())
    db.add(account)
    db.flush()
    _audit(
        db,
        entity_type="utility_account",
        entity_id=account.id,
        action="create",
        before_data=None,
        after_data=_model_data(account),
        operator=operator,
    )
    db.commit()
    db.refresh(account)
    return account


def update_utility_account(account_id: int, payload: UtilityAccountUpdate, db: Session, operator: str = "admin"):
    account = _get_active(db, UtilityAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="缴费账户不存在")
    values = payload.model_dump(exclude_unset=True)
    if "dorm_id" in values and not _get_active(db, Dorm, values["dorm_id"]):
        raise HTTPException(status_code=400, detail="宿舍不存在")
    if "account_number" in values and not (values["account_number"] or "").strip():
        raise HTTPException(status_code=400, detail="账号不能为空")
    before = _model_data(account)
    for key, value in values.items():
        setattr(account, key, value)
    db.flush()
    _audit(
        db,
        entity_type="utility_account",
        entity_id=account.id,
        action="update",
        before_data=before,
        after_data=_model_data(account),
        operator=operator,
    )
    db.commit()
    db.refresh(account)
    return account


def delete_utility_account(account_id: int, db: Session, operator: str = "admin"):
    account = _get_active(db, UtilityAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="缴费账户不存在")
    before = _model_data(account)
    account.is_deleted = True
    db.flush()
    _audit(
        db,
        entity_type="utility_account",
        entity_id=account.id,
        action="delete",
        before_data=before,
        after_data=_model_data(account),
        operator=operator,
    )
    db.commit()
    return {"deleted": True}


def list_utility_bill_recipients(db: Session):
    """Users who opted into DingTalk bill reminders (flag lives on the user, managed on the Users page)."""
    return [
        {
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "has_dingtalk": bool(user.dingtalk_userid),
        }
        for user in db.scalars(
            _active_stmt(User).where(User.receive_bill_reminders.is_(True)).order_by(User.id)
        ).all()
    ]


def _utility_recipient_dingtalk_ids(db: Session) -> list[str]:
    return [
        user.dingtalk_userid
        for user in db.scalars(
            _active_stmt(User).where(
                User.receive_bill_reminders.is_(True),
                User.dingtalk_userid.is_not(None),
            )
        ).all()
        if user.dingtalk_userid
    ]


def clear_expired_temp_leaves(db: Session) -> int:
    """出差/临时空出 auto-expiry: drop the marker once the end date has passed.

    Runs from the background scheduler so the note disappears everywhere
    (summary report, allocation list) without manual cleanup.
    """
    today = local_today()
    allocations = db.scalars(
        _active_stmt(Allocation).where(
            Allocation.temp_leave_end.is_not(None),
            Allocation.temp_leave_end < today,
        )
    ).all()
    for allocation in allocations:
        before = _model_data(allocation)
        allocation.temp_leave_start = None
        allocation.temp_leave_end = None
        db.flush()
        _audit(
            db,
            entity_type="allocation",
            entity_id=allocation.id,
            action="temp_leave_expired",
            before_data=before,
            after_data=_model_data(allocation),
            operator="system",
        )
    if allocations:
        db.commit()
    return len(allocations)


def run_utility_bill_reminders(db: Session, respect_send_hour: bool = True) -> dict:
    """Send one DingTalk reminder per remind-enabled bill due within the next 3 days.

    Sent at (or as soon as possible after) 9:00 local time. Idempotent: each
    bill is reminded once (reminded_on guard); editing the due date re-arms it.
    Called by the background scheduler; the manual endpoint skips the hour gate.
    """
    from backend.services import dingtalk

    if respect_send_hour and local_now().hour < UTILITY_REMINDER_SEND_HOUR:
        return {"sent": 0, "reason": f"未到发送时间（每天 {UTILITY_REMINDER_SEND_HOUR} 点后发送）"}

    today = local_today()
    window_end = today + timedelta(days=UTILITY_REMINDER_DAYS_AHEAD)
    bills = db.scalars(
        _active_stmt(UtilityBill)
        .where(
            UtilityBill.status == "pending",
            UtilityBill.remind_enabled.is_(True),
            UtilityBill.reminded_on.is_(None),
            UtilityBill.due_date >= today,
            UtilityBill.due_date <= window_end,
        )
        .order_by(UtilityBill.due_date)
    ).all()
    if not bills:
        return {"sent": 0, "reason": "没有需要提醒的缴费项"}
    if not dingtalk.can_send_messages():
        return {"sent": 0, "reason": "钉钉消息未配置（缺少 DINGTALK_AGENT_ID 等环境变量）"}
    userids = _utility_recipient_dingtalk_ids(db)
    if not userids:
        return {"sent": 0, "reason": "没有绑定钉钉的提醒接收人"}

    dorm_names = {dorm.id: dorm.name for dorm in db.scalars(_active_stmt(Dorm)).all()}
    lines = ["【宿舍缴费提醒】以下费用即将到期："]
    for bill in bills:
        days = (bill.due_date - today).days
        when = "今天到期" if days == 0 else f"{days} 天后到期"
        line = f"· {dorm_names.get(bill.dorm_id, '未知宿舍')} {bill.fee_type}：{bill.due_date.isoformat()}（{when}）"
        if bill.account:
            line += f"，账号 {bill.account}"
        if bill.amount is not None:
            line += f"，金额 {bill.amount:g}"
        if bill.note:
            line += f"，备注：{bill.note}"
        lines.append(line)
    lines.append("请及时缴纳。")
    dingtalk.send_work_message(userids, "\n".join(lines))
    for bill in bills:
        bill.reminded_on = today
    db.commit()
    return {"sent": len(bills), "recipients": len(userids)}


def send_utility_bill_test_message(db: Session) -> dict:
    from backend.services import dingtalk

    userids = _utility_recipient_dingtalk_ids(db)
    if not userids:
        raise HTTPException(
            status_code=400,
            detail="没有绑定钉钉的提醒接收人：请在用户管理中为用户开启「接收缴费提醒」，且用户需要用钉钉登录过本系统一次以完成绑定",
        )
    return dingtalk.send_work_message(
        userids, f"【宿舍缴费提醒】这是一条测试消息（{local_today().isoformat()}），钉钉提醒配置成功。"
    )


def seed_default_dictionaries(db: Session):
    for key, config in DEFAULT_DICTIONARIES.items():
        dictionary = db.scalar(select(Dictionary).where(Dictionary.key == key))
        if not dictionary:
            dictionary = Dictionary(key=key, label=config["label"])
            db.add(dictionary)
            db.flush()
        else:
            dictionary.label = config["label"]
            dictionary.is_deleted = False
        existing_items = {
            item.value: item
            for item in db.scalars(
                select(DictionaryItem).where(DictionaryItem.dictionary_id == dictionary.id)
            ).all()
        }
        for sort_order, (label, value) in enumerate(config["items"]):
            if value in existing_items:
                existing_items[value].label = label
                existing_items[value].sort_order = sort_order
                existing_items[value].is_deleted = False
            else:
                db.add(
                    DictionaryItem(
                        dictionary_id=dictionary.id,
                        label=label,
                        value=value,
                        sort_order=sort_order,
                    )
                )
    # Retire legacy dictionaries replaced by the combined assetItems dictionary.
    for legacy_key in ("bedSizes", "lightTypes"):
        legacy = db.scalar(select(Dictionary).where(Dictionary.key == legacy_key))
        if legacy and not legacy.is_deleted:
            legacy.is_deleted = True
    db.commit()


def list_dictionaries(db: Session):
    rows = db.scalars(_active_stmt(Dictionary).order_by(Dictionary.id.asc())).all()
    result = {}
    for dictionary in rows:
        items = db.scalars(
            _active_stmt(DictionaryItem)
            .where(DictionaryItem.dictionary_id == dictionary.id)
            .order_by(DictionaryItem.sort_order.asc(), DictionaryItem.id.asc())
        ).all()
        result[dictionary.key] = [
            {"label": item.label, "value": item.value, "sort_order": item.sort_order}
            for item in items
        ]
    return result


def replace_dictionary(key: str, payload: DictionaryReplace, db: Session, operator: str = "admin"):
    dictionary = db.scalar(select(Dictionary).where(Dictionary.key == key, Dictionary.is_deleted.is_(False)))
    if not dictionary:
        dictionary = Dictionary(key=key, label=payload.label or key)
        db.add(dictionary)
        db.flush()
        before = None
        action = "create"
    else:
        before = {
            "dictionary": _model_data(dictionary),
            "items": [
                _model_data(item)
                for item in db.scalars(
                    _active_stmt(DictionaryItem).where(DictionaryItem.dictionary_id == dictionary.id)
                ).all()
            ],
        }
        action = "update"
        if payload.label:
            dictionary.label = payload.label

    existing_items = db.scalars(
        select(DictionaryItem).where(DictionaryItem.dictionary_id == dictionary.id)
    ).all()
    item_by_value = {item.value: item for item in existing_items}
    next_values = {item_payload.value for item_payload in payload.items}
    for item in existing_items:
        if item.value not in next_values:
            item.is_deleted = True

    for sort_order, item_payload in enumerate(payload.items):
        existing = item_by_value.get(item_payload.value)
        if existing:
            existing.label = item_payload.label
            existing.sort_order = item_payload.sort_order or sort_order
            existing.is_deleted = False
        else:
            db.add(
                DictionaryItem(
                    dictionary_id=dictionary.id,
                    label=item_payload.label,
                    value=item_payload.value,
                    sort_order=item_payload.sort_order or sort_order,
                )
            )
    db.flush()
    after = {
        "dictionary": _model_data(dictionary),
        "items": [
            _model_data(item)
            for item in db.scalars(
                _active_stmt(DictionaryItem).where(DictionaryItem.dictionary_id == dictionary.id)
            ).all()
        ],
    }
    _audit(db, entity_type="dictionary", entity_id=dictionary.key, action=action, before_data=before, after_data=after, operator=operator)
    db.commit()
    return list_dictionaries(db)


def list_audit_logs(
    db: Session,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == str(entity_id))
    return db.scalars(stmt).all()


def dashboard(db: Session):
    dorm_total = db.scalar(select(func.count(Dorm.id)).where(Dorm.is_deleted.is_(False))) or 0
    room_total = db.scalar(select(func.count(Room.id)).where(Room.is_deleted.is_(False))) or 0
    bed_total = db.scalar(
        select(func.coalesce(func.sum(Room.bed_count), 0)).where(Room.is_deleted.is_(False))
    ) or 0
    current_occupancy = db.scalar(
        select(func.count(Allocation.id)).where(
            Allocation.status == "active",
            Allocation.is_deleted.is_(False),
        )
    ) or 0
    empty_beds = max(bed_total - current_occupancy, 0)
    occupancy_rate = round((current_occupancy / bed_total) * 100, 2) if bed_total > 0 else 0
    available_vehicles = db.scalar(
        select(func.count(Vehicle.id)).where(Vehicle.status == "available", Vehicle.is_deleted.is_(False))
    ) or 0
    in_repair_vehicles = db.scalar(
        select(func.count(Vehicle.id)).where(Vehicle.status == "in_repair", Vehicle.is_deleted.is_(False))
    ) or 0
    disabled_vehicles = db.scalar(
        select(func.count(Vehicle.id)).where(
            Vehicle.status.in_(("disabled", "disposed")), Vehicle.is_deleted.is_(False)
        )
    ) or 0

    today = local_today()
    red_deadline = today + timedelta(days=30)
    yellow_deadline = today + timedelta(days=60)

    stay_risks = list_stay_risks(db)
    risk_red = stay_risks["riskSummary"]["red"]
    risk_yellow = stay_risks["riskSummary"]["yellow"]
    risk_green = stay_risks["riskSummary"]["green"]
    risk_unknown = stay_risks["riskSummary"]["unknown"]

    lease_30_deadline = today + timedelta(days=30)
    lease_60_deadline = today + timedelta(days=60)

    # ✅ ADDED: 90天内需要续租
    lease_90_deadline = today + timedelta(days=90)

    dorms = db.scalars(_active_stmt(Dorm)).all()

    lease_expiring_30 = sum(
        1 for dorm in dorms if dorm.lease_end_date is not None and dorm.lease_end_date <= lease_30_deadline
    )

    lease_expiring_60 = sum(
        1 for dorm in dorms if dorm.lease_end_date is not None and dorm.lease_end_date <= lease_60_deadline
    )

    # ✅ ADDED: 90天内需要续租的宿舍详情
    renewal_needed_dorms = [
        {
            "id": dorm.id,
            "name": dorm.name,
            "address": dorm.address,
            "type": dorm.type,
            "status": dorm.status,
            "lease_start_date": dorm.lease_start_date,
            "lease_end_date": dorm.lease_end_date,
            "days_left": (dorm.lease_end_date - today).days,
        }
        for dorm in dorms
        if dorm.lease_end_date is not None and dorm.lease_end_date <= lease_90_deadline
    ]

    renewal_needed_dorms.sort(key=lambda item: item["days_left"])
    active_vehicle_filter = (Vehicle.is_deleted.is_(False), Vehicle.status != "disposed")
    vehicle_insurance_expiring_30 = db.scalar(
        select(func.count(Vehicle.id)).where(
            *active_vehicle_filter,
            Vehicle.insurance_expire_date.is_not(None),
            Vehicle.insurance_expire_date <= lease_30_deadline,
        )
    ) or 0
    vehicle_inspection_expiring_30 = db.scalar(
        select(func.count(Vehicle.id)).where(
            *active_vehicle_filter,
            Vehicle.inspection_expire_date.is_not(None),
            Vehicle.inspection_expire_date <= lease_30_deadline,
        )
    ) or 0
    vehicle_registration_expiring_30 = db.scalar(
        select(func.count(Vehicle.id)).where(
            *active_vehicle_filter,
            Vehicle.registration_expire_date.is_not(None),
            Vehicle.registration_expire_date <= lease_30_deadline,
        )
    ) or 0
    vehicle_maintenance_due_30 = db.scalar(
        select(func.count(Vehicle.id)).where(
            *active_vehicle_filter,
            Vehicle.maintenance_due_date.is_not(None),
            Vehicle.maintenance_due_date <= lease_30_deadline,
        )
    ) or 0
    vehicle_lease_expiring_60 = db.scalar(
        select(func.count(Vehicle.id)).where(
            *active_vehicle_filter,
            Vehicle.ownership_type == "leased",
            Vehicle.lease_end_date.is_not(None),
            Vehicle.lease_end_date <= lease_60_deadline,
        )
    ) or 0
    uninsured_vehicles = db.scalar(
        select(func.count(Vehicle.id)).where(
            *active_vehicle_filter,
            Vehicle.insurance_expire_date.is_(None),
        )
    ) or 0
    active_driver_person_ids = {
        row[0]
        for row in db.execute(
            select(VehicleDriver.person_id)
            .join(Vehicle, VehicleDriver.vehicle_id == Vehicle.id)
            .where(
                VehicleDriver.is_deleted.is_(False),
                VehicleDriver.status == "active",
                *active_vehicle_filter,
            )
        ).all()
    }
    driver_license_expiring_30 = 0
    if active_driver_person_ids:
        driver_license_expiring_30 = db.scalar(
            select(func.count(PersonLicense.person_id)).where(
                PersonLicense.is_deleted.is_(False),
                PersonLicense.person_id.in_(active_driver_person_ids),
                PersonLicense.expire_date.is_not(None),
                PersonLicense.expire_date <= lease_30_deadline,
            )
        ) or 0
    vehicles_without_drivers = db.scalar(
        select(func.count(Vehicle.id)).where(
            *active_vehicle_filter,
            ~Vehicle.id.in_(
                select(VehicleDriver.vehicle_id).where(
                    VehicleDriver.is_deleted.is_(False), VehicleDriver.status == "active"
                )
            ),
        )
    ) or 0
    open_claims = db.scalar(
        select(func.count(VehicleAccident.id)).where(
            VehicleAccident.is_deleted.is_(False),
            VehicleAccident.claim_status.in_(CLAIM_OPEN_STATUSES),
        )
    ) or 0

    return {
        "dormTotal": dorm_total,
        "roomTotal": room_total,
        "bedTotal": bed_total,
        "currentOccupancy": current_occupancy,
        "emptyBeds": empty_beds,
        "occupancyRate": occupancy_rate,
        "riskPeople": risk_red + risk_yellow,
        "riskRed": risk_red,
        "riskYellow": risk_yellow,
        "riskGreen": risk_green,
        "riskUnknown": risk_unknown,
        "leaseExpiring30": lease_expiring_30,
        "leaseExpiring60": lease_expiring_60,
        "leaseExpiring90": len(renewal_needed_dorms),
        "renewalNeededDorms": renewal_needed_dorms,
        "availableVehicles": available_vehicles,
        "maintenanceVehicles": in_repair_vehicles,
        "vehiclesInRepair": in_repair_vehicles,
        "disabledVehicles": disabled_vehicles,
        "vehicleInsuranceExpiring30": vehicle_insurance_expiring_30,
        "vehicleInspectionExpiring30": vehicle_inspection_expiring_30,
        "vehicleRegistrationExpiring30": vehicle_registration_expiring_30,
        "vehicleMaintenanceDue30": vehicle_maintenance_due_30,
        "vehicleLeaseExpiring60": vehicle_lease_expiring_60,
        "uninsuredVehicles": uninsured_vehicles,
        "vehiclesWithoutDrivers": vehicles_without_drivers,
        "driverLicenseExpiring30": driver_license_expiring_30,
        "openClaims": open_claims,
        "stayRiskSummary": stay_risks["riskSummary"],
        "stayExpiring30": stay_risks["expiring30"],
        "stayExpiring60": stay_risks["expiring60"],
        "stayOverstayed": stay_risks["overstayed"],
    }


def alerts(db: Session):
    today = local_today()
    red_deadline = today + timedelta(days=30)
    yellow_deadline = today + timedelta(days=60)

    stay_rows = db.execute(
        select(Stay, Person)
        .join(Person, Stay.person_id == Person.id)
        .where(Stay.is_deleted.is_(False), Person.is_deleted.is_(False))
    ).all()
    risk_red = []
    risk_yellow = []
    for stay, person in stay_rows:
        if stay.max_stay_date is None:
            continue
        days_left = (stay.max_stay_date - today).days
        item = {
            "personId": person.id,
            "chineseName": person.chinese_name,
        "englishName": person.english_name or "",
            "department": person.department,
            "gender": person.gender,
            "visaType": stay.visa_type,
            "maxStayDate": stay.max_stay_date,
            "daysLeft": days_left,
        }
        if stay.max_stay_date <= red_deadline:
            risk_red.append(item)
        elif stay.max_stay_date <= yellow_deadline:
            risk_yellow.append(item)

    lease_60_deadline = today + timedelta(days=60)
    dorms = db.scalars(_active_stmt(Dorm)).all()
    lease_expiring = []
    for dorm in dorms:
        if dorm.lease_end_date is None:
            continue
        if dorm.lease_end_date <= lease_60_deadline:
            lease_expiring.append(
                {
                    "dormId": dorm.id,
                    "name": dorm.name,
                    "address": dorm.address,
                    "leaseEndDate": dorm.lease_end_date,
                    "daysLeft": (dorm.lease_end_date - today).days,
                }
            )

    lease_expiring.sort(key=lambda item: item["daysLeft"])
    risk_red.sort(key=lambda item: item["daysLeft"])
    risk_yellow.sort(key=lambda item: item["daysLeft"])

    return {
        "riskRed": risk_red,
        "riskYellow": risk_yellow,
        "leaseExpiring60": lease_expiring,
    }
