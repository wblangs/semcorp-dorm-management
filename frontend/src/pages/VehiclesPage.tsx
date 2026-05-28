import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Dorm, Vehicle } from "../types";

type VehicleFormState = {
  plate_number: string;
  seat_count: number;
  vehicle_type: string;
  company: string;
  base_dorm_id: string;
  insurance_expire_date: string;
  inspection_expire_date: string;
  maintenance_due_date: string;
  note: string;
  status: string;
};

const emptyForm: VehicleFormState = {
  plate_number: "",
  seat_count: 5,
  vehicle_type: "SUV",
  company: "",
  base_dorm_id: "",
  insurance_expire_date: "",
  inspection_expire_date: "",
  maintenance_due_date: "",
  note: "",
  status: "available",
};

const vehicleStatuses = [
  { label: "可用", value: "available" },
  { label: "维修", value: "maintenance" },
  { label: "停用", value: "disabled" },
];

export function VehiclesPage() {
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [form, setForm] = useState<VehicleFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [vehicleData, dormData] = await Promise.all([api.getVehicles(), api.getDorms()]);
      setRows(vehicleData);
      setDorms(dormData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const payloadFromForm = () => ({
    plate_number: form.plate_number.trim(),
    seat_count: form.seat_count,
    vehicle_type: form.vehicle_type || null,
    company: form.company.trim() || null,
    base_dorm_id: form.base_dorm_id ? Number(form.base_dorm_id) : null,
    insurance_expire_date: form.insurance_expire_date || null,
    inspection_expire_date: form.inspection_expire_date || null,
    maintenance_due_date: form.maintenance_due_date || null,
    note: form.note.trim() || null,
    status: form.status,
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api.updateVehicle(editingId, payloadFromForm());
      } else {
        await api.createVehicle(payloadFromForm());
      }
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onEdit = (row: Vehicle) => {
    setEditingId(row.id);
    setForm({
      plate_number: row.plate_number,
      seat_count: row.seat_count,
      vehicle_type: row.vehicle_type ?? "",
      company: row.company ?? "",
      base_dorm_id: row.base_dorm_id ? String(row.base_dorm_id) : "",
      insurance_expire_date: row.insurance_expire_date ?? "",
      inspection_expire_date: row.inspection_expire_date ?? "",
      maintenance_due_date: row.maintenance_due_date ?? "",
      note: row.note ?? "",
      status: row.status,
    });
  };

  const onDelete = async (row: Vehicle) => {
    if (!confirm(`确认删除车辆 ${row.plate_number}？`)) return;
    setError("");
    try {
      await api.deleteVehicle(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const dormMap = new Map(dorms.map((dorm) => [dorm.id, dorm.name]));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">车辆管理</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="车牌号" value={form.plate_number} onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))} required />
        <input className="rounded-lg border border-slate-300 px-3 py-2" type="number" min={1} placeholder="座位数" value={form.seat_count} onChange={(e) => setForm((f) => ({ ...f, seat_count: Number(e.target.value) }))} required />
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.vehicle_type} onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value }))}>
          <option value="">选择车辆类型</option>
          {dictionaries.vehicleTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="所属公司" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.base_dorm_id} onChange={(e) => setForm((f) => ({ ...f, base_dorm_id: e.target.value }))}>
          <option value="">选择常驻宿舍</option>
          {dorms.map((dorm) => (
            <option key={dorm.id} value={dorm.id}>
              {dorm.name} (#{dorm.id})
            </option>
          ))}
        </select>
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
          {vehicleStatuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>保险到期日</span>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" type="date" value={form.insurance_expire_date} onChange={(e) => setForm((f) => ({ ...f, insurance_expire_date: e.target.value }))} />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>年检到期日</span>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" type="date" value={form.inspection_expire_date} onChange={(e) => setForm((f) => ({ ...f, inspection_expire_date: e.target.value }))} />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>保养到期日</span>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" type="date" value={form.maintenance_due_date} onChange={(e) => setForm((f) => ({ ...f, maintenance_due_date: e.target.value }))} />
        </label>
        <input className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="备注" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        <button className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700" type="submit">
          {editingId ? "保存车辆" : "新增车辆"}
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
            { header: "车牌号", cell: (row) => row.plate_number },
            { header: "类型", cell: (row) => row.vehicle_type ?? "-" },
            { header: "座位", cell: (row) => row.seat_count },
            { header: "公司", cell: (row) => row.company ?? "-" },
            { header: "常驻宿舍", cell: (row) => (row.base_dorm_id ? `${dormMap.get(row.base_dorm_id) ?? "Unknown"} (#${row.base_dorm_id})` : "-") },
            { header: "保险到期", cell: (row) => row.insurance_expire_date ?? "-" },
            { header: "年检到期", cell: (row) => row.inspection_expire_date ?? "-" },
            { header: "保养到期", cell: (row) => row.maintenance_due_date ?? "-" },
            { header: "状态", cell: (row) => vehicleStatuses.find((item) => item.value === row.status)?.label ?? row.status },
            { header: "备注", cell: (row) => row.note ?? "-" },
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
