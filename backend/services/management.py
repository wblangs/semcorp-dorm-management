import json
from datetime import date, datetime, timedelta
from typing import Optional, Union

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import AuditLog, Allocation, Dictionary, DictionaryItem, Dorm, Person, Room, Stay, Vehicle
from backend.schemas import (
    AllocationCreate,
    AllocationUpdate,
    CheckoutRequest,
    DictionaryReplace,
    DormCreate,
    DormUpdate,
    PersonCreate,
    PersonUpdate,
    RoomCreate,
    RoomUpdate,
    StayUpsert,
    VehicleCreate,
    VehicleUpdate,
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
    "personTypes": {
        "label": "人员类型",
        "items": [("Employee", "Employee"), ("Contractor", "Contractor"), ("Visitor", "Visitor")],
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
            "english_name": person.english_name,
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
    if room.status.lower() == "disabled":
        raise HTTPException(status_code=400, detail="房间已禁用，不能入住")
    if room.gender_limit != "Any" and room.gender_limit != person.gender:
        raise HTTPException(status_code=400, detail="人员性别与房间限制不匹配")
    room_active_count = _active_room_count(room.id, db, exclude_allocation_id=allocation_id_for_update)
    if room_active_count >= room.bed_count:
        raise HTTPException(status_code=400, detail="房间床位已满")


def list_dorms(db: Session):
    return db.scalars(_active_stmt(Dorm).order_by(Dorm.id.desc())).all()


def create_dorm(payload: DormCreate, db: Session):
    dorm = Dorm(**payload.model_dump())
    db.add(dorm)
    db.flush()
    _audit(db, entity_type="dorm", entity_id=dorm.id, action="create", before_data=None, after_data=_model_data(dorm))
    db.commit()
    db.refresh(dorm)
    return dorm


def update_dorm(dorm_id: int, payload: DormUpdate, db: Session):
    dorm = _get_active(db, Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="Dorm not found")
    before = _model_data(dorm)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(dorm, key, value)
    db.flush()
    _audit(db, entity_type="dorm", entity_id=dorm.id, action="update", before_data=before, after_data=_model_data(dorm))
    db.commit()
    db.refresh(dorm)
    return dorm


def delete_dorm(dorm_id: int, db: Session):
    dorm = _get_active(db, Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="Dorm not found")
    active_count = db.scalar(
        select(func.count(Allocation.id))
        .join(Room, Allocation.room_id == Room.id)
        .where(
            Room.dorm_id == dorm_id,
            Room.is_deleted.is_(False),
            Allocation.status == "active",
            Allocation.is_deleted.is_(False),
        )
    ) or 0
    if active_count > 0:
        raise HTTPException(status_code=400, detail="宿舍下属房间存在 active 入住记录，不能删除")
    before = _model_data(dorm)
    dorm.is_deleted = True
    for room in dorm.rooms:
        if not room.is_deleted:
            room.is_deleted = True
    db.flush()
    _audit(db, entity_type="dorm", entity_id=dorm.id, action="delete", before_data=before, after_data=_model_data(dorm))
    db.commit()
    return {"deleted": True}


def list_rooms(dorm_id: Optional[int], db: Session):
    stmt = _active_stmt(Room).order_by(Room.id.desc())
    if dorm_id is not None:
        stmt = stmt.where(Room.dorm_id == dorm_id)
    return db.scalars(stmt).all()


def create_room(payload: RoomCreate, db: Session):
    if not _get_active(db, Dorm, payload.dorm_id):
        raise HTTPException(status_code=400, detail="Dorm does not exist")
    room = Room(**payload.model_dump())
    db.add(room)
    db.flush()
    _audit(db, entity_type="room", entity_id=room.id, action="create", before_data=None, after_data=_model_data(room))
    db.commit()
    db.refresh(room)
    return room


def update_room(room_id: int, payload: RoomUpdate, db: Session):
    room = _get_active(db, Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    values = payload.model_dump(exclude_none=True)
    if "dorm_id" in values and not _get_active(db, Dorm, values["dorm_id"]):
        raise HTTPException(status_code=400, detail="Dorm does not exist")
    before = _model_data(room)
    for key, value in values.items():
        setattr(room, key, value)
    db.flush()
    _audit(db, entity_type="room", entity_id=room.id, action="update", before_data=before, after_data=_model_data(room))
    db.commit()
    db.refresh(room)
    return room


def delete_room(room_id: int, db: Session):
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
        raise HTTPException(status_code=400, detail="房间存在 active 入住记录，不能删除")
    before = _model_data(room)
    room.is_deleted = True
    db.flush()
    _audit(db, entity_type="room", entity_id=room.id, action="delete", before_data=before, after_data=_model_data(room))
    db.commit()
    return {"deleted": True}


def list_people(db: Session):
    return db.scalars(_active_stmt(Person).order_by(Person.id.desc())).all()


def create_person(payload: PersonCreate, db: Session):
    _validate_department_option(db, payload.department)
    person = Person(**payload.model_dump())
    db.add(person)
    db.flush()
    _audit(db, entity_type="person", entity_id=person.id, action="create", before_data=None, after_data=_model_data(person))
    db.commit()
    db.refresh(person)
    return person


def update_person(person_id: int, payload: PersonUpdate, db: Session):
    person = _get_active(db, Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    if payload.department is not None:
        _validate_department_option(db, payload.department)
    before = _model_data(person)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(person, key, value)
    db.flush()
    _audit(db, entity_type="person", entity_id=person.id, action="update", before_data=before, after_data=_model_data(person))
    db.commit()
    db.refresh(person)
    return person


def delete_person(person_id: int, db: Session):
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
    _audit(db, entity_type="person", entity_id=person.id, action="delete", before_data=before, after_data=_model_data(person))
    db.commit()
    return {"deleted": True}


def list_stay(db: Session):
    people = db.scalars(_active_stmt(Person).order_by(Person.id.asc())).all()
    stays = db.scalars(_active_stmt(Stay)).all()
    stay_map = {stay.person_id: stay for stay in stays}
    today = date.today()
    return [_serialize_stay(stay_map.get(person.id), person, today) for person in people]


def get_stay(person_id: int, db: Session):
    person = _get_active(db, Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    today = date.today()
    stay = _get_active(db, Stay, person_id)
    return _serialize_stay(stay, person, today)


def upsert_stay(payload: StayUpsert, db: Session):
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
    _audit(db, entity_type="stay", entity_id=stay.person_id, action=action, before_data=before, after_data=_model_data(stay))
    db.commit()
    db.refresh(stay)
    return _serialize_stay(stay, person, date.today())


def delete_stay(stay_id: int, db: Session):
    stay = _get_active(db, Stay, stay_id)
    if not stay:
        raise HTTPException(status_code=404, detail="Stay 记录不存在")
    before = _model_data(stay)
    stay.is_deleted = True
    db.flush()
    _audit(db, entity_type="stay", entity_id=stay.person_id, action="delete", before_data=before, after_data=_model_data(stay))
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
    return db.scalars(_active_stmt(Allocation).order_by(Allocation.id.desc())).all()


def create_allocation(payload: AllocationCreate, db: Session):
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
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def update_allocation(allocation_id: int, payload: AllocationUpdate, db: Session):
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
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def checkout_allocation(allocation_id: int, payload: CheckoutRequest, db: Session):
    allocation = _get_active(db, Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    if allocation.status == "checked_out":
        raise HTTPException(status_code=400, detail="该入住记录已退宿")
    _ = payload
    before = _model_data(allocation)
    checkout_date = date.today()
    allocation.actual_check_out_date = checkout_date
    allocation.check_out_date = checkout_date
    allocation.status = "checked_out"
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="checkout",
        before_data=before,
        after_data=_model_data(allocation),
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def delete_allocation(allocation_id: int, db: Session):
    allocation = _get_active(db, Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    if allocation.status == "active":
        raise HTTPException(status_code=400, detail="active 入住记录不能直接删除，请先退房")
    if allocation.status not in {"cancelled", "draft"}:
        raise HTTPException(status_code=400, detail="仅 cancelled 或 draft 入住记录允许删除")
    before = _model_data(allocation)
    allocation.is_deleted = True
    db.flush()
    _audit(
        db,
        entity_type="allocation",
        entity_id=allocation.id,
        action="delete",
        before_data=before,
        after_data=_model_data(allocation),
    )
    db.commit()
    return {"deleted": True}


def list_available_rooms(dorm_id: int, person_id: int, db: Session):
    person = _get_active(db, Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    if not _get_active(db, Dorm, dorm_id):
        raise HTTPException(status_code=404, detail="宿舍不存在")

    rooms = db.scalars(
        _active_stmt(Room).where(Room.dorm_id == dorm_id).order_by(Room.id.asc())
    ).all()
    result = []
    for room in rooms:
        if room.status.lower() == "disabled":
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


def list_vehicles(db: Session):
    return db.scalars(_active_stmt(Vehicle).order_by(Vehicle.id.desc())).all()


def create_vehicle(payload: VehicleCreate, db: Session):
    if payload.base_dorm_id and not _get_active(db, Dorm, payload.base_dorm_id):
        raise HTTPException(status_code=400, detail="所属宿舍不存在")
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.flush()
    _audit(
        db,
        entity_type="vehicle",
        entity_id=vehicle.id,
        action="create",
        before_data=None,
        after_data=_model_data(vehicle),
    )
    db.commit()
    db.refresh(vehicle)
    return vehicle


def update_vehicle(vehicle_id: int, payload: VehicleUpdate, db: Session):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    values = payload.model_dump(exclude_none=True)
    if "base_dorm_id" in values and values["base_dorm_id"] and not _get_active(db, Dorm, values["base_dorm_id"]):
        raise HTTPException(status_code=400, detail="所属宿舍不存在")
    before = _model_data(vehicle)
    for key, value in values.items():
        setattr(vehicle, key, value)
    db.flush()
    _audit(
        db,
        entity_type="vehicle",
        entity_id=vehicle.id,
        action="update",
        before_data=before,
        after_data=_model_data(vehicle),
    )
    db.commit()
    db.refresh(vehicle)
    return vehicle


def delete_vehicle(vehicle_id: int, db: Session):
    vehicle = _get_active(db, Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    # Reserved for future dispatch records: block delete when active dispatches exist.
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
    )
    db.commit()
    return {"deleted": True}


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


def replace_dictionary(key: str, payload: DictionaryReplace, db: Session):
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
    _audit(db, entity_type="dictionary", entity_id=dictionary.key, action=action, before_data=before, after_data=after)
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
    maintenance_vehicles = db.scalar(
        select(func.count(Vehicle.id)).where(Vehicle.status == "maintenance", Vehicle.is_deleted.is_(False))
    ) or 0
    disabled_vehicles = db.scalar(
        select(func.count(Vehicle.id)).where(Vehicle.status == "disabled", Vehicle.is_deleted.is_(False))
    ) or 0

    today = date.today()
    red_deadline = today + timedelta(days=30)
    yellow_deadline = today + timedelta(days=60)

    stay_risks = list_stay_risks(db)
    risk_red = stay_risks["riskSummary"]["red"]
    risk_yellow = stay_risks["riskSummary"]["yellow"]
    risk_green = stay_risks["riskSummary"]["green"]
    risk_unknown = stay_risks["riskSummary"]["unknown"]

    lease_30_deadline = today + timedelta(days=30)
    lease_60_deadline = today + timedelta(days=60)
    dorms = db.scalars(_active_stmt(Dorm)).all()
    lease_expiring_30 = sum(
        1 for dorm in dorms if dorm.lease_end_date is not None and dorm.lease_end_date <= lease_30_deadline
    )
    lease_expiring_60 = sum(
        1 for dorm in dorms if dorm.lease_end_date is not None and dorm.lease_end_date <= lease_60_deadline
    )
    vehicle_insurance_expiring_30 = db.scalar(
        select(func.count(Vehicle.id)).where(
            Vehicle.is_deleted.is_(False),
            Vehicle.insurance_expire_date.is_not(None),
            Vehicle.insurance_expire_date <= lease_30_deadline,
        )
    ) or 0
    vehicle_inspection_expiring_30 = db.scalar(
        select(func.count(Vehicle.id)).where(
            Vehicle.is_deleted.is_(False),
            Vehicle.inspection_expire_date.is_not(None),
            Vehicle.inspection_expire_date <= lease_30_deadline,
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
        "availableVehicles": available_vehicles,
        "maintenanceVehicles": maintenance_vehicles,
        "disabledVehicles": disabled_vehicles,
        "vehicleInsuranceExpiring30": vehicle_insurance_expiring_30,
        "vehicleInspectionExpiring30": vehicle_inspection_expiring_30,
        "stayRiskSummary": stay_risks["riskSummary"],
        "stayExpiring30": stay_risks["expiring30"],
        "stayExpiring60": stay_risks["expiring60"],
        "stayOverstayed": stay_risks["overstayed"],
    }


def alerts(db: Session):
    today = date.today()
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
            "englishName": person.english_name,
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
