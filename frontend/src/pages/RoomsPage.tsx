import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { deleteButtonClass, editButtonClass, fieldControlClass, FormField, primaryButtonClass, secondaryButtonClass } from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import { buildRoomShades } from "../dormPalette";
import type { Dorm, Room } from "../types";

type RoomFormState = {
  dorm_id: string;
  room_name: string;
  room_type: string;
  bed_count: number;
  gender_limit: "Any" | "Male" | "Female";
  status: string;
};

const emptyForm: RoomFormState = {
  dorm_id: "",
  room_name: "",
  room_type: "Single",
  bed_count: 1,
  gender_limit: "Any",
  status: "active",
};

export function RoomsPage() {
  const { isAdmin, canEdit } = useAuth();
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<Room[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<RoomFormState>(emptyForm);

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
    setError("");
    try {
      const payload = {
        ...form,
        dorm_id: Number(form.dorm_id),
      };
      if (editingId) {
        await api.updateRoom(editingId, payload);
      } else {
        await api.createRoom(payload);
      }
      setForm((f) => ({ ...emptyForm, dorm_id: f.dorm_id }));
      setEditingId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onEdit = (row: Room) => {
    setEditingId(row.id);
    setForm({
      dorm_id: String(row.dorm_id),
      room_name: row.room_name,
      room_type: row.room_type,
      bed_count: row.bed_count,
      gender_limit: row.gender_limit,
      status: row.status,
    });
  };

  const onDelete = async (row: Room) => {
    if (!confirm(`确认删除房间 ${row.room_name}？`)) return;
    setError("");
    try {
      await api.deleteRoom(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm((f) => ({ ...emptyForm, dorm_id: f.dorm_id }));
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const dormMap = useMemo(() => new Map(dorms.map((dorm) => [dorm.id, dorm.name])), [dorms]);
  // Shared dorm colour system (same as the Assets / Summary tables).
  const roomShades = useMemo(() => buildRoomShades(dorms, rows), [dorms, rows]);
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? rows.filter((row) =>
          [
            row.id,
            dormMap.get(row.dorm_id),
            row.dorm_id,
            row.room_name,
            row.room_type,
            row.bed_count,
            row.gender_limit,
            row.status,
          ]
            .filter((value) => value !== null && value !== undefined)
            .some((value) => String(value).toLowerCase().includes(keyword)),
        )
      : rows;
    // Group rooms of the same dorm together (then by room name).
    return [...matched].sort((a, b) => {
      const dormA = dormMap.get(a.dorm_id) ?? String(a.dorm_id);
      const dormB = dormMap.get(b.dorm_id) ?? String(b.dorm_id);
      if (dormA !== dormB) return dormA.localeCompare(dormB, "zh-Hans-CN");
      return a.room_name.localeCompare(b.room_name, "zh-Hans-CN");
    });
  }, [dormMap, rows, search]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">房间管理</h2>
      {canEdit ? (
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <FormField label="宿舍" required>
        <select className={fieldControlClass} value={form.dorm_id} onChange={(e) => setForm((f) => ({ ...f, dorm_id: e.target.value }))} required>
          <option value="">选择宿舍</option>
          {dorms.map((dorm) => (
            <option key={dorm.id} value={dorm.id}>
              {dorm.name}
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="房间名" required>
          <input className={fieldControlClass} value={form.room_name} onChange={(e) => setForm((f) => ({ ...f, room_name: e.target.value }))} required />
        </FormField>
        <FormField label="房间类型" required>
        <select className={fieldControlClass} value={form.room_type} onChange={(e) => setForm((f) => ({ ...f, room_type: e.target.value }))} required>
          {dictionaries.roomTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="床位数" required>
          <input className={fieldControlClass} type="number" min={1} value={form.bed_count} onChange={(e) => setForm((f) => ({ ...f, bed_count: Number(e.target.value) }))} required />
        </FormField>
        <FormField label="性别限制">
        <select className={fieldControlClass} value={form.gender_limit} onChange={(e) => setForm((f) => ({ ...f, gender_limit: e.target.value as "Male" | "Female" | "Any" }))}>
          <option value="Any">Any</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
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
          {editingId ? "保存房间" : "新增房间"}
        </button>
        {editingId ? (
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm((f) => ({ ...emptyForm, dorm_id: f.dorm_id }));
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
            placeholder="搜索房间记录"
          />
        <DataTable
          rows={filteredRows}
          rowKey={(row) => row.id}
          emptyText="没有匹配记录"
          rowStyle={(row) => ({ backgroundColor: `#${roomShades.get(row.id) ?? "FFFFFF"}` })}
          columns={[
            { header: "宿舍", cell: (row) => dormMap.get(row.dorm_id) ?? "Unknown" },
            { header: "房间名", cell: (row) => row.room_name },
            { header: "类型", cell: (row) => row.room_type },
            { header: "床位", cell: (row) => row.bed_count },
            { header: "性别限制", cell: (row) => row.gender_limit },
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
