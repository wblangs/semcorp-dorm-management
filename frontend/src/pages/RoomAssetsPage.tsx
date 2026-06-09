import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import { editButtonClass, fieldControlClass, primaryButtonClass, secondaryButtonClass } from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Dorm, Room } from "../types";

type AssetDraft = {
  bed_size: string;
  light_type: string;
  nightstand_count: number;
  trash_can_count: number;
};

const emptyDraft: AssetDraft = {
  bed_size: "",
  light_type: "",
  nightstand_count: 0,
  trash_can_count: 0,
};

type DormGroup = {
  dorm: Dorm;
  rooms: Room[];
  totalBeds: number;
  totalNightstands: number;
  totalTrashCans: number;
};

export function RoomAssetsPage() {
  const dictionaries = useDictionaries();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedDormIds, setExpandedDormIds] = useState<Set<number>>(new Set());
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [draft, setDraft] = useState<AssetDraft>(emptyDraft);

  const load = async () => {
    try {
      setLoading(true);
      const [roomData, dormData] = await Promise.all([api.getRooms(), api.getDorms()]);
      setRooms(roomData);
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

  const groups = useMemo<DormGroup[]>(() => {
    const keyword = search.trim().toLowerCase();
    const roomMatches = (room: Room, dorm: Dorm) =>
      !keyword ||
      [
        dorm.name,
        room.room_name,
        room.room_type,
        room.bed_size,
        room.light_type,
        room.nightstand_count,
        room.trash_can_count,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword));

    return dorms.map((dorm) => {
      const dormRooms = rooms.filter((room) => room.dorm_id === dorm.id && roomMatches(room, dorm));
      return {
        dorm,
        rooms: dormRooms,
        totalBeds: dormRooms.reduce((sum, room) => sum + (room.bed_count ?? 0), 0),
        totalNightstands: dormRooms.reduce((sum, room) => sum + (room.nightstand_count ?? 0), 0),
        totalTrashCans: dormRooms.reduce((sum, room) => sum + (room.trash_can_count ?? 0), 0),
      };
    });
  }, [dorms, rooms, search]);

  const toggleDorm = (dormId: number) => {
    setExpandedDormIds((current) => {
      const next = new Set(current);
      if (next.has(dormId)) {
        next.delete(dormId);
      } else {
        next.add(dormId);
      }
      return next;
    });
  };

  const startEdit = (room: Room) => {
    setEditingRoomId(room.id);
    setDraft({
      bed_size: room.bed_size ?? "",
      light_type: room.light_type ?? "",
      nightstand_count: room.nightstand_count ?? 0,
      trash_can_count: room.trash_can_count ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingRoomId(null);
    setDraft(emptyDraft);
  };

  const saveEdit = async (room: Room) => {
    setError("");
    setSaving(true);
    try {
      await api.updateRoom(room.id, {
        bed_size: draft.bed_size || null,
        light_type: draft.light_type || null,
        nightstand_count: draft.nightstand_count,
        trash_can_count: draft.trash_can_count,
      });
      setEditingRoomId(null);
      setDraft(emptyDraft);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">房间资产管理</h2>
      <p className="text-sm text-slate-500">按宿舍查看并维护每个房间的资产（床型、灯具、床头柜、垃圾桶）。</p>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <div className="space-y-3">
          <input
            className={fieldControlClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索房间资产"
          />

          {groups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">暂无宿舍</div>
          ) : (
            groups.map((group) => (
              <section key={group.dorm.id} className="space-y-2">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50"
                  onClick={() => toggleDorm(group.dorm.id)}
                >
                  <span className="font-semibold text-slate-900">{group.dorm.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                    房间数：{group.rooms.length}
                  </span>
                  <span className="text-slate-600">床位总数：{group.totalBeds}</span>
                  <span className="text-slate-600">床头柜总数：{group.totalNightstands}</span>
                  <span className="text-slate-600">垃圾桶总数：{group.totalTrashCans}</span>
                  <span className="ml-auto font-medium text-slate-700">
                    {expandedDormIds.has(group.dorm.id) ? "收起房间" : "展开房间"}
                  </span>
                </button>

                {expandedDormIds.has(group.dorm.id) ? (
                  <DataTable
                    rows={group.rooms}
                    rowKey={(row) => row.id}
                    emptyText="该宿舍暂无房间"
                    columns={[
                      { header: "房间", cell: (row) => row.room_name },
                      { header: "类型", cell: (row) => row.room_type },
                      { header: "床位", cell: (row) => row.bed_count },
                      {
                        header: "床型",
                        cell: (row) =>
                          editingRoomId === row.id ? (
                            <select
                              className={fieldControlClass}
                              value={draft.bed_size}
                              onChange={(e) => setDraft((d) => ({ ...d, bed_size: e.target.value }))}
                            >
                              <option value="">未设置</option>
                              {dictionaries.bedSizes.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            row.bed_size ?? "-"
                          ),
                      },
                      {
                        header: "灯具",
                        cell: (row) =>
                          editingRoomId === row.id ? (
                            <select
                              className={fieldControlClass}
                              value={draft.light_type}
                              onChange={(e) => setDraft((d) => ({ ...d, light_type: e.target.value }))}
                            >
                              <option value="">未设置</option>
                              {dictionaries.lightTypes.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            row.light_type ?? "-"
                          ),
                      },
                      {
                        header: "床头柜",
                        cell: (row) =>
                          editingRoomId === row.id ? (
                            <input
                              className={fieldControlClass}
                              type="number"
                              min={0}
                              value={draft.nightstand_count}
                              onChange={(e) => setDraft((d) => ({ ...d, nightstand_count: Number(e.target.value) }))}
                            />
                          ) : (
                            (row.nightstand_count ?? 0)
                          ),
                      },
                      {
                        header: "垃圾桶",
                        cell: (row) =>
                          editingRoomId === row.id ? (
                            <input
                              className={fieldControlClass}
                              type="number"
                              min={0}
                              value={draft.trash_can_count}
                              onChange={(e) => setDraft((d) => ({ ...d, trash_can_count: Number(e.target.value) }))}
                            />
                          ) : (
                            (row.trash_can_count ?? 0)
                          ),
                      },
                      {
                        header: "操作",
                        cell: (row) =>
                          editingRoomId === row.id ? (
                            <div className="flex gap-2">
                              <button
                                className={primaryButtonClass}
                                type="button"
                                disabled={saving}
                                onClick={() => void saveEdit(row)}
                              >
                                {saving ? "保存中..." : "保存"}
                              </button>
                              <button className={secondaryButtonClass} type="button" onClick={cancelEdit}>
                                取消
                              </button>
                            </div>
                          ) : (
                            <button className={editButtonClass} type="button" onClick={() => startEdit(row)}>
                              修改
                            </button>
                          ),
                      },
                    ]}
                  />
                ) : null}
              </section>
            ))
          )}
        </div>
      )}
    </section>
  );
}
