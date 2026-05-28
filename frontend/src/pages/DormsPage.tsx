import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import type { Dorm } from "../types";

const emptyForm = {
  name: "",
  type: "",
  address: "",
  lease_start_date: "",
  lease_end_date: "",
  status: "active",
};

export function DormsPage() {
  const [rows, setRows] = useState<Dorm[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      setLoading(true);
      setRows(await api.getDorms());
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
    setError("");
    try {
      await api.createDorm({
        ...form,
        lease_start_date: form.lease_start_date || null,
        lease_end_date: form.lease_end_date || null,
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">宿舍管理</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="名称" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="类型" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="地址" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.lease_start_date} onChange={(e) => setForm((f) => ({ ...f, lease_start_date: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.lease_end_date} onChange={(e) => setForm((f) => ({ ...f, lease_end_date: e.target.value }))} />
        <button className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700" type="submit">新增宿舍</button>
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
            { header: "名称", cell: (row) => row.name },
            { header: "类型", cell: (row) => row.type },
            { header: "地址", cell: (row) => row.address },
            { header: "租期开始", cell: (row) => row.lease_start_date ?? "-" },
            { header: "租期结束", cell: (row) => row.lease_end_date ?? "-" },
            { header: "状态", cell: (row) => row.status },
          ]}
        />
      )}
    </section>
  );
}
