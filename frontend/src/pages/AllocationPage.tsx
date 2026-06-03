import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import { fieldControlClass, FormField, primaryButtonClass } from "../components/FormField";
import type { Allocation, AvailableRoom, Dorm, Person, Room } from "../types";

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

export function AllocationPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedDormIds, setExpandedDormIds] = useState<Set<number>>(new Set());

  const [form, setForm] = useState({
    person_id: "",
    dorm_id: "",
    room_id: "",
    check_in_date: new Date().toISOString().slice(0, 10),
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
        dorm_id: f.dorm_id || String(d[0]?.id ?? ""),
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
  }, [form.person_id, form.dorm_id]);

  const dormMap = useMemo(() => new Map(dorms.map((dorm) => [dorm.id, dorm.name])), [dorms]);

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

  const roomOptions = availableRooms;

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
      rooms
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
    [dormMap, roomOccupantsByRoomId, rooms],
  );

  const dormGenderRows = useMemo<DormGenderRow[]>(
    () =>
      dorms.map((dorm) => {
        const dormRooms = rooms.filter((room) => room.dorm_id === dorm.id);
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
    [dorms, roomOccupantsByRoomId, rooms],
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

  useEffect(() => {
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
  }, [unassignedPeople]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api.createAllocation({
        person_id: Number(form.person_id),
        dorm_id: Number(form.dorm_id),
        room_id: Number(form.room_id),
        check_in_date: form.check_in_date,
        expected_check_out_date: form.expected_check_out_date || null,
        note: form.note.trim() || null,
      });

      setForm((f) => ({
        ...f,
        room_id: "",
        expected_check_out_date: "",
        note: "",
      }));

      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatOccupants = (occupants: Occupant[]) =>
    occupants.length
      ? occupants.map((occupant) => `${occupant.name} (${occupant.gender}, #${occupant.id})`).join("; ")
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
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">未分配房间人员</h3>
          <DataTable
            rows={unassignedPeople}
            rowKey={(row) => row.id}
            emptyText="暂无未分配房间人员"
            columns={[
              { header: "ID", cell: (row) => row.id },
              { header: "姓名", cell: (row) => `${row.chinese_name}/${row.english_name || "-"}` },
              { header: "部门", cell: (row) => row.department },
              { header: "性别", cell: (row) => row.gender },
              { header: "人员类型", cell: (row) => row.person_type },
            ]}
          />
        </div>
      )}

      {!loading ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">宿舍与可用房间</h3>

          {dormAvailabilityGroups.length === 0 ? (
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
                    {group.dormName} (#{group.id})
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
                      { header: "房间", cell: (row) => `${row.roomName} (#${row.id})` },
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
          >
            {unassignedPeople.length === 0 ? <option value="">暂无未分配房间人员</option> : null}

            {unassignedPeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.chinese_name}/{person.english_name || "-"} (#{person.id})
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
            {dorms.map((dorm) => (
              <option key={dorm.id} value={dorm.id}>
                {dorm.name} (#{dorm.id})
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
            {roomOptions.map((room) => (
              <option key={room.id} value={room.id}>
                {room.room_name} (#{room.id}) - 可用床位:{room.available_beds}
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
          {submitting ? "提交中..." : "新增入住记录"}
        </button>
      </form>

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
              <div>当前入住人数：{selectedRoom.active_occupancy}</div>
              <div>性别限制：{selectedRoom.gender_limit}</div>
              <div>当前人员：{formatOccupants(selectedRoomOccupants)}</div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">请选择可用房间</div>
          )}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
    </section>
  );
}