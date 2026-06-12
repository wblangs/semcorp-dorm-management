import { useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { deleteButtonClass, editButtonClass, fieldControlClass, primaryButtonClass, secondaryButtonClass } from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import { DORM_PALETTE, REPORT_HEADER_FILL } from "../dormPalette";
import type { Dorm, Room, RoomItem } from "../types";
import { todayISO } from "../utils/date";
import { ErrorDialog } from "../components/ErrorDialog";

const COLUMNS = ["宿舍", "房间", "物品", "型号", "数量"];

type Draft = { name: string; item_type: string; count: number };

export function RoomAssetsPage() {
  const { canEdit } = useAuth();
  const dictionaries = useDictionaries();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [items, setItems] = useState<RoomItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ name: "", item_type: "", count: 1 });
  const [addForm, setAddForm] = useState({ dorm_id: "", room_id: "", name: "", item_type: "", count: 1 });

  const load = async () => {
    try {
      setLoading(true);
      const [roomData, dormData, itemData] = await Promise.all([api.getRooms(), api.getDorms(), api.getRoomItems()]);
      setRooms(roomData);
      setDorms(dormData);
      setItems(itemData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const itemNameOptions = dictionaries.assetItems ?? [];

  const itemsByRoom = useMemo(() => {
    const map = new Map<number, RoomItem[]>();
    items.forEach((item) => map.set(item.room_id, [...(map.get(item.room_id) ?? []), item]));
    return map;
  }, [items]);

  const nameSuggestions = useMemo(() => {
    const set = new Set<string>(itemNameOptions.map((o) => o.value));
    items.forEach((it) => set.add(it.name));
    return Array.from(set);
  }, [itemNameOptions, items]);

  const typeSuggestions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.item_type && set.add(it.item_type));
    return Array.from(set);
  }, [items]);

  const addRooms = useMemo(
    () => rooms.filter((room) => String(room.dorm_id) === addForm.dorm_id),
    [rooms, addForm.dorm_id],
  );

  useEffect(() => {
    setAddForm((f) => {
      const dormId = f.dorm_id && dorms.some((d) => String(d.id) === f.dorm_id) ? f.dorm_id : String(dorms[0]?.id ?? "");
      const dormRooms = rooms.filter((room) => String(room.dorm_id) === dormId);
      const roomId = f.room_id && dormRooms.some((r) => String(r.id) === f.room_id) ? f.room_id : String(dormRooms[0]?.id ?? "");
      return f.dorm_id === dormId && f.room_id === roomId ? f : { ...f, dorm_id: dormId, room_id: roomId };
    });
  }, [dorms, rooms]);

  const groups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const roomMatches = (room: Room, dorm: Dorm) => {
      if (!keyword) return true;
      const roomItems = itemsByRoom.get(room.id) ?? [];
      return [dorm.name, room.room_name, ...roomItems.flatMap((it) => [it.name, it.item_type, it.count])]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword));
    };
    return dorms
      .map((dorm, index) => ({
        dorm,
        palette: DORM_PALETTE[index % DORM_PALETTE.length],
        rooms: rooms
          .filter((room) => room.dorm_id === dorm.id && roomMatches(room, dorm))
          .sort((a, b) => a.room_name.localeCompare(b.room_name, "zh-Hans-CN")),
      }))
      .filter((group) => group.rooms.length > 0);
  }, [dorms, itemsByRoom, rooms, search]);

  const startEdit = (item: RoomItem) => {
    setEditingItemId(item.id);
    setEditDraft({ name: item.name, item_type: item.item_type ?? "", count: item.count });
  };

  const cancelEdit = () => setEditingItemId(null);

  const saveEdit = async (item: RoomItem) => {
    if (!confirm("确认保存修改？")) return;
    setError("");
    setBusy(true);
    try {
      await api.updateRoomItem(item.id, {
        name: editDraft.name,
        item_type: editDraft.item_type || null,
        count: editDraft.count,
      });
      setEditingItemId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addItem = async () => {
    const roomId = Number(addForm.room_id);
    if (!roomId || !addForm.name.trim()) {
      setError("请选择宿舍、房间并填写物品名称");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api.createRoomItem({
        room_id: roomId,
        name: addForm.name.trim(),
        item_type: addForm.item_type || null,
        count: addForm.count,
      });
      setAddForm((f) => ({ ...f, name: "", item_type: "", count: 1 }));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (item: RoomItem) => {
    if (!confirm(`确认删除资产「${item.name}」？`)) return;
    setError("");
    setBusy(true);
    try {
      await api.deleteRoomItem(item.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    setError("");
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const { saveAs } = await import("file-saver");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("房间资产");
      sheet.columns = [{ width: 16 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 10 }];

      const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
      const border = { top: thin, left: thin, bottom: thin, right: thin };

      const headerRow = sheet.addRow(COLUMNS);
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${REPORT_HEADER_FILL}` } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = border;
      });

      groups.forEach((group) => {
        group.rooms.forEach((room) => {
          const roomItems = itemsByRoom.get(room.id) ?? [];
          const rowsForRoom = roomItems.length > 0 ? roomItems : [null];
          rowsForRoom.forEach((item) => {
            const row = sheet.addRow([
              group.dorm.name,
              room.room_name,
              item ? item.name : "(无资产)",
              item ? item.item_type ?? "-" : "-",
              item ? item.count : 0,
            ]);
            row.eachCell((cell, col) => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${group.palette.excel}` } };
              cell.border = border;
              cell.alignment = { vertical: "middle", horizontal: col >= 3 ? "center" : "left" };
            });
          });
        });
      });

      sheet.views = [{ state: "frozen", ySplit: 1 }];
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: "application/octet-stream" }), `房间资产_${todayISO()}.xlsx`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const td = "border border-slate-100 px-4 py-2 align-top text-slate-800"; // CHANGE
  const colCount = canEdit ? COLUMNS.length + 1 : COLUMNS.length;

  return (
    <section className="space-y-4">
      <datalist id="asset-name-list">
        {nameSuggestions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="asset-type-list">
        {typeSuggestions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">房间资产管理</h2>
        <button className={primaryButtonClass} type="button" disabled={exporting || loading} onClick={() => void onExport()}>
          {exporting ? "导出中..." : "导出 Excel"}
        </button>
      </div>
      <p className="text-sm text-slate-500">每个房间可自由增删资产物品；不同宿舍使用统一颜色标签区分。</p> {/* CHANGE */}

      {canEdit ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-6">
          <select
            className={fieldControlClass}
            value={addForm.dorm_id}
            onChange={(e) => {
              const dormId = e.target.value;
              const firstRoom = rooms.find((room) => String(room.dorm_id) === dormId);
              setAddForm((f) => ({ ...f, dorm_id: dormId, room_id: String(firstRoom?.id ?? "") }));
            }}
          >
            <option value="">选择宿舍</option>
            {dorms.map((dorm) => (
              <option key={dorm.id} value={dorm.id}>
                {dorm.name}
              </option>
            ))}
          </select>
          <select
            className={fieldControlClass}
            value={addForm.room_id}
            onChange={(e) => setAddForm((f) => ({ ...f, room_id: e.target.value }))}
          >
            <option value="">选择房间</option>
            {addRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.room_name}
              </option>
            ))}
          </select>
          <input
            className={fieldControlClass}
            list="asset-name-list"
            placeholder="物品(可输入或选择)"
            value={addForm.name}
            onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className={fieldControlClass}
            list="asset-type-list"
            placeholder="型号(可选)"
            value={addForm.item_type}
            onChange={(e) => setAddForm((f) => ({ ...f, item_type: e.target.value }))}
          />
          <input
            className={fieldControlClass}
            type="number"
            min={0}
            placeholder="数量"
            value={addForm.count}
            onChange={(e) => setAddForm((f) => ({ ...f, count: Number(e.target.value) }))}
          />
          <button className={primaryButtonClass} type="button" disabled={busy} onClick={() => void addItem()}>
            添加资产
          </button>
        </div>
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
            placeholder="搜索房间资产"
          />

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  {COLUMNS.map((label) => (
                    <th key={label} className="px-4 py-2 font-semibold">
                      {label}
                    </th>
                  ))}
                  {canEdit ? <th className="px-4 py-2 font-semibold">操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={colCount}>
                      没有匹配记录
                    </td>
                  </tr>
                ) : null}

                {groups.flatMap((group) => {
                  const color = group.palette; // CHANGE
                  let dormShown = false;
                  const trs: ReactNode[] = [];

                  group.rooms.forEach((room, roomIdx) => {
                    // White rows; the dorm accent bar alternates light/dark per room.
                    const roomBg = "#ffffff";
                    const accent = roomIdx % 2 === 1 ? color.borderStrong : color.border;
                    const roomItems = itemsByRoom.get(room.id) ?? [];
                    type RowKind = { kind: "item"; item: RoomItem } | { kind: "empty" };
                    const rowKinds: RowKind[] = [
                      ...roomItems.map((item) => ({ kind: "item", item }) as RowKind),
                      ...(roomItems.length === 0 ? [{ kind: "empty" } as RowKind] : []),
                    ];

                    rowKinds.forEach((rk, rIdx) => {
                      const showDorm = !dormShown;
                      dormShown = true;
                      const showRoom = rIdx === 0;
                      const rowKey = rk.kind === "item" ? `item-${rk.item.id}` : `${rk.kind}-${room.id}-${rIdx}`;
                      const editing = rk.kind === "item" && editingItemId === rk.item.id;

                      trs.push(
                        <tr key={rowKey} style={{ borderLeft: `5px solid ${accent}` }}>
                          <td style={{ backgroundColor: roomBg }} className={`${td} font-semibold text-slate-900`}> {/* CHANGE */}
                            {showDorm ? (
                              <span
                                className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold" // CHANGE
                                style={{
                                  backgroundColor: color.bg,
                                  color: color.text,
                                  borderColor: color.border,
                                }}
                              >
                                {group.dorm.name}
                              </span>
                            ) : (
                              ""
                            )}
                          </td>

                          <td style={{ backgroundColor: roomBg }} className={`${td} font-medium`}> {/* CHANGE */}
                            {showRoom ? room.room_name : ""}
                          </td>

                          {rk.kind === "empty" ? (
                            <>
                              <td style={{ backgroundColor: roomBg }} className={`${td} text-slate-500`} colSpan={canEdit ? 4 : 3}> {/* CHANGE */}
                                暂无资产
                              </td>
                            </>
                          ) : editing ? (
                            <>
                              <td style={{ backgroundColor: roomBg }} className={td}> {/* CHANGE */}
                                <input
                                  className={fieldControlClass}
                                  list="asset-name-list"
                                  value={editDraft.name}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                                />
                              </td>
                              <td style={{ backgroundColor: roomBg }} className={td}> {/* CHANGE */}
                                <input
                                  className={fieldControlClass}
                                  list="asset-type-list"
                                  placeholder="型号(可选)"
                                  value={editDraft.item_type}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, item_type: e.target.value }))}
                                />
                              </td>
                              <td style={{ backgroundColor: roomBg }} className={td}> {/* CHANGE */}
                                <input
                                  className={fieldControlClass}
                                  type="number"
                                  min={0}
                                  value={editDraft.count}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, count: Number(e.target.value) }))}
                                />
                              </td>
                              <td style={{ backgroundColor: roomBg }} className={td}> {/* CHANGE */}
                                <div className="flex gap-2">
                                  <button className={primaryButtonClass} type="button" disabled={busy} onClick={() => void saveEdit(rk.item)}>
                                    {busy ? "保存中..." : "保存"}
                                  </button>
                                  <button className={secondaryButtonClass} type="button" onClick={cancelEdit}>
                                    取消
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ backgroundColor: roomBg }} className={td}> {/* CHANGE */}
                                {rk.item.name}
                              </td>
                              <td style={{ backgroundColor: roomBg }} className={td}> {/* CHANGE */}
                                {rk.item.item_type ?? "-"}
                              </td>
                              <td style={{ backgroundColor: roomBg }} className={td}> {/* CHANGE */}
                                {rk.item.count}
                              </td>
                              {canEdit ? (
                                <td style={{ backgroundColor: roomBg }} className={td}> {/* CHANGE */}
                                  <div className="flex gap-2">
                                    <button className={editButtonClass} type="button" onClick={() => startEdit(rk.item)}>
                                      修改
                                    </button>
                                    <button className={deleteButtonClass} type="button" onClick={() => void removeItem(rk.item)}>
                                      删除
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                            </>
                          )}
                        </tr>,
                      );
                    });
                  });

                  return trs;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}