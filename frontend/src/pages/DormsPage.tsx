import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import { deleteButtonClass, editButtonClass, fieldControlClass, FormField, primaryButtonClass, secondaryButtonClass } from "../components/FormField";
import { useAuth } from "../auth/AuthContext";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Dorm, Vehicle } from "../types"; // CHANGED: 加入 Vehicle 类型
import { ErrorDialog } from "../components/ErrorDialog";

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

// HIDDEN: 车辆模块暂时隐藏，宿舍车辆列跟随隐藏（恢复时改为 true）
const SHOW_DORM_VEHICLES = false;

export function DormsPage() {
  const { canEdit } = useAuth();
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<Dorm[]>([]);

  // ADDED: 保存车辆列表，用来根据车辆的 base_dorm_id 反查宿舍车辆
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<DormFormState>(emptyForm);

  const load = async () => {
    try {
      setLoading(true);

      // CHANGED: 同时读取宿舍和车辆（车辆模块隐藏时跳过请求）
      const [dormData, vehicleData] = await Promise.all([
        api.getDorms(),
        SHOW_DORM_VEHICLES ? api.getVehicles() : Promise.resolve([] as Vehicle[]),
      ]);

      setRows(dormData);
      setVehicles(vehicleData);
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
    if (editingId && !confirm("确认保存修改？")) return;
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
    if (!confirm(`确认删除宿舍 ${row.name}？`)) return;
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

  // ADDED: 根据车辆的 base_dorm_id，把车牌分组到对应宿舍
  const dormVehicleMap = useMemo(() => {
    const map = new Map<number, string[]>();

    vehicles.forEach((vehicle) => {
      if (!vehicle.base_dorm_id) return;

      const plates = map.get(vehicle.base_dorm_id) ?? [];
      plates.push(vehicle.plate_number);
      map.set(vehicle.base_dorm_id, plates);
    });

    return map;
  }, [vehicles]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) => {
      // ADDED: 搜索时也可以搜到宿舍车辆车牌
      const vehiclePlates = dormVehicleMap.get(row.id)?.join(", ") ?? "";

      return [
        row.id,
        row.name,
        row.type,
        row.address,
        row.lease_start_date,
        row.lease_end_date,
        row.status,
        vehiclePlates, // ADDED
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [rows, search, dormVehicleMap]); // CHANGED: 加入 dormVehicleMap

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">宿舍管理</h2>
      {canEdit ? (
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <FormField label="名称" required>
          <input className={fieldControlClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </FormField>
        <FormField label="类型" required>
          <select className={fieldControlClass} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} required>
            {dictionaries.dormTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="地址" required>
          <input className={fieldControlClass} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} required />
        </FormField>
        <FormField label="租期开始日期">
          <input className={fieldControlClass} type="date" value={form.lease_start_date} onChange={(e) => setForm((f) => ({ ...f, lease_start_date: e.target.value }))} />
        </FormField>
        <FormField label="租期结束日期">
          <input className={fieldControlClass} type="date" value={form.lease_end_date} onChange={(e) => setForm((f) => ({ ...f, lease_end_date: e.target.value }))} />
        </FormField>
        <FormField label="状态" required>
          <select className={fieldControlClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} required>
            {dictionaries.statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <button className={primaryButtonClass} type="submit">
          {editingId ? "保存宿舍" : "新增宿舍"}
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

      <ErrorDialog message={error} onClose={() => setError("")} />
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <div className="space-y-2">
          <input
            className={fieldControlClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索宿舍记录"
          />
          <DataTable
            rows={filteredRows}
            rowKey={(row) => row.id}
            emptyText="没有匹配记录"
            columns={[
              { header: "ID", cell: (row) => row.id },
              { header: "名称", cell: (row) => row.name },
              { header: "类型", cell: (row) => row.type },
              { header: "地址", cell: (row) => row.address },

              // ADDED: 宿舍车辆列（车辆模块隐藏时不显示）
              ...(SHOW_DORM_VEHICLES
                ? [
                    {
                      header: "宿舍车辆",
                      cell: (row: Dorm) => {
                        const plates = dormVehicleMap.get(row.id) ?? [];
                        return plates.length > 0 ? plates.join(", ") : "-";
                      },
                    },
                  ]
                : []),

              { header: "租期开始", cell: (row) => row.lease_start_date ?? "-" },
              { header: "租期结束", cell: (row) => row.lease_end_date ?? "-" },
              { header: "状态", cell: (row) => row.status },
              {
                header: "操作",
                cell: (row) => (
                  <div className="flex gap-2">
                    {canEdit ? (
                      <button className={editButtonClass} type="button" onClick={() => onEdit(row)}>
                        修改
                      </button>
                    ) : null}
                    {canEdit ? (
                      <button className={deleteButtonClass} type="button" onClick={() => void onDelete(row)}>
                        删除
                      </button>
                    ) : null}
                    {!canEdit ? <span className="text-slate-400">-</span> : null}
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