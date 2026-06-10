import { useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
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
  const { canEdit } = useAuth();
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

  // Cell renderers for the transposed matrix (asset rows × room columns).
  const bedSizeCell = (room: Room) =>
    editingRoomId === room.id ? (
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
      <span>{room.bed_size ?? "-"}</span>
    );

  const lightCell = (room: Room) =>
    editingRoomId === room.id ? (
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
      <span>{room.light_type ?? "-"}</span>
    );

  const nightstandCell = (room: Room) =>
    editingRoomId === room.id ? (
      <input
        className={fieldControlClass}
        type="number"
        min={0}
        value={draft.nightstand_count}
        onChange={(e) => setDraft((d) => ({ ...d, nightstand_count: Number(e.target.value) }))}
      />
    ) : (
      <span>{room.nightstand_count ?? 0}</span>
    );

  const trashCell = (room: Room) =>
    editingRoomId === room.id ? (
      <input
        className={fieldControlClass}
        type="number"
        min={0}
        value={draft.trash_can_count}
        onChange={(e) => setDraft((d) => ({ ...d, trash_can_count: Number(e.target.value) }))}
      />
    ) : (
      <span>{room.trash_can_count ?? 0}</span>
    );

  const actionCell = (room: Room) =>
    editingRoomId === room.id ? (
      <div className="flex gap-2">
        <button className={primaryButtonClass} type="button" disabled={saving} onClick={() => void saveEdit(room)}>
          {saving ? "保存中..." : "保存"}
        </button>
        <button className={secondaryButtonClass} type="button" onClick={cancelEdit}>
          取消
        </button>
      </div>
    ) : canEdit ? (
      <button className={editButtonClass} type="button" onClick={() => startEdit(room)}>
        修改
      </button>
    ) : (
      <span className="text-slate-400">-</span>
    );

  const assetRows: { label: string; render: (room: Room) => ReactNode }[] = [
    { label: "类型", render: (room) => room.room_type },
    { label: "床位", render: (room) => room.bed_count },
    { label: "床型", render: bedSizeCell },
    { label: "灯具", render: lightCell },
    { label: "床头柜", render: nightstandCell },
    { label: "垃圾桶", render: trashCell },
    { label: "操作", render: actionCell },
  ];

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
                  group.rooms.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                      该宿舍暂无房间
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 font-semibold">房间</th>
                            {group.rooms.map((room) => (
                              <th key={room.id} className="whitespace-nowrap px-4 py-3 font-semibold">
                                {room.room_name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {assetRows.map((assetRow) => (
                            <tr key={assetRow.label} className="border-t border-slate-100">
                              <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-medium text-slate-600">
                                {assetRow.label}
                              </th>
                              {group.rooms.map((room) => (
                                <td key={room.id} className="px-4 py-3 text-slate-700">
                                  {assetRow.render(room)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}
              </section>
            ))
          )}
        </div>
      )}
    </section>
  );
}
