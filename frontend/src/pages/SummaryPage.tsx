import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { fieldControlClass, primaryButtonClass } from "../components/FormField";
import { dormColorMap, REPORT_HEADER_FILL } from "../dormPalette";
import type { Allocation, Dorm, Person, Room } from "../types";
import { todayISO } from "../utils/date";
import { ErrorDialog } from "../components/ErrorDialog";

type SummaryRow = {
  rowKey: string;
  seq: number;
  dormId: number;
  dormName: string;
  name: string;
  department: string;
  title: string;
  room: string;
  moveInDate: string;
  note: string;
  isEmpty: boolean;
};

const COLUMNS: { key: keyof SummaryRow; header: string; width: number; align: "center" | "left" }[] = [
  { key: "seq", header: "序号", width: 6, align: "center" },
  { key: "dormName", header: "住址", width: 16, align: "center" },
  { key: "name", header: "姓名", width: 28, align: "left" },
  { key: "department", header: "部门", width: 18, align: "left" },
  { key: "title", header: "职称", width: 14, align: "center" },
  { key: "room", header: "房间", width: 18, align: "center" },
  { key: "moveInDate", header: "入住日期", width: 14, align: "center" },
  { key: "note", header: "备注", width: 22, align: "left" },
];

const isActiveStatus = (status?: string | null) => (status ?? "").trim().toLowerCase() === "active";

// CHANGE: Fixed report order inside each dorm: 主卧 1..n -> 次卧 1..n -> 客厅 1..n -> 地下室 -> 车库.
// Rooms whose name matches none of the groups keep their old alphabetical order after these groups.
const ROOM_GROUP_ORDER = ["主卧", "次卧", "客厅", "地下室", "车库"];

const roomSortKey = (roomName: string): { group: number; num: number; name: string } => {
  const name = roomName.trim();
  const groupIndex = ROOM_GROUP_ORDER.findIndex((prefix) => name.startsWith(prefix));
  const digits = name.match(/\d+/);
  return {
    group: groupIndex === -1 ? ROOM_GROUP_ORDER.length : groupIndex,
    num: digits ? Number.parseInt(digits[0], 10) : Number.MAX_SAFE_INTEGER,
    name,
  };
};

const compareRooms = (a: string, b: string): number => {
  const keyA = roomSortKey(a);
  const keyB = roomSortKey(b);
  if (keyA.group !== keyB.group) return keyA.group - keyB.group;
  if (keyA.num !== keyB.num) return keyA.num - keyB.num;
  return keyA.name.localeCompare(keyB.name, "zh-Hans-CN");
};

export function SummaryPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  // CHANGE: Drag-and-drop reordering state for the export table.
  const [orderedRows, setOrderedRows] = useState<SummaryRow[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragEnabledKey, setDragEnabledKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragError, setDragError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [peopleData, dormData, roomData, allocationData] = await Promise.all([
        api.getPeople(),
        api.getDorms(),
        api.getRooms(),
        api.getAllocations(),
      ]);
      setPeople(peopleData);
      setDorms(dormData);
      setRooms(roomData);
      setAllocations(allocationData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const dormColor = useMemo(() => dormColorMap(dorms), [dorms]);

  const rows = useMemo<SummaryRow[]>(() => {
    const peopleMap = new Map(people.map((person) => [person.id, person]));
    const activeByRoom = new Map<number, Allocation[]>();
    allocations
      .filter((allocation) => allocation.status === "active")
      .forEach((allocation) => {
        activeByRoom.set(allocation.room_id, [...(activeByRoom.get(allocation.room_id) ?? []), allocation]);
      });

    const result: SummaryRow[] = [];
    let seq = 0;
    dorms.forEach((dorm) => {
      const dormRooms = rooms
        .filter((room) => room.dorm_id === dorm.id)
        .sort((a, b) => compareRooms(a.room_name, b.room_name)); // CHANGE
      dormRooms.forEach((room) => {
        const occupants = activeByRoom.get(room.id) ?? [];
        occupants.forEach((allocation) => {
          const person = peopleMap.get(allocation.person_id);
          const tempLeave =
            allocation.temp_leave_start && allocation.temp_leave_end
              ? `临时空出 ${allocation.temp_leave_start} ~ ${allocation.temp_leave_end}`
              : "";
          seq += 1;
          result.push({
            rowKey: `alloc-${allocation.id}`,
            seq,
            dormId: dorm.id,
            dormName: dorm.name,
            name: person
              ? `${person.chinese_name}${person.english_name ? ` / ${person.english_name}` : ""}`
              : "",
            department: person?.department ?? "",
            title: "",
            room: room.room_name,
            moveInDate: allocation.check_in_date ?? "",
            note: [allocation.note, tempLeave].filter(Boolean).join("；"),
            isEmpty: false,

          });
        });
        const freeBeds = Math.max(room.bed_count - occupants.length, 0);
        for (let i = 0; i < freeBeds; i += 1) {
          seq += 1;
          result.push({
            rowKey: `empty-${room.id}-${i}`,
            seq,
            dormId: dorm.id,
            dormName: dorm.name,
            name: "",
            department: "",
            title: "",
            room: room.room_name,
            moveInDate: "",
            note: "空铺",
            isEmpty: true,

          });
        }
      });
    });
    return result;
  }, [allocations, dorms, people, rooms]);

  // CHANGE: Rows shown/exported follow the user's drag order; reset when data reloads.
  useEffect(() => {
    setOrderedRows(rows);
  }, [rows]);

  // CHANGE: Auto-dismiss the drag error after a few seconds.
  useEffect(() => {
    if (!dragError) return;
    const timer = setTimeout(() => setDragError(""), 4000);
    return () => clearTimeout(timer);
  }, [dragError]);

  const handleRowDrop = (targetKey: string) => {
    setDragOverKey(null);
    if (!dragKey || dragKey === targetKey) return;
    const source = orderedRows.find((row) => row.rowKey === dragKey);
    const target = orderedRows.find((row) => row.rowKey === targetKey);
    if (!source || !target) return;
    if (source.dormId !== target.dormId) {
      setDragError(`不能将「${source.dormName}」的记录拖拽到「${target.dormName}」，只能在同一宿舍内调整顺序。`);
      return;
    }
    setDragError("");
    setOrderedRows((prev) => {
      const next = prev.filter((row) => row.rowKey !== dragKey);
      const targetIndex = next.findIndex((row) => row.rowKey === targetKey);
      next.splice(targetIndex, 0, source);
      return next.map((row, index) => ({ ...row, seq: index + 1 }));
    });
  };

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return orderedRows;
    return orderedRows.filter((row) =>
      [row.dormName, row.name, row.department, row.title, row.room, row.moveInDate, row.note]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [orderedRows, search]);

  const occupiedCount = rows.filter((row) => !row.isEmpty).length;
  const emptyCount = rows.filter((row) => row.isEmpty).length;
  const activeDormCount = dorms.filter((dorm) => isActiveStatus(dorm.status)).length;

  const onExport = async () => {
    setError("");
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const { saveAs } = await import("file-saver");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("宿舍汇总");
      sheet.columns = COLUMNS.map((column) => ({ key: column.key, width: column.width }));

      const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
      const border = { top: thin, left: thin, bottom: thin, right: thin };

      // Header row
      const headerRow = sheet.addRow(COLUMNS.map((column) => column.header));
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${REPORT_HEADER_FILL}` } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = border;
      });

      // Data rows
      filteredRows.forEach((row) => {
        const excelRow = sheet.addRow(COLUMNS.map((column) => row[column.key]));
        const argb = `FF${dormColor.get(row.dormId)?.excel ?? "FFFFFF"}`; // CHANGE
        COLUMNS.forEach((column, index) => {
          const cell = excelRow.getCell(index + 1);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          cell.border = border;
          cell.alignment = { horizontal: column.align, vertical: "middle" };
          if (row.isEmpty && column.key === "note") {
            cell.font = { bold: true, color: { argb: "FFFF0000" } };
          } else if (column.key === "note" && row.note.includes("临时空出")) {
            cell.font = { bold: true, color: { argb: "FFD97706" } };
          }
        });
      });

      sheet.views = [{ state: "frozen", ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const stamp = todayISO();
      saveAs(new Blob([buffer], { type: "application/octet-stream" }), `宿舍汇总_${stamp}.xlsx`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">宿舍汇总报表</h2>
        <button className={primaryButtonClass} type="button" disabled={exporting || loading} onClick={() => void onExport()}>
          {exporting ? "导出中..." : "导出 Excel"}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        <span>宿舍数：{activeDormCount}</span>
        <span>在住人数：{occupiedCount}</span>
        <span>空铺：{emptyCount}</span>
      </div>

      <ErrorDialog message={error} onClose={() => setError("")} />
      {dragError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{dragError}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <div className="space-y-2">
          <input
            className={fieldControlClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索汇总记录"
          />
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  {COLUMNS.map((column) => (
                    <th key={column.key} className="px-3 py-2 font-semibold">
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={COLUMNS.length}>
                      没有匹配记录
                    </td>
                  </tr>
                ) : null}
                {filteredRows.map((row) => {
                  const color = dormColor.get(row.dormId); // CHANGE
                  // CHANGE: Drag state for this row.
                  const isDragging = dragKey === row.rowKey;
                  const isDragOver = dragOverKey === row.rowKey && dragKey !== row.rowKey;
                  const draggedRow = dragKey ? orderedRows.find((item) => item.rowKey === dragKey) : null;
                  const isInvalidTarget = isDragOver && draggedRow != null && draggedRow.dormId !== row.dormId;

                  return (
                    <tr
                      key={row.rowKey}
                      draggable={dragEnabledKey === row.rowKey} // CHANGE: Only draggable via the row handle.
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        setDragKey(row.rowKey);
                        setDragError("");
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverKey(row.rowKey);
                      }}
                      onDragLeave={() => {
                        setDragOverKey((current) => (current === row.rowKey ? null : current));
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleRowDrop(row.rowKey);
                      }}
                      onDragEnd={() => {
                        setDragKey(null);
                        setDragEnabledKey(null);
                        setDragOverKey(null);
                      }}
                      style={{
                        backgroundColor: isInvalidTarget ? "#fef2f2" : isDragOver ? "#eff6ff" : "#ffffff", // CHANGE
                        borderLeft: `5px solid ${color?.border ?? "#e5e7eb"}`, // CHANGE
                        opacity: isDragging ? 0.5 : 1, // CHANGE
                      }}
                    >
                      {COLUMNS.map((column) => (
                        <td
                          key={column.key}
                          className={`border border-slate-100 px-3 py-2 ${column.align === "center" ? "text-center" : "text-left"} ${
                            row.isEmpty && column.key === "note"
                              ? "font-bold text-red-600"
                              : column.key === "note" && row.note.includes("临时空出")
                                ? "font-semibold text-amber-600"
                                : "text-slate-800"
                          }`}
                        >
                          {column.key === "seq" ? ( // CHANGE: Row-head drag handle.
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="cursor-grab select-none text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                                title="按住拖拽调整顺序（仅限同一宿舍内）"
                                onMouseDown={() => setDragEnabledKey(row.rowKey)}
                                onMouseUp={() => setDragEnabledKey(null)}
                              >
                                ⠿
                              </span>
                              {row.seq}
                            </span>
                          ) : column.key === "dormName" ? ( // CHANGE
                            <span
                              className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold"
                              style={{
                                backgroundColor: color?.bg ?? "#f8fafc",
                                color: color?.text ?? "#334155",
                                borderColor: color?.border ?? "#e2e8f0",
                              }}
                            >
                              {row[column.key]}
                            </span>
                          ) : (
                            row[column.key]
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}