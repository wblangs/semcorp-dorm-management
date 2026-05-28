from datetime import date, timedelta
from typing import Generator, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import (
    Date,
    ForeignKey,
    Integer,
    String,
    create_engine,
    func,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Dorm(Base):
    __tablename__ = "dorms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    lease_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    lease_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")

    rooms: Mapped[list["Room"]] = relationship(back_populates="dorm", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dorm_id: Mapped[int] = mapped_column(ForeignKey("dorms.id"), nullable=False, index=True)
    room_name: Mapped[str] = mapped_column(String(50), nullable=False)
    room_type: Mapped[str] = mapped_column(String(50), nullable=False)
    bed_count: Mapped[int] = mapped_column(Integer, nullable=False)
    gender_limit: Mapped[Literal["Male", "Female", "Any"]] = mapped_column(String(10), default="Any")
    status: Mapped[str] = mapped_column(String(20), default="active")

    dorm: Mapped["Dorm"] = relationship(back_populates="rooms")
    allocations: Mapped[list["Allocation"]] = relationship(back_populates="room")


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chinese_name: Mapped[str] = mapped_column(String(50), nullable=False)
    english_name: Mapped[str] = mapped_column(String(50), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    person_type: Mapped[str] = mapped_column(String(50), nullable=False)
    gender: Mapped[Literal["Male", "Female"]] = mapped_column(String(10), nullable=False)
    can_drive: Mapped[bool] = mapped_column(default=False)
    can_be_driver: Mapped[bool] = mapped_column(default=False)

    stay: Mapped[Optional["Stay"]] = relationship(back_populates="person", uselist=False, cascade="all, delete-orphan")
    allocations: Mapped[list["Allocation"]] = relationship(back_populates="person")


class Stay(Base):
    __tablename__ = "stays"

    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), primary_key=True)
    visa_type: Mapped[str] = mapped_column(String(50), nullable=False)
    arrival_date: Mapped[date] = mapped_column(Date, nullable=False)
    planned_leave_date: Mapped[date] = mapped_column(Date, nullable=False)
    max_stay_date: Mapped[date] = mapped_column(Date, nullable=False)

    person: Mapped["Person"] = relationship(back_populates="stay")


class Allocation(Base):
    __tablename__ = "allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), nullable=False, index=True)
    dorm_id: Mapped[int] = mapped_column(ForeignKey("dorms.id"), nullable=False, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_out_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[Literal["active", "checked_out"]] = mapped_column(String(20), default="active")

    person: Mapped["Person"] = relationship(back_populates="allocations")
    room: Mapped["Room"] = relationship(back_populates="allocations")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plate_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="available")


engine = create_engine("sqlite:///./dorm_commute.db", future=True)
Base.metadata.create_all(engine)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


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


class CheckoutRequest(BaseModel):
    check_out_date: date


class VehicleCreate(BaseModel):
    plate_number: str
    seat_count: int = Field(gt=0)
    status: str = "available"


class StayUpsert(BaseModel):
    person_id: int
    visa_type: str
    arrival_date: date
    planned_leave_date: date
    max_stay_date: date


app = FastAPI(title="外派员工宿舍与通勤管理系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/ui", StaticFiles(directory="ui", html=True), name="ui")


@app.get("/")
def root():
    return RedirectResponse(url="/ui/")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/dorms")
def list_dorms(db: Session = Depends(get_db)):
    return db.scalars(select(Dorm).order_by(Dorm.id.desc())).all()


@app.post("/api/dorms")
def create_dorm(payload: DormCreate, db: Session = Depends(get_db)):
    dorm = Dorm(**payload.model_dump())
    db.add(dorm)
    db.commit()
    db.refresh(dorm)
    return dorm


@app.put("/api/dorms/{dorm_id}")
def update_dorm(dorm_id: int, payload: DormUpdate, db: Session = Depends(get_db)):
    dorm = db.get(Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="Dorm not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(dorm, k, v)
    db.commit()
    db.refresh(dorm)
    return dorm


@app.delete("/api/dorms/{dorm_id}")
def delete_dorm(dorm_id: int, db: Session = Depends(get_db)):
    dorm = db.get(Dorm, dorm_id)
    if not dorm:
        raise HTTPException(status_code=404, detail="Dorm not found")
    db.delete(dorm)
    db.commit()
    return {"deleted": True}


@app.get("/api/rooms")
def list_rooms(dorm_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    stmt = select(Room).order_by(Room.id.desc())
    if dorm_id is not None:
        stmt = stmt.where(Room.dorm_id == dorm_id)
    return db.scalars(stmt).all()


@app.post("/api/rooms")
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    if not db.get(Dorm, payload.dorm_id):
        raise HTTPException(status_code=400, detail="Dorm does not exist")
    room = Room(**payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@app.put("/api/rooms/{room_id}")
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    values = payload.model_dump(exclude_none=True)
    if "dorm_id" in values and not db.get(Dorm, values["dorm_id"]):
        raise HTTPException(status_code=400, detail="Dorm does not exist")
    for k, v in values.items():
        setattr(room, k, v)
    db.commit()
    db.refresh(room)
    return room


@app.delete("/api/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    db.delete(room)
    db.commit()
    return {"deleted": True}


@app.get("/api/people")
def list_people(db: Session = Depends(get_db)):
    return db.scalars(select(Person).order_by(Person.id.desc())).all()


@app.post("/api/people")
def create_person(payload: PersonCreate, db: Session = Depends(get_db)):
    person = Person(**payload.model_dump())
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


@app.put("/api/people/{person_id}")
def update_person(person_id: int, payload: PersonUpdate, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(person, k, v)
    db.commit()
    db.refresh(person)
    return person


@app.delete("/api/people/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(person)
    db.commit()
    return {"deleted": True}


@app.get("/api/stay")
def list_stay(db: Session = Depends(get_db)):
    return db.scalars(select(Stay)).all()


@app.post("/api/stay")
def upsert_stay(payload: StayUpsert, db: Session = Depends(get_db)):
    if not db.get(Person, payload.person_id):
        raise HTTPException(status_code=400, detail="Person does not exist")
    stay = db.get(Stay, payload.person_id)
    if stay:
        for k, v in payload.model_dump().items():
            setattr(stay, k, v)
    else:
        stay = Stay(**payload.model_dump())
        db.add(stay)
    db.commit()
    db.refresh(stay)
    return stay


@app.get("/api/allocations")
def list_allocations(db: Session = Depends(get_db)):
    return db.scalars(select(Allocation).order_by(Allocation.id.desc())).all()


@app.post("/api/allocations")
def create_allocation(payload: AllocationCreate, db: Session = Depends(get_db)):
    person = db.get(Person, payload.person_id)
    dorm = db.get(Dorm, payload.dorm_id)
    room = db.get(Room, payload.room_id)
    if not person or not dorm or not room:
        raise HTTPException(status_code=400, detail="Person, dorm, or room does not exist")

    if room.dorm_id != dorm.id:
        raise HTTPException(status_code=400, detail="Room does not belong to selected dorm")

    active_person_stmt = select(func.count(Allocation.id)).where(
        Allocation.person_id == person.id, Allocation.status == "active"
    )
    if db.scalar(active_person_stmt) > 0:
        raise HTTPException(status_code=400, detail="Person already has active allocation")

    active_room_stmt = select(func.count(Allocation.id)).where(
        Allocation.room_id == room.id, Allocation.status == "active"
    )
    current_room_count = db.scalar(active_room_stmt) or 0
    if current_room_count >= room.bed_count:
        raise HTTPException(status_code=400, detail="Room is full")

    if room.gender_limit != "Any" and room.gender_limit != person.gender:
        raise HTTPException(status_code=400, detail="Gender does not match room limit")

    allocation = Allocation(
        person_id=person.id,
        dorm_id=dorm.id,
        room_id=room.id,
        check_in_date=payload.check_in_date,
        status="active",
    )
    db.add(allocation)
    db.commit()
    db.refresh(allocation)
    return allocation


@app.post("/api/allocations/{allocation_id}/checkout")
def checkout_allocation(allocation_id: int, payload: CheckoutRequest, db: Session = Depends(get_db)):
    allocation = db.get(Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if allocation.status == "checked_out":
        raise HTTPException(status_code=400, detail="Allocation already checked out")
    allocation.check_out_date = payload.check_out_date
    allocation.status = "checked_out"
    db.commit()
    db.refresh(allocation)
    return allocation


@app.get("/api/vehicles")
def list_vehicles(db: Session = Depends(get_db)):
    return db.scalars(select(Vehicle).order_by(Vehicle.id.desc())).all()


@app.post("/api/vehicles")
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db)):
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    dorm_total = db.scalar(select(func.count(Dorm.id))) or 0
    room_total = db.scalar(select(func.count(Room.id))) or 0
    bed_total = db.scalar(select(func.coalesce(func.sum(Room.bed_count), 0))) or 0
    current_occupancy = db.scalar(select(func.count(Allocation.id)).where(Allocation.status == "active")) or 0
    empty_beds = max(bed_total - current_occupancy, 0)
    available_vehicles = (
        db.scalar(select(func.count(Vehicle.id)).where(Vehicle.status == "available")) or 0
    )

    today = date.today()
    red_deadline = today + timedelta(days=30)
    yellow_deadline = today + timedelta(days=60)

    stays = db.scalars(select(Stay)).all()
    risk_red = 0
    risk_yellow = 0
    risk_green = 0
    for s in stays:
        days_left = (s.max_stay_date - today).days
        if days_left <= 30:
            risk_red += 1
        elif days_left <= 60:
            risk_yellow += 1
        else:
            risk_green += 1

    lease_30_deadline = today + timedelta(days=30)
    lease_60_deadline = today + timedelta(days=60)
    dorms = db.scalars(select(Dorm)).all()
    lease_expiring_30 = sum(
        1 for d in dorms if d.lease_end_date is not None and d.lease_end_date <= lease_30_deadline
    )
    lease_expiring_60 = sum(
        1 for d in dorms if d.lease_end_date is not None and d.lease_end_date <= lease_60_deadline
    )

    return {
        "dormTotal": dorm_total,
        "roomTotal": room_total,
        "bedTotal": bed_total,
        "currentOccupancy": current_occupancy,
        "emptyBeds": empty_beds,
        "riskPeople": risk_red + risk_yellow,
        "riskRed": risk_red,
        "riskYellow": risk_yellow,
        "riskGreen": risk_green,
        "leaseExpiring30": lease_expiring_30,
        "leaseExpiring60": lease_expiring_60,
        "availableVehicles": available_vehicles,
    }


@app.get("/api/alerts")
def alerts(db: Session = Depends(get_db)):
    today = date.today()
    red_deadline = today + timedelta(days=30)
    yellow_deadline = today + timedelta(days=60)

    stay_rows = db.execute(select(Stay, Person).join(Person, Stay.person_id == Person.id)).all()
    risk_red = []
    risk_yellow = []
    for stay, person in stay_rows:
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
    for d in dorms:
        if d.lease_end_date is None:
            continue
        if d.lease_end_date <= lease_60_deadline:
            lease_expiring.append(
                {
                    "dormId": d.id,
                    "name": d.name,
                    "address": d.address,
                    "leaseEndDate": d.lease_end_date,
                    "daysLeft": (d.lease_end_date - today).days,
                }
            )

    lease_expiring.sort(key=lambda x: x["daysLeft"])
    risk_red.sort(key=lambda x: x["daysLeft"])
    risk_yellow.sort(key=lambda x: x["daysLeft"])

    return {
        "riskRed": risk_red,
        "riskYellow": risk_yellow,
        "leaseExpiring60": lease_expiring,
    }
