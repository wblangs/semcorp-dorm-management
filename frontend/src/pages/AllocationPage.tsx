import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import type { Allocation, AvailableRoom, Dorm, Person, Room } from "../types";

export function AllocationPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        person_id: f.person_id || String(p[0]?.id ?? ""),
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
          room_id: rooms.find((room) => String(room.id) === f.room_id) ? f.room_id : String(rooms[0]?.id ?? ""),
        }));
      })
      .catch((err: Error) => {
        setError(err.message);
        setAvailableRooms([]);
      });
  }, [form.person_id, form.dorm_id]);

  const selectedPerson = useMemo(
    () => people.find((person) => String(person.id) === form.person_id) ?? null,
    [people, form.person_id],
  );
  const selectedRoom = useMemo(
    () => availableRooms.find((room) => String(room.id) === form.room_id) ?? null,
    [availableRooms, form.room_id],
  );

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

  const personMap = new Map(
    people.map((person) => [person.id, `${person.chinese_name}/${person.english_name}`]),
  );
  const dormMap = new Map(dorms.map((dorm) => [dorm.id, dorm.name]));
  const roomMap = new Map(rooms.map((room) => [room.id, room.room_name]));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">入住分配</h2>
      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4"
      >
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.person_id} onChange={(e) => setForm((f) => ({ ...f, person_id: e.target.value }))} required>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.chinese_name}/{person.english_name} (#{person.id})
            </option>
          ))}
        </select>
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.dorm_id} onChange={(e) => setForm((f) => ({ ...f, dorm_id: e.target.value }))} required>
          {dorms.map((dorm) => (
            <option key={dorm.id} value={dorm.id}>
              {dorm.name} (#{dorm.id})
            </option>
          ))}
        </select>
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.room_id} onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value }))} required>
          {availableRooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.room_name} (#{room.id}) - 可用床位:{room.available_beds}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.check_in_date} onChange={(e) => setForm((f) => ({ ...f, check_in_date: e.target.value }))} required />
        <input
          className="rounded-lg border border-slate-300 px-3 py-2"
          type="date"
          value={form.expected_check_out_date}
          onChange={(e) => setForm((f) => ({ ...f, expected_check_out_date: e.target.value }))}
        />
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
          placeholder="备注"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
        <button
          className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700 md:col-span-4"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "提交中..." : "新增入住记录"}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">人员信息</h3>
          {selectedPerson ? (
            <div className="space-y-1 text-sm text-slate-700">
              <div>姓名：{selectedPerson.chinese_name}/{selectedPerson.english_name}</div>
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
            </div>
          ) : (
            <div className="text-sm text-slate-500">请选择可用房间</div>
          )}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <DataTable
          rows={allocations}
          rowKey={(row) => row.id}
          columns={[
            { header: "ID", cell: (row) => row.id },
            { header: "人员", cell: (row) => `${personMap.get(row.person_id) ?? "Unknown"} (#${row.person_id})` },
            { header: "宿舍", cell: (row) => `${dormMap.get(row.dorm_id) ?? "Unknown"} (#${row.dorm_id})` },
            { header: "房间", cell: (row) => `${roomMap.get(row.room_id) ?? "Unknown"} (#${row.room_id})` },
            { header: "入住日期", cell: (row) => row.check_in_date },
            { header: "预计退宿日期", cell: (row) => row.expected_check_out_date ?? "-" },
            { header: "实际退宿日期", cell: (row) => row.actual_check_out_date ?? row.check_out_date ?? "-" },
            { header: "备注", cell: (row) => row.note ?? "-" },
            {
              header: "状态",
              cell: (row) => (row.status === "active" ? "在住" : "已退宿"),
            },
            {
              header: "操作",
              cell: (row) =>
                row.status === "active" ? (
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                    onClick={async () => {
                      try {
                        await api.checkoutAllocation(row.id, new Date().toISOString().slice(0, 10));
                        await load();
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  >
                    退房
                  </button>
                ) : (
                  "-"
                ),
            },
          ]}
        />
      )}
    </section>
  );
}
