from datetime import date, datetime
from typing import Literal, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampSoftDeleteMixin


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

    dorm: Mapped["Dorm"] = relationship(back_populates="rooms")
    allocations: Mapped[list["Allocation"]] = relationship(back_populates="room")


class Person(TimestampSoftDeleteMixin, Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chinese_name: Mapped[str] = mapped_column(String(50), nullable=False)
    english_name: Mapped[str] = mapped_column(String(50), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    person_type: Mapped[str] = mapped_column(String(50), nullable=False)
    gender: Mapped[Literal["Male", "Female"]] = mapped_column(String(10), nullable=False)
    can_drive: Mapped[bool] = mapped_column(default=False)
    can_be_driver: Mapped[bool] = mapped_column(default=False)

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
    status: Mapped[Literal["active", "checked_out"]] = mapped_column(String(20), default="active")

    person: Mapped["Person"] = relationship(back_populates="allocations")
    room: Mapped["Room"] = relationship(back_populates="allocations")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plate_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="available")


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
