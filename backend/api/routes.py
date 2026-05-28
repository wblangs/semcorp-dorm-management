from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
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
)
from backend.services import management

router = APIRouter(prefix="/api")


@router.get("/dorms")
def list_dorms(db: Session = Depends(get_db)):
    return management.list_dorms(db)


@router.post("/dorms")
def create_dorm(payload: DormCreate, db: Session = Depends(get_db)):
    return management.create_dorm(payload, db)


@router.put("/dorms/{dorm_id}")
def update_dorm(dorm_id: int, payload: DormUpdate, db: Session = Depends(get_db)):
    return management.update_dorm(dorm_id, payload, db)


@router.delete("/dorms/{dorm_id}")
def delete_dorm(dorm_id: int, db: Session = Depends(get_db)):
    return management.delete_dorm(dorm_id, db)


@router.get("/dictionaries")
def list_dictionaries(db: Session = Depends(get_db)):
    return management.list_dictionaries(db)


@router.put("/dictionaries/{key}")
def replace_dictionary(key: str, payload: DictionaryReplace, db: Session = Depends(get_db)):
    return management.replace_dictionary(key, payload, db)


@router.get("/audit-logs")
def list_audit_logs(
    entity_type: Optional[str] = Query(default=None),
    entity_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    return management.list_audit_logs(db, entity_type=entity_type, entity_id=entity_id)


@router.get("/rooms")
def list_rooms(dorm_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    return management.list_rooms(dorm_id, db)


@router.post("/rooms")
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    return management.create_room(payload, db)


@router.put("/rooms/{room_id}")
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)):
    return management.update_room(room_id, payload, db)


@router.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    return management.delete_room(room_id, db)


@router.get("/people")
def list_people(db: Session = Depends(get_db)):
    return management.list_people(db)


@router.post("/people")
def create_person(payload: PersonCreate, db: Session = Depends(get_db)):
    return management.create_person(payload, db)


@router.put("/people/{person_id}")
def update_person(person_id: int, payload: PersonUpdate, db: Session = Depends(get_db)):
    return management.update_person(person_id, payload, db)


@router.delete("/people/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    return management.delete_person(person_id, db)


@router.get("/stay")
def list_stay_legacy(db: Session = Depends(get_db)):
    return management.list_stay(db)


@router.post("/stay")
def upsert_stay_legacy(payload: StayUpsert, db: Session = Depends(get_db)):
    return management.upsert_stay(payload, db)


@router.get("/stays")
def list_stays(db: Session = Depends(get_db)):
    return management.list_stay(db)


@router.get("/stays/risks")
def list_stay_risks(db: Session = Depends(get_db)):
    return management.list_stay_risks(db)


@router.get("/stays/{person_id}")
def get_stay(person_id: int, db: Session = Depends(get_db)):
    return management.get_stay(person_id, db)


@router.post("/stays/upsert")
def upsert_stay(payload: StayUpsert, db: Session = Depends(get_db)):
    return management.upsert_stay(payload, db)


@router.delete("/stays/{stay_id}")
def delete_stay(stay_id: int, db: Session = Depends(get_db)):
    return management.delete_stay(stay_id, db)


@router.get("/allocations")
def list_allocations(db: Session = Depends(get_db)):
    return management.list_allocations(db)


@router.post("/allocations")
def create_allocation(payload: AllocationCreate, db: Session = Depends(get_db)):
    return management.create_allocation(payload, db)


@router.put("/allocations/{allocation_id}")
def update_allocation(allocation_id: int, payload: AllocationUpdate, db: Session = Depends(get_db)):
    return management.update_allocation(allocation_id, payload, db)


@router.post("/allocations/{allocation_id}/checkout")
def checkout_allocation(allocation_id: int, payload: CheckoutRequest, db: Session = Depends(get_db)):
    return management.checkout_allocation(allocation_id, payload, db)


@router.delete("/allocations/{allocation_id}")
def delete_allocation(allocation_id: int, db: Session = Depends(get_db)):
    return management.delete_allocation(allocation_id, db)


@router.get("/rooms/available")
def list_available_rooms(
    dorm_id: int = Query(...),
    person_id: int = Query(...),
    db: Session = Depends(get_db),
):
    return management.list_available_rooms(dorm_id=dorm_id, person_id=person_id, db=db)


@router.get("/vehicles")
def list_vehicles(db: Session = Depends(get_db)):
    return management.list_vehicles(db)


@router.post("/vehicles")
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db)):
    return management.create_vehicle(payload, db)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return management.dashboard(db)


@router.get("/alerts")
def alerts(db: Session = Depends(get_db)):
    return management.alerts(db)
