from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_admin, require_editor
from backend.database.session import get_db
from backend.models import User
from backend.schemas import (
    AllocationCreate,
    AllocationUpdate,
    CheckoutRequest,
    DictionaryReplace,
    DingTalkLoginRequest,
    DormCreate,
    DormUpdate,
    LoginRequest,
    PersonCreate,
    PersonUpdate,
    RoomCreate,
    RoomUpdate,
    RoomItemCreate,
    RoomItemUpdate,
    StayUpsert,
    UserCreate,
    UserPasswordReset,
    UserUpdate,
    VehicleCreate,
    VehicleUpdate,
)
from backend.services import management

router = APIRouter(prefix="/api")


@router.post("/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return management.login(payload.username, payload.password, db)


@router.get("/auth/dingtalk-config")
def dingtalk_config():
    from backend.core.config import settings
    from backend.services.dingtalk import is_configured

    return {"enabled": is_configured(), "corp_id": settings.dingtalk_corp_id if is_configured() else ""}


@router.post("/auth/dingtalk-login")
def dingtalk_login(payload: DingTalkLoginRequest, db: Session = Depends(get_db)):
    return management.dingtalk_login(payload.auth_code, db)


@router.post("/auth/logout")
def logout(current_user: User = Depends(get_current_user)):
    _ = current_user
    return {"ok": True}


@router.get("/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return management.serialize_user(current_user)


@router.get("/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    _ = current_user
    return management.list_users(db)


@router.post("/users")
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return management.create_user(payload, db, operator=current_user.username)


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return management.update_user(user_id, payload, db, operator=current_user.username)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return management.delete_user(user_id, db, operator=current_user.username, operator_id=current_user.id)


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    payload: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return management.reset_user_password(user_id, payload, db, operator=current_user.username)


@router.get("/system")
def system_info(current_user: User = Depends(require_admin)):
    return management.system_info(current_user)


@router.get("/dorms")
def list_dorms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.list_dorms(db)


@router.post("/dorms")
def create_dorm(payload: DormCreate, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.create_dorm(payload, db, operator=current_user.username)


@router.put("/dorms/{dorm_id}")
def update_dorm(
    dorm_id: int,
    payload: DormUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.update_dorm(dorm_id, payload, db, operator=current_user.username)


@router.delete("/dorms/{dorm_id}")
def delete_dorm(dorm_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.delete_dorm(dorm_id, db, operator=current_user.username)


@router.get("/dictionaries")
def list_dictionaries(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.list_dictionaries(db)


@router.put("/dictionaries/{key}")
def replace_dictionary(
    key: str,
    payload: DictionaryReplace,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return management.replace_dictionary(key, payload, db, operator=current_user.username)


@router.get("/audit-logs")
def list_audit_logs(
    entity_type: Optional[str] = Query(default=None),
    entity_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    _ = current_user
    return management.list_audit_logs(db, entity_type=entity_type, entity_id=entity_id)


@router.get("/rooms")
def list_rooms(
    dorm_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return management.list_rooms(dorm_id, db)


@router.post("/rooms")
def create_room(payload: RoomCreate, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.create_room(payload, db, operator=current_user.username)


@router.put("/rooms/{room_id}")
def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.update_room(room_id, payload, db, operator=current_user.username)


@router.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.delete_room(room_id, db, operator=current_user.username)


@router.get("/room-items")
def list_room_items(
    room_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return management.list_room_items(db, room_id)


@router.post("/room-items")
def create_room_item(payload: RoomItemCreate, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.create_room_item(payload, db, operator=current_user.username)


@router.put("/room-items/{item_id}")
def update_room_item(
    item_id: int,
    payload: RoomItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.update_room_item(item_id, payload, db, operator=current_user.username)


@router.delete("/room-items/{item_id}")
def delete_room_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.delete_room_item(item_id, db, operator=current_user.username)


@router.get("/people")
def list_people(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.list_people(db)


@router.post("/people")
def create_person(payload: PersonCreate, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.create_person(payload, db, operator=current_user.username)


@router.put("/people/{person_id}")
def update_person(
    person_id: int,
    payload: PersonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.update_person(person_id, payload, db, operator=current_user.username)


@router.delete("/people/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.delete_person(person_id, db, operator=current_user.username)


@router.get("/stay")
def list_stay_legacy(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.list_stay(db)


@router.post("/stay")
def upsert_stay_legacy(
    payload: StayUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.upsert_stay(payload, db, operator=current_user.username)


@router.get("/stays")
def list_stays(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.list_stay(db)


@router.get("/stays/risks")
def list_stay_risks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.list_stay_risks(db)


@router.get("/stays/{person_id}")
def get_stay(person_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.get_stay(person_id, db)


@router.post("/stays/upsert")
def upsert_stay(payload: StayUpsert, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.upsert_stay(payload, db, operator=current_user.username)


@router.delete("/stays/{stay_id}")
def delete_stay(stay_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.delete_stay(stay_id, db, operator=current_user.username)


@router.get("/allocations")
def list_allocations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.list_allocations(db)


@router.get("/allocations/backup")
def list_allocation_backup_history(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    _ = current_user
    return management.list_allocation_backup_history(db)


@router.post("/allocations")
def create_allocation(
    payload: AllocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.create_allocation(payload, db, operator=current_user.username)


@router.put("/allocations/{allocation_id}")
def update_allocation(
    allocation_id: int,
    payload: AllocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.update_allocation(allocation_id, payload, db, operator=current_user.username)


@router.post("/allocations/{allocation_id}/checkout")
def checkout_allocation(
    allocation_id: int,
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.checkout_allocation(allocation_id, payload, db, operator=current_user.username)


@router.delete("/allocations/{allocation_id}")
def delete_allocation(
    allocation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.hide_allocation_from_user_history(allocation_id, db, operator=current_user.username)


@router.delete("/allocations/backup/{allocation_id}")
def delete_allocation_backup(
    allocation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return management.delete_allocation_backup(allocation_id, db, operator=current_user.username)


@router.post("/allocations/backup/{allocation_id}/recover")
def recover_allocation_user_history(
    allocation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return management.recover_allocation_user_history(allocation_id, db, operator=current_user.username)


@router.get("/rooms/available")
def list_available_rooms(
    dorm_id: int = Query(...),
    person_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return management.list_available_rooms(dorm_id=dorm_id, person_id=person_id, db=db)


@router.get("/vehicles")
def list_vehicles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.list_vehicles(db)


@router.post("/vehicles")
def create_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.create_vehicle(payload, db, operator=current_user.username)


@router.put("/vehicles/{vehicle_id}")
def update_vehicle(
    vehicle_id: int,
    payload: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    return management.update_vehicle(vehicle_id, payload, db, operator=current_user.username)


@router.delete("/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_editor)):
    return management.delete_vehicle(vehicle_id, db, operator=current_user.username)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.dashboard(db)


@router.get("/alerts")
def alerts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ = current_user
    return management.alerts(db)
