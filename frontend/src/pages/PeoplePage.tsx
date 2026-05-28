import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import type { Person } from "../types";

const emptyForm = {
  chinese_name: "",
  english_name: "",
  department: "",
  person_type: "",
  gender: "Male" as const,
  can_drive: false,
  can_be_driver: false,
};

export function PeoplePage() {
  const [rows, setRows] = useState<Person[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      setRows(await api.getPeople());
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
    try {
      await api.createPerson(form);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">人员管理</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="中文名" value={form.chinese_name} onChange={(e) => setForm((f) => ({ ...f, chinese_name: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="英文名" value={form.english_name} onChange={(e) => setForm((f) => ({ ...f, english_name: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="部门" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="人员类型" value={form.person_type} onChange={(e) => setForm((f) => ({ ...f, person_type: e.target.value }))} required />
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as "Male" | "Female" }))}>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <button className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700" type="submit">新增人员</button>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.can_drive} onChange={(e) => setForm((f) => ({ ...f, can_drive: e.target.checked }))} />
          可驾驶
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.can_be_driver} onChange={(e) => setForm((f) => ({ ...f, can_be_driver: e.target.checked }))} />
          可做司机
        </label>
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
            { header: "中文名", cell: (row) => row.chinese_name },
            { header: "英文名", cell: (row) => row.english_name },
            { header: "部门", cell: (row) => row.department },
            { header: "类型", cell: (row) => row.person_type },
            { header: "性别", cell: (row) => row.gender },
            { header: "可驾驶", cell: (row) => (row.can_drive ? "是" : "否") },
            { header: "可做司机", cell: (row) => (row.can_be_driver ? "是" : "否") },
          ]}
        />
      )}
    </section>
  );
}
