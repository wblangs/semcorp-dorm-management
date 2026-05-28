import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Dorm } from "../types";

type DormFormState = {
  name: string;
  type: string;
  address: string;
  lease_start_date: string;
  lease_end_date: string;
  status: string;
};

const emptyForm: DormFormState = {
  name: "",
  type: "House",
  address: "",
  lease_start_date: "",
  lease_end_date: "",
  status: "active",
};

export function DormsPage() {
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<Dorm[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DormFormState>(emptyForm);

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
      const payload = {
        ...form,
        lease_start_date: form.lease_start_date || null,
        lease_end_date: form.lease_end_date || null,
      };
      if (editingId) {
        await api.updateDorm(editingId, payload);
      } else {
        await api.createDorm(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onEdit = (row: Dorm) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      type: row.type,
      address: row.address,
      lease_start_date: row.lease_start_date ?? "",
      lease_end_date: row.lease_end_date ?? "",
      status: row.status,
    });
  };

  const onDelete = async (row: Dorm) => {
    if (!confirm(`确认删除宿舍 ${row.name}？关联房间也会一并删除。`)) return;
    setError("");
    try {
      await api.deleteDorm(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
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
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} required>
          {dictionaries.dormTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="地址" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} required />
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>租期开始日期</span>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" type="date" value={form.lease_start_date} onChange={(e) => setForm((f) => ({ ...f, lease_start_date: e.target.value }))} />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>租期结束日期</span>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" type="date" value={form.lease_end_date} onChange={(e) => setForm((f) => ({ ...f, lease_end_date: e.target.value }))} />
        </label>
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} required>
          {dictionaries.statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700" type="submit">
          {editingId ? "保存宿舍" : "新增宿舍"}
        </button>
        {editingId ? (
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
            }}
          >
            取消编辑
          </button>
        ) : null}
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
            {
              header: "操作",
              cell: (row) => (
                <div className="flex gap-2">
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100" type="button" onClick={() => onEdit(row)}>
                    修改
                  </button>
                  <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => void onDelete(row)}>
                    删除
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}
