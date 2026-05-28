from datetime import date, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import Allocation, Dorm, Person, Room, Stay, Vehicle
from backend.schemas import (
    AllocationCreate,
    AllocationUpdate,
    CheckoutRequest,
    DormCreate,
    DormUpdate,
    PersonCreate,
    PersonUpdate,
    RoomCreate,
    RoomUpdate,
    StayUpsert,
    VehicleCreate,
)
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
    stmt = select(func.count(Allocation.id)).where(Allocation.room_id == room_id, Allocation.status == "active")
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
    return db.scalars(select(Dorm).order_by(Dorm.id.desc())).all()


def create_dorm(payload: DormCreate, db: Session):
    dorm = Dorm(**payload.model_dump())
    db.add(dorm)
    db.commit()
    db.refresh(dorm)
    return dorm


def update_dorm(dorm_id: int, payload: DormUpdate, db: Session):
    dorm = db.get(Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="Dorm not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(dorm, key, value)
    db.commit()
    db.refresh(dorm)
    return dorm


def delete_dorm(dorm_id: int, db: Session):
    dorm = db.get(Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="Dorm not found")
    db.delete(dorm)
    db.commit()
    return {"deleted": True}


def list_rooms(dorm_id: Optional[int], db: Session):
    stmt = select(Room).order_by(Room.id.desc())
    if dorm_id is not None:
        stmt = stmt.where(Room.dorm_id == dorm_id)
    return db.scalars(stmt).all()


def create_room(payload: RoomCreate, db: Session):
    if not db.get(Dorm, payload.dorm_id):
        raise HTTPException(status_code=400, detail="Dorm does not exist")
    room = Room(**payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def update_room(room_id: int, payload: RoomUpdate, db: Session):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    values = payload.model_dump(exclude_none=True)
    if "dorm_id" in values and not db.get(Dorm, values["dorm_id"]):
        raise HTTPException(status_code=400, detail="Dorm does not exist")
    for key, value in values.items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return room


def delete_room(room_id: int, db: Session):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    db.delete(room)
    db.commit()
    return {"deleted": True}


def list_people(db: Session):
    return db.scalars(select(Person).order_by(Person.id.desc())).all()


def create_person(payload: PersonCreate, db: Session):
    person = Person(**payload.model_dump())
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


def update_person(person_id: int, payload: PersonUpdate, db: Session):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(person, key, value)
    db.commit()
    db.refresh(person)
    return person


def delete_person(person_id: int, db: Session):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(person)
    db.commit()
    return {"deleted": True}


def list_stay(db: Session):
    people = db.scalars(select(Person).order_by(Person.id.asc())).all()
    stays = db.scalars(select(Stay)).all()
    stay_map = {stay.person_id: stay for stay in stays}
    today = date.today()
    return [_serialize_stay(stay_map.get(person.id), person, today) for person in people]


def get_stay(person_id: int, db: Session):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    today = date.today()
    stay = db.get(Stay, person_id)
    return _serialize_stay(stay, person, today)


def upsert_stay(payload: StayUpsert, db: Session):
    person = db.get(Person, payload.person_id)
    if not person:
        raise HTTPException(status_code=400, detail="人员不存在")
    if payload.actual_leave_date and payload.actual_leave_date < payload.arrival_date:
        raise HTTPException(status_code=400, detail="实际离美日期不能早于赴美日期")
    stay = db.get(Stay, payload.person_id)
    if stay:
        for key, value in payload.model_dump().items():
            setattr(stay, key, value)
    else:
        stay = Stay(**payload.model_dump())
        db.add(stay)
    db.commit()
    db.refresh(stay)
    return _serialize_stay(stay, person, date.today())


def delete_stay(stay_id: int, db: Session):
    stay = db.get(Stay, stay_id)
    if not stay:
        raise HTTPException(status_code=404, detail="Stay 记录不存在")
    db.delete(stay)
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
    return db.scalars(select(Allocation).order_by(Allocation.id.desc())).all()


def create_allocation(payload: AllocationCreate, db: Session):
    person = db.get(Person, payload.person_id)
    dorm = db.get(Dorm, payload.dorm_id)
    room = db.get(Room, payload.room_id)
    _validate_allocation_inputs(
        person=person,
        dorm=dorm,
        room=room,
        check_in_date=payload.check_in_date,
        db=db,
    )
    active_person_stmt = select(func.count(Allocation.id)).where(
        Allocation.person_id == payload.person_id, Allocation.status == "active"
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
    db.commit()
    db.refresh(allocation)
    return allocation


def update_allocation(allocation_id: int, payload: AllocationUpdate, db: Session):
    allocation = db.get(Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    if allocation.status != "active":
        raise HTTPException(status_code=400, detail="仅在住记录允许修改")

    next_dorm_id = payload.dorm_id if payload.dorm_id is not None else allocation.dorm_id
    next_room_id = payload.room_id if payload.room_id is not None else allocation.room_id
    next_check_in = payload.check_in_date if payload.check_in_date is not None else allocation.check_in_date

    person = db.get(Person, allocation.person_id)
    dorm = db.get(Dorm, next_dorm_id)
    room = db.get(Room, next_room_id)
    _validate_allocation_inputs(
        person=person,
        dorm=dorm,
        room=room,
        check_in_date=next_check_in,
        db=db,
        allocation_id_for_update=allocation.id,
    )

    update_data = payload.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(allocation, key, value)
    db.commit()
    db.refresh(allocation)
    return allocation


def checkout_allocation(allocation_id: int, payload: CheckoutRequest, db: Session):
    allocation = db.get(Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    if allocation.status == "checked_out":
        raise HTTPException(status_code=400, detail="该入住记录已退宿")
    _ = payload
    checkout_date = date.today()
    allocation.actual_check_out_date = checkout_date
    allocation.check_out_date = checkout_date
    allocation.status = "checked_out"
    db.commit()
    db.refresh(allocation)
    return allocation


def delete_allocation(allocation_id: int, db: Session):
    allocation = db.get(Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="入住记录不存在")
    db.delete(allocation)
    db.commit()
    return {"deleted": True}


def list_available_rooms(dorm_id: int, person_id: int, db: Session):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    if not db.get(Dorm, dorm_id):
        raise HTTPException(status_code=404, detail="宿舍不存在")

    rooms = db.scalars(
        select(Room).where(Room.dorm_id == dorm_id).order_by(Room.id.asc())
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
    return db.scalars(select(Vehicle).order_by(Vehicle.id.desc())).all()


def create_vehicle(payload: VehicleCreate, db: Session):
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def dashboard(db: Session):
    dorm_total = db.scalar(select(func.count(Dorm.id))) or 0
    room_total = db.scalar(select(func.count(Room.id))) or 0
    bed_total = db.scalar(select(func.coalesce(func.sum(Room.bed_count), 0))) or 0
    current_occupancy = db.scalar(select(func.count(Allocation.id)).where(Allocation.status == "active")) or 0
    empty_beds = max(bed_total - current_occupancy, 0)
    occupancy_rate = round((current_occupancy / bed_total) * 100, 2) if bed_total > 0 else 0
    available_vehicles = db.scalar(select(func.count(Vehicle.id)).where(Vehicle.status == "available")) or 0

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
    dorms = db.scalars(select(Dorm)).all()
    lease_expiring_30 = sum(
        1 for dorm in dorms if dorm.lease_end_date is not None and dorm.lease_end_date <= lease_30_deadline
    )
    lease_expiring_60 = sum(
        1 for dorm in dorms if dorm.lease_end_date is not None and dorm.lease_end_date <= lease_60_deadline
    )

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
        "stayRiskSummary": stay_risks["riskSummary"],
        "stayExpiring30": stay_risks["expiring30"],
        "stayExpiring60": stay_risks["expiring60"],
        "stayOverstayed": stay_risks["overstayed"],
    }


def alerts(db: Session):
    today = date.today()
    red_deadline = today + timedelta(days=30)
    yellow_deadline = today + timedelta(days=60)

    stay_rows = db.execute(select(Stay, Person).join(Person, Stay.person_id == Person.id)).all()
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
    dorms = db.scalars(select(Dorm)).all()
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
