import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { deleteButtonClass, editButtonClass, fieldControlClass, FormField, primaryButtonClass, secondaryButtonClass } from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Dorm, Vehicle } from "../types";

type VehicleFormState = {
  plate_number: string;
  seat_count: number;
  vehicle_type: string;
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
  const { isAdmin, canEdit } = useAuth();
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [form, setForm] = useState<VehicleFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const dormMap = useMemo(() => new Map(dorms.map((dorm) => [dorm.id, dorm.name])), [dorms]);
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [
        row.id,
        row.plate_number,
        row.vehicle_type,
        row.seat_count,
        row.base_dorm_id,
        row.base_dorm_id ? dormMap.get(row.base_dorm_id) : null,
        row.insurance_expire_date,
        row.inspection_expire_date,
        row.maintenance_due_date,
        vehicleStatuses.find((item) => item.value === row.status)?.label ?? row.status,
        row.note,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [dormMap, rows, search]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">车辆管理</h2>
      {canEdit ? (
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <FormField label="车牌号" required>
          <input className={fieldControlClass} value={form.plate_number} onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))} required />
        </FormField>
        <FormField label="座位数" required>
          <input className={fieldControlClass} type="number" min={1} value={form.seat_count} onChange={(e) => setForm((f) => ({ ...f, seat_count: Number(e.target.value) }))} required />
        </FormField>
        <FormField label="车辆类型">
        <select className={fieldControlClass} value={form.vehicle_type} onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value }))}>
          <option value="">选择车辆类型</option>
          {dictionaries.vehicleTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="常驻宿舍">
        <select className={fieldControlClass} value={form.base_dorm_id} onChange={(e) => setForm((f) => ({ ...f, base_dorm_id: e.target.value }))}>
          <option value="">选择常驻宿舍</option>
          {dorms.map((dorm) => (
            <option key={dorm.id} value={dorm.id}>
              {dorm.name}
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="状态">
        <select className={fieldControlClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
          {vehicleStatuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="保险到期日">
          <input className={fieldControlClass} type="date" value={form.insurance_expire_date} onChange={(e) => setForm((f) => ({ ...f, insurance_expire_date: e.target.value }))} />
        </FormField>
        <FormField label="年检到期日">
          <input className={fieldControlClass} type="date" value={form.inspection_expire_date} onChange={(e) => setForm((f) => ({ ...f, inspection_expire_date: e.target.value }))} />
        </FormField>
        <FormField label="保养到期日">
          <input className={fieldControlClass} type="date" value={form.maintenance_due_date} onChange={(e) => setForm((f) => ({ ...f, maintenance_due_date: e.target.value }))} />
        </FormField>
        <FormField label="备注" className="md:col-span-2">
          <input className={fieldControlClass} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </FormField>
        <button className={primaryButtonClass} type="submit">
          {editingId ? "保存车辆" : "新增车辆"}
        </button>
        {editingId ? (
          <button
            className={secondaryButtonClass}
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
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <div className="space-y-2">
          <input
            className={fieldControlClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索车辆记录"
          />
        <DataTable
          rows={filteredRows}
          rowKey={(row) => row.id}
          emptyText="没有匹配记录"
          columns={[
            { header: "车牌号", cell: (row) => row.plate_number },
            { header: "类型", cell: (row) => row.vehicle_type ?? "-" },
            { header: "座位", cell: (row) => row.seat_count },
            { header: "常驻宿舍", cell: (row) => (row.base_dorm_id ? dormMap.get(row.base_dorm_id) ?? "Unknown" : "-") },
            { header: "保险到期", cell: (row) => row.insurance_expire_date ?? "-" },
            { header: "年检到期", cell: (row) => row.inspection_expire_date ?? "-" },
            { header: "保养到期", cell: (row) => row.maintenance_due_date ?? "-" },
            { header: "状态", cell: (row) => vehicleStatuses.find((item) => item.value === row.status)?.label ?? row.status },
            { header: "备注", cell: (row) => row.note ?? "-" },
            {
              header: "操作",
              cell: (row) => (
                <div className="flex gap-2">
                  {canEdit ? (
                    <button className={editButtonClass} type="button" onClick={() => onEdit(row)}>
                      修改
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button className={deleteButtonClass} type="button" onClick={() => void onDelete(row)}>
                      删除
                    </button>
                  ) : null}
                  {!canEdit && !isAdmin ? <span className="text-slate-400">-</span> : null}
                </div>
              ),
            },
          ]}
        />
        </div>
      )}
    </section>
  );
}
