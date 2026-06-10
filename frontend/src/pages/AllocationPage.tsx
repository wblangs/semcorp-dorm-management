import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { deleteButtonClass, editButtonClass, fieldControlClass, FormField, primaryButtonClass, secondaryButtonClass } from "../components/FormField";
import type { Allocation, AvailableRoom, Dorm, Person, Room } from "../types";
import { todayISO } from "../utils/date";

type Occupant = {
  id: number;
  name: string;
  gender: Person["gender"];
};

type RoomAvailabilityRow = {
  id: number;
  dormId: number;
  dormName: string;
  roomName: string;
  bedCount: number;
  activeOccupancy: number;
  availableBeds: number;
  genderLimit: Room["gender_limit"];
  occupants: Occupant[];
};

type DormGenderRow = {
  id: number;
  dormName: string;
  genderStatus: "Empty" | "Mixed" | "Pure Male" | "Pure Female";
  maleCount: number;
  femaleCount: number;
  activeOccupancy: number;
  availableBeds: number;
};

type DormAvailabilityGroup = DormGenderRow & {
  rooms: RoomAvailabilityRow[];
};

const isActiveStatus = (status?: string | null) => (status ?? "").trim().toLowerCase() === "active";

export function AllocationPage() {
  const { canEdit } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedDormIds, setExpandedDormIds] = useState<Set<number>>(new Set());
  const [livingSearch, setLivingSearch] = useState("");
  const [checkoutSearch, setCheckoutSearch] = useState("");
  const [recordSectionsOpen, setRecordSectionsOpen] = useState({
    living: false,
    checkout: false,
  });
  const [topSectionsOpen, setTopSectionsOpen] = useState({
    unassigned: false,
    availability: false,
  });

  const [form, setForm] = useState({
    person_id: "",
    dorm_id: "",
    room_id: "",
    check_in_date: todayISO(),
    expected_check_out_date: "",
    note: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      const [a, p, d, r] = await Promise.all([
        api.getAllocations(),
        api.getPeople(),
        api.getDorms(),
        api.getRooms(),
      ]);
      setAllocations(a);
      setPeople(p);
      setDorms(d);
      setRooms(r);
      setForm((f) => ({
        ...f,
        dorm_id:
          f.dorm_id && d.some((dorm) => String(dorm.id) === f.dorm_id && isActiveStatus(dorm.status))
            ? f.dorm_id
            : String(d.find((dorm) => isActiveStatus(dorm.status))?.id ?? ""),
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const personId = Number(form.person_id);
    const dormId = Number(form.dorm_id);

    if (!personId || !dormId) {
      setAvailableRooms([]);
      setForm((f) => ({ ...f, room_id: "" }));
      return;
    }
    if (editingId) return;

    api
      .getAvailableRooms(dormId, personId)
      .then((rooms) => {
        setAvailableRooms(rooms);
        setForm((f) => ({
          ...f,
          room_id: rooms.find((room) => String(room.id) === f.room_id)
            ? f.room_id
            : String(rooms[0]?.id ?? ""),
        }));
      })
      .catch((err: Error) => {
        setError(err.message);
        setAvailableRooms([]);
      });
  }, [editingId, form.person_id, form.dorm_id]);

  const personMap = useMemo(
    () => new Map(people.map((person) => [person.id, `${person.chinese_name}/${person.english_name || "-"}`])),
    [people],
  );
  const dormMap = useMemo(() => new Map(dorms.map((dorm) => [dorm.id, dorm.name])), [dorms]);
  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room.room_name])), [rooms]);
  const activeDorms = useMemo(() => dorms.filter((dorm) => isActiveStatus(dorm.status)), [dorms]);
  const activeDormIds = useMemo(() => new Set(activeDorms.map((dorm) => dorm.id)), [activeDorms]);
  const activeRooms = useMemo(
    () => rooms.filter((room) => activeDormIds.has(room.dorm_id) && isActiveStatus(room.status)),
    [activeDormIds, rooms],
  );

  const selectedPerson = useMemo(
    () => people.find((person) => String(person.id) === form.person_id) ?? null,
    [people, form.person_id],
  );

  const activeAllocatedPersonIds = useMemo(
    () =>
      new Set(
        allocations
          .filter((allocation) => allocation.status === "active")
          .map((allocation) => allocation.person_id),
      ),
    [allocations],
  );

  const unassignedPeople = useMemo(
    () => people.filter((person) => !activeAllocatedPersonIds.has(person.id)),
    [activeAllocatedPersonIds, people],
  );
  const assignablePeople = useMemo(() => {
    if (!editingId) return unassignedPeople;
    const currentPerson = people.find((person) => String(person.id) === form.person_id);
    if (!currentPerson || unassignedPeople.some((person) => person.id === currentPerson.id)) {
      return unassignedPeople;
    }
    return [currentPerson, ...unassignedPeople];
  }, [editingId, form.person_id, people, unassignedPeople]);

  const dormOptions = useMemo(() => {
    if (!editingId) return activeDorms;
    const currentDorm = dorms.find((dorm) => String(dorm.id) === form.dorm_id);
    if (!currentDorm || activeDorms.some((dorm) => dorm.id === currentDorm.id)) {
      return activeDorms;
    }
    return [currentDorm, ...activeDorms];
  }, [activeDorms, dorms, editingId, form.dorm_id]);

  const roomOptions = useMemo(() => {
    if (!editingId) return availableRooms;
    // When changing a person's room, show only rooms with an open bed and a
    // matching gender limit (same idea as new-person assignment), plus the room
    // they currently occupy so it stays selectable.
    const person = people.find((p) => String(p.id) === form.person_id);
    return rooms.filter((room) => {
      if (String(room.dorm_id) !== form.dorm_id) return false;
      if (String(room.id) === form.room_id) return true;
      if (!isActiveStatus(room.status)) return false;
      if (person && room.gender_limit !== "Any" && room.gender_limit !== person.gender) return false;
      const occupancy = allocations.filter(
        (allocation) =>
          allocation.status === "active" && allocation.room_id === room.id && allocation.id !== editingId,
      ).length;
      return room.bed_count - occupancy > 0;
    });
  }, [allocations, availableRooms, editingId, form.dorm_id, form.person_id, form.room_id, people, rooms]);

  // In edit mode, if the selected room is no longer a valid option (e.g. the dorm
  // was changed), reset to the first available room so room_id can't point at a
  // room from another dorm (which the backend rejects as "房间不属于该宿舍").
  useEffect(() => {
    if (!editingId) return;
    if (roomOptions.some((room) => String(room.id) === form.room_id)) return;
    setForm((f) => ({ ...f, room_id: String(roomOptions[0]?.id ?? "") }));
  }, [editingId, roomOptions, form.room_id]);

  const selectedRoom = useMemo(
    () => roomOptions.find((room) => String(room.id) === form.room_id) ?? null,
    [form.room_id, roomOptions],
  );

  const activeAllocations = useMemo(
    () => allocations.filter((allocation) => allocation.status === "active"),
    [allocations],
  );

  const personById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const roomOccupantsByRoomId = useMemo(() => {
    const grouped = new Map<number, Occupant[]>();

    activeAllocations.forEach((allocation) => {
      const person = personById.get(allocation.person_id);
      if (!person) return;

      const occupant = {
        id: person.id,
        name: `${person.chinese_name}/${person.english_name || "-"}`,
        gender: person.gender,
      };

      grouped.set(allocation.room_id, [...(grouped.get(allocation.room_id) ?? []), occupant]);
    });

    return grouped;
  }, [activeAllocations, personById]);

  const roomAvailabilityRows = useMemo<RoomAvailabilityRow[]>(
    () =>
      activeRooms
        .map((room) => {
          const occupants = roomOccupantsByRoomId.get(room.id) ?? [];
          return {
            id: room.id,
            dormId: room.dorm_id,
            dormName: dormMap.get(room.dorm_id) ?? "Unknown",
            roomName: room.room_name,
            bedCount: room.bed_count,
            activeOccupancy: occupants.length,
            availableBeds: Math.max(room.bed_count - occupants.length, 0),
            genderLimit: room.gender_limit,
            occupants,
          };
        })
        .filter((room) => room.availableBeds > 0),
    [activeRooms, dormMap, roomOccupantsByRoomId],
  );

  const dormGenderRows = useMemo<DormGenderRow[]>(
    () =>
      activeDorms.map((dorm) => {
        const dormRooms = activeRooms.filter((room) => room.dorm_id === dorm.id);
        const occupants = dormRooms.flatMap((room) => roomOccupantsByRoomId.get(room.id) ?? []);

        const genders = new Set(occupants.map((occupant) => occupant.gender));
        const maleCount = occupants.filter((occupant) => occupant.gender === "Male").length;
        const femaleCount = occupants.filter((occupant) => occupant.gender === "Female").length;

        const availableBeds = dormRooms.reduce(
          (total, room) =>
            total + Math.max(room.bed_count - (roomOccupantsByRoomId.get(room.id)?.length ?? 0), 0),
          0,
        );

        const genderStatus =
          genders.size === 0
            ? "Empty"
            : genders.has("Male") && genders.has("Female")
              ? "Mixed"
              : genders.has("Male")
                ? "Pure Male"
                : "Pure Female";

        return {
          id: dorm.id,
          dormName: dorm.name,
          genderStatus,
          maleCount,
          femaleCount,
          activeOccupancy: occupants.length,
          availableBeds,
        };
      }),
    [activeDorms, activeRooms, roomOccupantsByRoomId],
  );

  const dormAvailabilityGroups = useMemo<DormAvailabilityGroup[]>(
    () =>
      dormGenderRows.map((dorm) => ({
        ...dorm,
        rooms: roomAvailabilityRows.filter((room) => room.dormId === dorm.id),
      })),
    [dormGenderRows, roomAvailabilityRows],
  );

  const selectedRoomOccupants = useMemo(
    () => (selectedRoom ? roomOccupantsByRoomId.get(selectedRoom.id) ?? [] : []),
    [roomOccupantsByRoomId, selectedRoom],
  );
  const livingAllocations = useMemo(
    () => allocations.filter((allocation) => allocation.status === "active"),
    [allocations],
  );
  const checkedOutAllocations = useMemo(
    () => allocations.filter((allocation) => allocation.status === "checked_out"),
    [allocations],
  );
  const filterAllocationsByKeyword = (source: Allocation[], search: string) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return source;
    return source.filter((allocation) =>
      [
        allocation.id,
        allocation.person_id,
        personMap.get(allocation.person_id),
        allocation.dorm_id,
        dormMap.get(allocation.dorm_id),
        allocation.room_id,
        roomMap.get(allocation.room_id),
        allocation.check_in_date,
        allocation.expected_check_out_date,
        allocation.actual_check_out_date,
        allocation.check_out_date,
        allocation.note,
        "已退宿",
        "在住",
        allocation.status,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  };
  const filteredLivingAllocations = useMemo(
    () => filterAllocationsByKeyword(livingAllocations, livingSearch),
    [dormMap, livingAllocations, livingSearch, personMap, roomMap],
  );
  const filteredCheckedOutAllocations = useMemo(
    () => filterAllocationsByKeyword(checkedOutAllocations, checkoutSearch),
    [checkedOutAllocations, checkoutSearch, dormMap, personMap, roomMap],
  );

  useEffect(() => {
    if (editingId) return;
    setForm((f) => {
      if (f.person_id && unassignedPeople.some((person) => String(person.id) === f.person_id)) {
        return f;
      }

      return {
        ...f,
        person_id: String(unassignedPeople[0]?.id ?? ""),
        room_id: "",
      };
    });
  }, [editingId, unassignedPeople]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload = {
        dorm_id: Number(form.dorm_id),
        room_id: Number(form.room_id),
        check_in_date: form.check_in_date,
        expected_check_out_date: form.expected_check_out_date || null,
        note: form.note.trim() || null,
      };
      if (editingId) {
        await api.updateAllocation(editingId, payload);
      } else {
        await api.createAllocation({
          ...payload,
          person_id: Number(form.person_id),
        });
      }

      setForm((f) => ({
        ...f,
        room_id: "",
        expected_check_out_date: "",
        note: "",
      }));
      setEditingId(null);

      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDeletePrevious = async (row: Allocation) => {
    if (!confirm("确认从分配页面删除该历史记录？管理员备份记录仍会保留。")) return;
    setError("");
    try {
      await api.deleteAllocation(row.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onEdit = (row: Allocation) => {
    if (row.status !== "active") return;
    setEditingId(row.id);
    setForm({
      person_id: String(row.person_id),
      dorm_id: String(row.dorm_id),
      room_id: String(row.room_id),
      check_in_date: row.check_in_date,
      expected_check_out_date: row.expected_check_out_date ?? "",
      note: row.note ?? "",
    });
  };

  const onCheckout = async (row: Allocation) => {
    setError("");
    try {
      await api.checkoutAllocation(row.id, todayISO());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const formatOccupants = (occupants: Occupant[]) =>
    occupants.length
      ? occupants.map((occupant) => `${occupant.name} (${occupant.gender})`).join("; ")
      : "Empty";

  const toggleDorm = (dormId: number) => {
    setExpandedDormIds((current) => {
      const next = new Set(current);
      if (next.has(dormId)) {
        next.delete(dormId);
      } else {
        next.add(dormId);
      }
      return next;
    });
  };
  const toggleRecordSection = (section: "living" | "checkout") => {
    setRecordSectionsOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };
  const toggleTopSection = (section: "unassigned" | "availability") => {
    setTopSectionsOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const renderDormMixChart = (group: DormAvailabilityGroup) => {
    const totalBeds = group.maleCount + group.femaleCount + group.availableBeds;
    const malePercent = totalBeds ? (group.maleCount / totalBeds) * 100 : 0;
    const femalePercent = totalBeds ? (group.femaleCount / totalBeds) * 100 : 0;
    const emptyPercent = totalBeds ? (group.availableBeds / totalBeds) * 100 : 0;
    const femaleStop = malePercent + femalePercent;

    const background = totalBeds
      ? `conic-gradient(#2563eb 0 ${malePercent}%, #db2777 ${malePercent}% ${femaleStop}%, #cbd5e1 ${femaleStop}% 100%)`
      : "#e2e8f0";

    return (
      <span
        aria-label={`Male ${Math.round(malePercent)}%, Female ${Math.round(femalePercent)}%, Empty ${Math.round(emptyPercent)}%`}
        className="inline-block rounded-full border border-white shadow-sm"
        style={{ width: "1em", height: "1em", background }}
        title={`Male ${Math.round(malePercent)}%, Female ${Math.round(femalePercent)}%, Empty ${Math.round(emptyPercent)}%`}
      />
    );
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">入住分配</h2>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载未分配人员中...</div>
      ) : (
        <section className="space-y-2">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50"
            onClick={() => toggleTopSection("unassigned")}
          >
            <span className="font-semibold text-slate-900">未分配房间人员</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{unassignedPeople.length}</span>
            <span className="ml-auto font-medium text-slate-700">{topSectionsOpen.unassigned ? "收起" : "展开"}</span>
          </button>
          {topSectionsOpen.unassigned ? (
            <DataTable
              rows={unassignedPeople}
              rowKey={(row) => row.id}
              emptyText="暂无未分配房间人员"
              columns={[
                { header: "姓名", cell: (row) => `${row.chinese_name}/${row.english_name || "-"}` },
                { header: "部门", cell: (row) => row.department },
                { header: "性别", cell: (row) => row.gender },
                { header: "人员类型", cell: (row) => row.person_type },
              ]}
            />
          ) : null}
        </section>
      )}

      {!loading ? (
        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50"
            onClick={() => toggleTopSection("availability")}
          >
            <span className="font-semibold text-slate-900">宿舍与可用房间</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{dormAvailabilityGroups.length}</span>
            <span className="ml-auto font-medium text-slate-700">{topSectionsOpen.availability ? "收起" : "展开"}</span>
          </button>

          {!topSectionsOpen.availability ? null : dormAvailabilityGroups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">暂无宿舍</div>
          ) : (
            dormAvailabilityGroups.map((group) => (
              <section key={group.id} className="space-y-2">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50"
                  onClick={() => toggleDorm(group.id)}
                >
                  <span className="font-semibold text-slate-900">
                    {group.dormName}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                    {group.genderStatus}
                    {renderDormMixChart(group)}
                  </span>

                  <span className="text-slate-600">在住人数：{group.activeOccupancy}</span>
                  <span className="text-slate-600">空床位：{group.availableBeds}</span>

                  <span className="ml-auto font-medium text-slate-700">
                    {expandedDormIds.has(group.id) ? "收起房间" : "展开房间"}
                  </span>
                </button>

                {expandedDormIds.has(group.id) ? (
                  <DataTable
                    rows={group.rooms}
                    rowKey={(row) => row.id}
                    emptyText="该宿舍暂无有空床位房间"
                    columns={[
                      { header: "房间", cell: (row) => row.roomName },
                      { header: "床位", cell: (row) => row.bedCount },
                      { header: "在住", cell: (row) => row.activeOccupancy },
                      { header: "空床位", cell: (row) => row.availableBeds },
                      { header: "性别限制", cell: (row) => row.genderLimit },
                      { header: "当前人员", cell: (row) => formatOccupants(row.occupants) },
                    ]}
                  />
                ) : null}
              </section>
            ))
          )}
        </div>
      ) : null}

      {canEdit ? (
      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4"
      >
        <FormField label="人员" required>
          <select
            className={fieldControlClass}
            value={form.person_id}
            onChange={(e) => setForm((f) => ({ ...f, person_id: e.target.value }))}
            required
            disabled={Boolean(editingId)}
          >
            {assignablePeople.length === 0 ? <option value="">暂无未分配房间人员</option> : null}

            {assignablePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.chinese_name}/{person.english_name || "-"}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="宿舍" required>
          <select
            className={fieldControlClass}
            value={form.dorm_id}
            onChange={(e) => setForm((f) => ({ ...f, dorm_id: e.target.value }))}
            required
          >
            {dormOptions.length === 0 ? <option value="">暂无 active 宿舍</option> : null}

            {dormOptions.map((dorm) => (
              <option key={dorm.id} value={dorm.id}>
                {dorm.name}
                {isActiveStatus(dorm.status) ? "" : " - inactive"}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="房间" required>
          <select
            className={fieldControlClass}
            value={form.room_id}
            onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value }))}
            required
          >
            {roomOptions.length === 0 ? <option value="">暂无可分配房间</option> : null}

            {roomOptions.map((room) => (
              <option key={room.id} value={room.id}>
                {room.room_name}
                {"available_beds" in room ? ` - 可用床位:${room.available_beds}` : ""}
                {isActiveStatus(room.status) ? "" : " - inactive"}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="入住日期" required>
          <input
            className={fieldControlClass}
            type="date"
            value={form.check_in_date}
            onChange={(e) => setForm((f) => ({ ...f, check_in_date: e.target.value }))}
            required
          />
        </FormField>

        <FormField label="预计退宿日期">
          <input
            className={fieldControlClass}
            type="date"
            value={form.expected_check_out_date}
            onChange={(e) => setForm((f) => ({ ...f, expected_check_out_date: e.target.value }))}
          />
        </FormField>

        <FormField label="备注" className="md:col-span-2">
          <input
            className={fieldControlClass}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </FormField>

        <button
          className={`${primaryButtonClass} md:col-span-4`}
          type="submit"
          disabled={submitting || !form.person_id || !form.room_id}
        >
          {submitting ? "提交中..." : editingId ? "保存入住记录" : "新增入住记录"}
        </button>
        {editingId ? (
          <button
            className={`${secondaryButtonClass} md:col-span-4`}
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm((f) => ({
                ...f,
                person_id: String(unassignedPeople[0]?.id ?? ""),
                room_id: "",
                expected_check_out_date: "",
                note: "",
              }));
            }}
          >
            取消编辑
          </button>
        ) : null}
      </form>
      ) : null}

      {canEdit ? (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">人员信息</h3>

          {selectedPerson ? (
            <div className="space-y-1 text-sm text-slate-700">
              <div>
                姓名：{selectedPerson.chinese_name}/{selectedPerson.english_name || "-"}
              </div>
              <div>部门：{selectedPerson.department}</div>
              <div>性别：{selectedPerson.gender}</div>
              <div>人员类型：{selectedPerson.person_type}</div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">请选择人员</div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">房间信息</h3>

          {selectedRoom ? (
            <div className="space-y-1 text-sm text-slate-700">
              <div>床位数：{selectedRoom.bed_count}</div>
              <div>
                当前入住人数：
                {"active_occupancy" in selectedRoom
                  ? (selectedRoom as AvailableRoom).active_occupancy
                  : (roomOccupantsByRoomId.get(selectedRoom.id)?.length ?? 0)}
              </div>
              <div>性别限制：{selectedRoom.gender_limit}</div>
              <div>当前人员：{formatOccupants(selectedRoomOccupants)}</div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">请选择可用房间</div>
          )}
        </div>
      </div>
      ) : null}

      {!loading ? (
        <div className="space-y-3">
          <section className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50"
              onClick={() => toggleRecordSection("living")}
            >
              <span className="font-semibold text-slate-900">当前在住记录</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{livingAllocations.length}</span>
              <span className="ml-auto font-medium text-slate-700">
                {recordSectionsOpen.living ? "收起记录" : "展开记录"}
              </span>
            </button>
            {recordSectionsOpen.living ? (
              <div className="space-y-2">
                <input
                  className={fieldControlClass}
                  value={livingSearch}
                  onChange={(event) => setLivingSearch(event.target.value)}
                  placeholder="搜索当前在住记录"
                />
                <DataTable
                  rows={filteredLivingAllocations}
                  rowKey={(row) => row.id}
                  emptyText="没有匹配记录"
                  columns={[
                    { header: "人员", cell: (row) => personMap.get(row.person_id) ?? "Unknown" },
                    { header: "宿舍", cell: (row) => dormMap.get(row.dorm_id) ?? "Unknown" },
                    { header: "房间", cell: (row) => roomMap.get(row.room_id) ?? "Unknown" },
                    { header: "入住日期", cell: (row) => row.check_in_date },
                    { header: "预计退宿日期", cell: (row) => row.expected_check_out_date ?? "-" },
                    { header: "备注", cell: (row) => row.note ?? "-" },
                    { header: "状态", cell: () => "在住" },
                    {
                      header: "操作",
                      cell: (row) =>
                        canEdit ? (
                          <div className="flex gap-2">
                            <button className={editButtonClass} type="button" onClick={() => onEdit(row)}>
                              修改
                            </button>
                            <button className={editButtonClass} type="button" onClick={() => void onCheckout(row)}>
                              退房
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        ),
                    },
                  ]}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50"
              onClick={() => toggleRecordSection("checkout")}
            >
              <span className="font-semibold text-slate-900">已退宿记录</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{checkedOutAllocations.length}</span>
              <span className="ml-auto font-medium text-slate-700">
                {recordSectionsOpen.checkout ? "收起记录" : "展开记录"}
              </span>
            </button>
            {recordSectionsOpen.checkout ? (
              <div className="space-y-2">
                <input
                  className={fieldControlClass}
                  value={checkoutSearch}
                  onChange={(event) => setCheckoutSearch(event.target.value)}
                  placeholder="搜索已退宿记录"
                />
                <DataTable
                  rows={filteredCheckedOutAllocations}
                  rowKey={(row) => row.id}
                  emptyText="没有匹配记录"
                  columns={[
                    { header: "人员", cell: (row) => personMap.get(row.person_id) ?? "Unknown" },
                    { header: "宿舍", cell: (row) => dormMap.get(row.dorm_id) ?? "Unknown" },
                    { header: "房间", cell: (row) => roomMap.get(row.room_id) ?? "Unknown" },
                    { header: "入住日期", cell: (row) => row.check_in_date },
                    { header: "预计退宿日期", cell: (row) => row.expected_check_out_date ?? "-" },
                    { header: "实际退宿日期", cell: (row) => row.actual_check_out_date ?? row.check_out_date ?? "-" },
                    { header: "备注", cell: (row) => row.note ?? "-" },
                    { header: "状态", cell: () => "已退宿" },
                    {
                      header: "操作",
                      cell: (row) =>
                        canEdit ? (
                          <button className={deleteButtonClass} type="button" onClick={() => void onDeletePrevious(row)}>
                            删除
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        ),
                    },
                  ]}
                />
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
    </section>
  );
}
