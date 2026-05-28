import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import type { Dorm, Room } from "../types";

const emptyForm = {
  dorm_id: "",
  room_name: "",
  room_type: "",
  bed_count: 1,
  gender_limit: "Any" as const,
  status: "active",
};

export function RoomsPage() {
  const [rows, setRows] = useState<Room[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      setLoading(true);
      const [roomData, dormData] = await Promise.all([api.getRooms(), api.getDorms()]);
      setRows(roomData);
      setDorms(dormData);
      if (!form.dorm_id && dormData[0]) {
        setForm((f) => ({ ...f, dorm_id: String(dormData[0].id) }));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.dorm_id) return;
    try {
      await api.createRoom({
        ...form,
        dorm_id: Number(form.dorm_id),
      });
      setForm((f) => ({ ...emptyForm, dorm_id: f.dorm_id }));
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const dormMap = new Map(dorms.map((dorm) => [dorm.id, dorm.name]));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">房间管理</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.dorm_id} onChange={(e) => setForm((f) => ({ ...f, dorm_id: e.target.value }))} required>
          <option value="">选择宿舍</option>
          {dorms.map((dorm) => (
            <option key={dorm.id} value={dorm.id}>
              {dorm.name} (#{dorm.id})
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="房间名" value={form.room_name} onChange={(e) => setForm((f) => ({ ...f, room_name: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="房间类型" value={form.room_type} onChange={(e) => setForm((f) => ({ ...f, room_type: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" type="number" min={1} value={form.bed_count} onChange={(e) => setForm((f) => ({ ...f, bed_count: Number(e.target.value) }))} required />
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.gender_limit} onChange={(e) => setForm((f) => ({ ...f, gender_limit: e.target.value as "Male" | "Female" | "Any" }))}>
          <option value="Any">Any</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <button className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700" type="submit">新增房间</button>
      </form>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { header: "ID", cell: (row) => row.id },
            { header: "宿舍", cell: (row) => `${dormMap.get(row.dorm_id) ?? "Unknown"} (#${row.dorm_id})` },
            { header: "房间名", cell: (row) => row.room_name },
            { header: "类型", cell: (row) => row.room_type },
            { header: "床位", cell: (row) => row.bed_count },
            { header: "性别限制", cell: (row) => row.gender_limit },
            { header: "状态", cell: (row) => row.status },
          ]}
        />
      )}
    </section>
  );
}
