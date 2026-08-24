import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import type { VehiclePayload } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import {
  deleteButtonClass,
  editButtonClass,
  fieldControlClass,
  FormField,
  primaryButtonClass,
  secondaryButtonClass,
} from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Dorm, Vehicle } from "../types";
import { dueDateClass, labelOf, ownershipOptions, vehicleStatusOptions } from "../vehicleConstants";
import { ErrorDialog } from "../components/ErrorDialog";

type VehicleFormState = {
  plate_number: string;
  vin: string;
  make: string;
  model: string;
  model_year: string;
  color: string;
  seat_count: number;
  vehicle_type: string;
  ownership_type: "owned" | "leased";
  purchase_date: string;
  purchase_price: string;
  lease_company: string;
  lease_start_date: string;
  lease_end_date: string;
  lease_monthly_fee: string;
  base_dorm_id: string;
  inspection_expire_date: string;
  registration_expire_date: string;
  odometer: string;
  maintenance_interval_miles: string;
  maintenance_interval_months: string;
  note: string;
  status: Vehicle["status"];
};

const emptyForm: VehicleFormState = {
  plate_number: "",
  vin: "",
  make: "",
  model: "",
  model_year: "",
  color: "",
  seat_count: 5,
  vehicle_type: "SUV",
  ownership_type: "owned",
  purchase_date: "",
  purchase_price: "",
  lease_company: "",
  lease_start_date: "",
  lease_end_date: "",
  lease_monthly_fee: "",
  base_dorm_id: "",
  inspection_expire_date: "",
  registration_expire_date: "",
  odometer: "",
  maintenance_interval_miles: "",
  maintenance_interval_months: "",
  note: "",
  status: "available",
};

const numOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

export function VehiclesPage() {
  const { canEdit, isAdmin } = useAuth();
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [form, setForm] = useState<VehicleFormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dormFilter, setDormFilter] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState("");

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

  const payloadFromForm = (): VehiclePayload => ({
    plate_number: form.plate_number.trim(),
    vin: form.vin.trim() || null,
    make: form.make.trim() || null,
    model: form.model.trim() || null,
    model_year: numOrNull(form.model_year),
    color: form.color.trim() || null,
    seat_count: form.seat_count,
    vehicle_type: form.vehicle_type || null,
    ownership_type: form.ownership_type,
    purchase_date: form.ownership_type === "owned" ? form.purchase_date || null : null,
    purchase_price: form.ownership_type === "owned" ? numOrNull(form.purchase_price) : null,
    lease_company: form.ownership_type === "leased" ? form.lease_company.trim() || null : null,
    lease_start_date: form.ownership_type === "leased" ? form.lease_start_date || null : null,
    lease_end_date: form.ownership_type === "leased" ? form.lease_end_date || null : null,
    lease_monthly_fee: form.ownership_type === "leased" ? numOrNull(form.lease_monthly_fee) : null,
    inspection_expire_date: form.inspection_expire_date || null,
    registration_expire_date: form.registration_expire_date || null,
    maintenance_interval_miles: numOrNull(form.maintenance_interval_miles),
    maintenance_interval_months: numOrNull(form.maintenance_interval_months),
    note: form.note.trim() || null,
    status: form.status,
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (editingId && !confirm("确认保存修改？")) return;
    setError("");
    try {
      if (editingId) {
        await api.updateVehicle(editingId, payloadFromForm());
      } else {
        // 建车时可带初始宿舍与里程，之后分别走调拨/里程接口。
        await api.createVehicle({
          ...payloadFromForm(),
          base_dorm_id: form.base_dorm_id ? Number(form.base_dorm_id) : null,
          odometer: numOrNull(form.odometer),
        });
      }
      setEditingId(null);
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onEdit = (row: Vehicle) => {
    setEditingId(row.id);
    setShowForm(true);
    setForm({
      plate_number: row.plate_number,
      vin: row.vin ?? "",
      make: row.make ?? "",
      model: row.model ?? "",
      model_year: row.model_year ? String(row.model_year) : "",
      color: row.color ?? "",
      seat_count: row.seat_count,
      vehicle_type: row.vehicle_type ?? "",
      ownership_type: row.ownership_type,
      purchase_date: row.purchase_date ?? "",
      purchase_price: row.purchase_price != null ? String(row.purchase_price) : "",
      lease_company: row.lease_company ?? "",
      lease_start_date: row.lease_start_date ?? "",
      lease_end_date: row.lease_end_date ?? "",
      lease_monthly_fee: row.lease_monthly_fee != null ? String(row.lease_monthly_fee) : "",
      base_dorm_id: row.base_dorm_id ? String(row.base_dorm_id) : "",
      inspection_expire_date: row.inspection_expire_date ?? "",
      registration_expire_date: row.registration_expire_date ?? "",
      odometer: row.odometer != null ? String(row.odometer) : "",
      maintenance_interval_miles: row.maintenance_interval_miles != null ? String(row.maintenance_interval_miles) : "",
      maintenance_interval_months: row.maintenance_interval_months != null ? String(row.maintenance_interval_months) : "",
      note: row.note ?? "",
      status: row.status,
    });
  };

  const onDelete = async (row: Vehicle) => {
    if (!confirm(`确认删除车辆 ${row.plate_number}？相关保单、保养、修理、事故记录将一并隐藏`)) return;
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
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (ownershipFilter && row.ownership_type !== ownershipFilter) return false;
      if (dormFilter) {
        if (dormFilter === "none" ? row.base_dorm_id !== null : row.base_dorm_id !== Number(dormFilter)) return false;
      }
      if (!keyword) return true;
      const driverNames = (row.drivers ?? []).map((driver) => driver.person?.chinese_name ?? "").join(" ");
      return [
        row.plate_number,
        row.vin,
        row.make,
        row.model,
        row.color,
        row.vehicle_type,
        driverNames,
        row.base_dorm_id ? dormMap.get(row.base_dorm_id) : null,
        row.note,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [dormFilter, dormMap, ownershipFilter, rows, search, statusFilter]);

  const statusChipClass = (status: Vehicle["status"]) => {
    if (status === "available") return "bg-emerald-100 text-emerald-700";
    if (status === "in_repair") return "bg-amber-100 text-amber-700";
    return "bg-slate-200 text-slate-600";
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">车辆管理</h2>
        <span className="text-sm text-slate-500">共 {rows.length} 辆</span>
        <span className="ml-auto" />
        {canEdit ? (
          <button
            className={primaryButtonClass}
            type="button"
            onClick={() => {
              if (showForm && !editingId) {
                setShowForm(false);
              } else {
                setEditingId(null);
                setForm(emptyForm);
                setShowForm(true);
              }
            }}
          >
            {showForm && !editingId ? "收起表单" : "新增车辆"}
          </button>
        ) : null}
      </div>

      {canEdit && showForm ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">{editingId ? `编辑车辆 #${editingId}` : "新增车辆"}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField label="车牌号" required>
              <input className={fieldControlClass} value={form.plate_number} onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))} required />
            </FormField>
            <FormField label="车架号 VIN">
              <input className={fieldControlClass} value={form.vin} onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))} />
            </FormField>
            <FormField label="品牌">
              <input className={fieldControlClass} value={form.make} placeholder="如 Toyota" onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} />
            </FormField>
            <FormField label="车型">
              <input className={fieldControlClass} value={form.model} placeholder="如 Sienna" onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
            </FormField>
            <FormField label="年款">
              <input className={fieldControlClass} type="number" min={1980} max={2100} value={form.model_year} onChange={(e) => setForm((f) => ({ ...f, model_year: e.target.value }))} />
            </FormField>
            <FormField label="颜色">
              <input className={fieldControlClass} value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
            </FormField>
            <FormField label="车辆类型">
              <select className={fieldControlClass} value={form.vehicle_type} onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value }))}>
                <option value="">选择车辆类型</option>
                {dictionaries.vehicleTypes.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="座位数" required>
              <input className={fieldControlClass} type="number" min={1} value={form.seat_count} onChange={(e) => setForm((f) => ({ ...f, seat_count: Number(e.target.value) }))} required />
            </FormField>
            <FormField label="产权形式" required>
              <select className={fieldControlClass} value={form.ownership_type} onChange={(e) => setForm((f) => ({ ...f, ownership_type: e.target.value as "owned" | "leased" }))}>
                {ownershipOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="状态">
              <select className={fieldControlClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Vehicle["status"] }))}>
                {vehicleStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            {form.ownership_type === "owned" ? (
              <>
                <FormField label="购置日期">
                  <input className={fieldControlClass} type="date" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} />
                </FormField>
                <FormField label="购置金额 ($)">
                  <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))} />
                </FormField>
              </>
            ) : (
              <>
                <FormField label="租赁公司">
                  <input className={fieldControlClass} value={form.lease_company} onChange={(e) => setForm((f) => ({ ...f, lease_company: e.target.value }))} />
                </FormField>
                <FormField label="合同起始">
                  <input className={fieldControlClass} type="date" value={form.lease_start_date} onChange={(e) => setForm((f) => ({ ...f, lease_start_date: e.target.value }))} />
                </FormField>
                <FormField label="合同到期">
                  <input className={fieldControlClass} type="date" value={form.lease_end_date} onChange={(e) => setForm((f) => ({ ...f, lease_end_date: e.target.value }))} />
                </FormField>
                <FormField label="月租金 ($)">
                  <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.lease_monthly_fee} onChange={(e) => setForm((f) => ({ ...f, lease_monthly_fee: e.target.value }))} />
                </FormField>
              </>
            )}
            <FormField label="年检到期">
              <input className={fieldControlClass} type="date" value={form.inspection_expire_date} onChange={(e) => setForm((f) => ({ ...f, inspection_expire_date: e.target.value }))} />
            </FormField>
            <FormField label="注册到期">
              <input className={fieldControlClass} type="date" value={form.registration_expire_date} onChange={(e) => setForm((f) => ({ ...f, registration_expire_date: e.target.value }))} />
            </FormField>
            {!editingId ? (
              <>
                <FormField label="初始宿舍">
                  <select className={fieldControlClass} value={form.base_dorm_id} onChange={(e) => setForm((f) => ({ ...f, base_dorm_id: e.target.value }))}>
                    <option value="">暂不分配</option>
                    {dorms.map((dorm) => (
                      <option key={dorm.id} value={dorm.id}>{dorm.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="当前里程 (mi)">
                  <input className={fieldControlClass} type="number" min={0} value={form.odometer} onChange={(e) => setForm((f) => ({ ...f, odometer: e.target.value }))} />
                </FormField>
              </>
            ) : null}
            <FormField label="保养里程间隔 (mi)">
              <input className={fieldControlClass} type="number" min={1} placeholder="留空用默认值" value={form.maintenance_interval_miles} onChange={(e) => setForm((f) => ({ ...f, maintenance_interval_miles: e.target.value }))} />
            </FormField>
            <FormField label="保养月数间隔">
              <input className={fieldControlClass} type="number" min={1} placeholder="留空用默认值" value={form.maintenance_interval_months} onChange={(e) => setForm((f) => ({ ...f, maintenance_interval_months: e.target.value }))} />
            </FormField>
            <FormField label="备注" className="md:col-span-2">
              <input className={fieldControlClass} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </FormField>
          </div>
          {editingId ? (
            <p className="text-xs text-slate-500">
              保险到期、下次保养、常驻宿舍由保单/保养台账/调拨记录自动算出，请在车辆详情页维护对应台账。
            </p>
          ) : null}
          <div className="flex gap-2">
            <button className={primaryButtonClass} type="submit">{editingId ? "保存车辆" : "新增车辆"}</button>
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setShowForm(false);
              }}
            >
              取消
            </button>
          </div>
        </form>
      ) : null}

      <ErrorDialog message={error} onClose={() => setError("")} />
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              className={`${fieldControlClass} md:max-w-xs`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索车牌 / 品牌 / 驾驶人"
            />
            <select className={`${fieldControlClass} md:max-w-40`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">全部状态</option>
              {vehicleStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select className={`${fieldControlClass} md:max-w-44`} value={dormFilter} onChange={(e) => setDormFilter(e.target.value)}>
              <option value="">全部宿舍</option>
              <option value="none">未分配</option>
              {dorms.map((dorm) => (
                <option key={dorm.id} value={dorm.id}>{dorm.name}</option>
              ))}
            </select>
            <select className={`${fieldControlClass} md:max-w-36`} value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value)}>
              <option value="">全部产权</option>
              {ownershipOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <DataTable
            rows={filteredRows}
            rowKey={(row) => row.id}
            emptyText="没有匹配记录"
            columns={[
              {
                header: "车牌",
                cell: (row) => (
                  <span className="inline-flex items-center gap-1.5">
                    <Link className="font-semibold text-indigo-600 hover:underline" to={`/vehicles/${row.id}`}>
                      {row.plate_number}
                    </Link>
                    {row.ownership_type === "leased" ? (
                      <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">租</span>
                    ) : null}
                  </span>
                ),
              },
              {
                header: "品牌车型",
                cell: (row) => {
                  const name = [row.make, row.model].filter(Boolean).join(" ");
                  return (
                    <span>
                      {name || "-"}
                      {row.model_year ? <span className="block text-xs text-slate-400">{row.model_year} 年款{row.color ? ` · ${row.color}` : ""}</span> : null}
                    </span>
                  );
                },
              },
              { header: "类型/座位", cell: (row) => `${row.vehicle_type ?? "-"} / ${row.seat_count}` },
              {
                header: "常驻宿舍",
                cell: (row) =>
                  row.base_dorm_id ? (
                    dormMap.get(row.base_dorm_id) ?? "Unknown"
                  ) : (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">未分配</span>
                  ),
              },
              {
                header: "挂靠人",
                cell: (row) => {
                  const drivers = row.drivers ?? [];
                  if (drivers.length === 0) {
                    return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">未挂靠</span>;
                  }
                  return drivers.map((driver) => driver.person?.chinese_name ?? "?").join(" · ");
                },
              },
              {
                header: "保险到期",
                cell: (row) =>
                  row.insurance_expire_date ? (
                    <span className={dueDateClass(row.insurance_expire_date)}>{row.insurance_expire_date}</span>
                  ) : (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">未上保险</span>
                  ),
              },
              {
                header: "年检到期",
                cell: (row) => <span className={dueDateClass(row.inspection_expire_date)}>{row.inspection_expire_date ?? "-"}</span>,
              },
              {
                header: "下次保养",
                cell: (row) => (
                  <span className={dueDateClass(row.maintenance_due_date)}>
                    {row.maintenance_due_date ?? "-"}
                    {row.maintenance_due_mileage != null ? (
                      <span className="block text-xs font-normal text-slate-400">或 {row.maintenance_due_mileage.toLocaleString()} mi</span>
                    ) : null}
                  </span>
                ),
              },
              {
                header: "里程",
                cell: (row) => (row.odometer != null ? row.odometer.toLocaleString() : "-"),
              },
              {
                header: "状态",
                cell: (row) => (
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusChipClass(row.status)}`}>
                    {labelOf(vehicleStatusOptions, row.status)}
                  </span>
                ),
              },
              {
                header: "操作",
                cell: (row) => (
                  <div className="flex gap-2">
                    <Link className={editButtonClass} to={`/vehicles/${row.id}`}>详情</Link>
                    {canEdit ? (
                      <button className={editButtonClass} type="button" onClick={() => onEdit(row)}>修改</button>
                    ) : null}
                    {isAdmin ? (
                      <button className={deleteButtonClass} type="button" onClick={() => void onDelete(row)}>删除</button>
                    ) : null}
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
