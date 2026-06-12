import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { deleteButtonClass, editButtonClass, fieldControlClass, FormField, primaryButtonClass, secondaryButtonClass } from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Allocation, Dorm, Person, Room, StayRecord } from "../types";
import { todayISO } from "../utils/date";
import { ErrorDialog } from "../components/ErrorDialog";

const isActiveStatus = (status?: string | null) => (status ?? "").trim().toLowerCase() === "active";

type PersonFormState = {
  chinese_name: string;
  english_name: string;
  department: string;
  person_type: string;
  gender: "Male" | "Female";
};

type StayFormState = {
  visa_type: string;
  arrival_date: string;
  planned_leave_date: string;
  max_stay_date: string;
  actual_leave_date: string;
  note: string;
};

const emptyForm: PersonFormState = {
  chinese_name: "",
  english_name: "",
  department: "IT",
  person_type: "Employee",
  gender: "Male",
};

const emptyStayForm: StayFormState = {
  visa_type: "",
  arrival_date: "",
  planned_leave_date: "",
  max_stay_date: "",
  actual_leave_date: "",
  note: "",
};

export function PeoplePage() {
  const { canEdit } = useAuth();
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<Person[]>([]);
  const [stays, setStays] = useState<StayRecord[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [form, setForm] = useState<PersonFormState>(emptyForm);
  const [stayForm, setStayForm] = useState<StayFormState>(emptyStayForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [quickSelection, setQuickSelection] = useState<Record<number, string>>({});
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [peopleData, stayData, allocationData, roomData, dormData] = await Promise.all([
        api.getPeople(),
        api.getStays(),
        api.getAllocations(),
        api.getRooms(),
        api.getDorms(),
      ]);
      setRows(peopleData);
      setStays(stayData);
      setAllocations(allocationData);
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

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (editingId && !confirm("确认保存修改？")) return;
    setError("");
    try {
      let personId = editingId;
      if (editingId) {
        const updated = await api.updatePerson(editingId, form);
        personId = updated.id;
      } else {
        const created = await api.createPerson(form);
        personId = created.id;
      }
      const hasStayInput = Object.values(stayForm).some((value) => value.trim());
      if (personId && hasStayInput) {
        if (!stayForm.visa_type || !stayForm.arrival_date || !stayForm.planned_leave_date) {
          throw new Error("维护签证与停留时，签证类型、赴美日期、计划离美日期为必填");
        }
        await api.upsertStay({
          person_id: personId,
          visa_type: stayForm.visa_type,
          arrival_date: stayForm.arrival_date,
          planned_leave_date: stayForm.planned_leave_date,
          max_stay_date: stayForm.max_stay_date || null,
          actual_leave_date: stayForm.actual_leave_date || null,
          note: stayForm.note.trim() || null,
        });
      }
      setForm(emptyForm);
      setStayForm(emptyStayForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onEdit = (row: Person) => {
    const stay = stays.find((item) => item.person_id === row.id);
    setEditingId(row.id);
    setForm({
      chinese_name: row.chinese_name,
      english_name: row.english_name ?? "",
      department: row.department,
      person_type: row.person_type,
      gender: row.gender,
    });
    setStayForm({
      visa_type: stay?.visa_type ?? "",
      arrival_date: stay?.arrival_date ?? "",
      planned_leave_date: stay?.planned_leave_date ?? "",
      max_stay_date: stay?.max_stay_date ?? "",
      actual_leave_date: stay?.actual_leave_date ?? "",
      note: stay?.note ?? "",
    });
  };

  const onDelete = async (row: Person) => {
    if (!confirm(`确认删除人员 ${row.chinese_name}/${row.english_name || "-"}？`)) return;
    setError("");
    try {
      await api.deletePerson(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(emptyForm);
        setStayForm(emptyStayForm);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const departmentOptions = dictionaries.departments.some((option) => option.value === form.department) || !form.department
    ? dictionaries.departments
    : [
        ...dictionaries.departments,
        { label: `${form.department}（当前值未在字典中）`, value: form.department },
      ];

  const stayMap = new Map(stays.map((stay) => [stay.person_id, stay]));
  const activeAllocations = useMemo(
    () => allocations.filter((allocation) => allocation.status === "active"),
    [allocations],
  );
  const activeAllocationPersonIds = useMemo(
    () => new Set(activeAllocations.map((allocation) => allocation.person_id)),
    [activeAllocations],
  );
  const activeAllocationByPerson = useMemo(
    () => new Map(activeAllocations.map((allocation) => [allocation.person_id, allocation])),
    [activeAllocations],
  );
  const dormMap = useMemo(() => new Map(dorms.map((dorm) => [dorm.id, dorm.name])), [dorms]);
  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room.room_name])), [rooms]);

  const roomOccupancy = useMemo(() => {
    const counts = new Map<number, number>();
    activeAllocations.forEach((allocation) => {
      counts.set(allocation.room_id, (counts.get(allocation.room_id) ?? 0) + 1);
    });
    return counts;
  }, [activeAllocations]);

  const availableRooms = useMemo(() => {
    const activeDormIds = new Set(dorms.filter((dorm) => isActiveStatus(dorm.status)).map((dorm) => dorm.id));
    return rooms
      .filter((room) => activeDormIds.has(room.dorm_id) && isActiveStatus(room.status))
      .map((room) => ({
        ...room,
        dormName: dormMap.get(room.dorm_id) ?? "Unknown",
        available_beds: Math.max(room.bed_count - (roomOccupancy.get(room.id) ?? 0), 0),
      }))
      .filter((room) => room.available_beds > 0);
  }, [dormMap, dorms, roomOccupancy, rooms]);

  const availableRoomsForPerson = (person: Person) =>
    availableRooms.filter((room) => room.gender_limit === "Any" || room.gender_limit === person.gender);

  const onQuickAssign = async (person: Person, roomId: number) => {
    const room = availableRooms.find((item) => item.id === roomId);
    if (!room) return;
    setError("");
    setAssigningId(person.id);
    try {
      await api.createAllocation({
        person_id: person.id,
        dorm_id: room.dorm_id,
        room_id: room.id,
        check_in_date: todayISO(),
      });
      setQuickSelection((prev) => {
        const next = { ...prev };
        delete next[person.id];
        return next;
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAssigningId(null);
    }
  };

  const riskBadgeClass = (risk: StayRecord["risk_level"]) => {
    if (risk === "red") return "bg-red-100 text-red-700";
    if (risk === "yellow") return "bg-amber-100 text-amber-700";
    if (risk === "green") return "bg-emerald-100 text-emerald-700";
    return "bg-slate-100 text-slate-700";
  };

  const riskLabel = (risk: StayRecord["risk_level"]) => {
    if (risk === "red") return "red";
    if (risk === "yellow") return "yellow";
    if (risk === "green") return "green";
    return "未维护";
  };

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const stay = stayMap.get(row.id);
      const risk = riskLabel(stay?.risk_level ?? "unknown");
      const allocationStatus = activeAllocationPersonIds.has(row.id) ? "在住" : "未入住";
      return [
        row.id,
        row.chinese_name,
        row.english_name,
        row.department,
        row.person_type,
        row.gender,
        risk,
        allocationStatus,
        stay?.visa_type,
        stay?.arrival_date,
        stay?.planned_leave_date,
        stay?.max_stay_date,
        stay?.actual_leave_date,
        stay?.note,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [activeAllocationPersonIds, rows, search, stayMap]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">人员管理</h2>
      {canEdit ? (
      <>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <FormField label="中文名" required>
          <input className={fieldControlClass} value={form.chinese_name} onChange={(e) => setForm((f) => ({ ...f, chinese_name: e.target.value }))} required />
        </FormField>
        <FormField label="英文名">
          <input className={fieldControlClass} value={form.english_name} onChange={(e) => setForm((f) => ({ ...f, english_name: e.target.value }))} />
        </FormField>
        <FormField label="部门" required>
        <select className={fieldControlClass} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} required>
          <option value="">选择部门</option>
          {departmentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="人员类型" required>
        <select className={fieldControlClass} value={form.person_type} onChange={(e) => setForm((f) => ({ ...f, person_type: e.target.value }))} required>
          {dictionaries.personTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="性别" required>
        <select className={fieldControlClass} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as "Male" | "Female" }))} required>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        </FormField>
        <button className={primaryButtonClass} type="submit">
          {editingId ? "保存人员" : "新增人员"}
        </button>
        {editingId ? (
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setStayForm(emptyStayForm);
            }}
          >
            取消编辑
          </button>
        ) : null}
      </form>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">签证与停留</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField label="签证类型">
            <select className={fieldControlClass} value={stayForm.visa_type} onChange={(e) => setStayForm((f) => ({ ...f, visa_type: e.target.value }))}>
              <option value="">选择签证类型</option>
              {dictionaries.visaTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="赴美日期">
            <input className={fieldControlClass} type="date" value={stayForm.arrival_date} onChange={(e) => setStayForm((f) => ({ ...f, arrival_date: e.target.value }))} />
          </FormField>
          <FormField label="计划离美日期">
            <input className={fieldControlClass} type="date" value={stayForm.planned_leave_date} onChange={(e) => setStayForm((f) => ({ ...f, planned_leave_date: e.target.value }))} />
          </FormField>
          <FormField label="最大停留日期">
            <input className={fieldControlClass} type="date" value={stayForm.max_stay_date} onChange={(e) => setStayForm((f) => ({ ...f, max_stay_date: e.target.value }))} />
          </FormField>
          <FormField label="实际离美日期">
            <input className={fieldControlClass} type="date" value={stayForm.actual_leave_date} onChange={(e) => setStayForm((f) => ({ ...f, actual_leave_date: e.target.value }))} />
          </FormField>
          <FormField label="备注">
            <input className={fieldControlClass} value={stayForm.note} onChange={(e) => setStayForm((f) => ({ ...f, note: e.target.value }))} />
          </FormField>
        </div>
      </section>
      </>
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
            placeholder="搜索人员记录"
          />
        <DataTable
          rows={filteredRows}
          rowKey={(row) => row.id}
          emptyText="没有匹配记录"
          columns={[
            { header: "中文名", cell: (row) => row.chinese_name },
            { header: "英文名", cell: (row) => row.english_name || "-" },
            { header: "部门", cell: (row) => row.department },
            { header: "类型", cell: (row) => row.person_type },
            { header: "性别", cell: (row) => row.gender },
            {
              header: "停留风险",
              cell: (row) => {
                const risk = stayMap.get(row.id)?.risk_level ?? "unknown";
                return (
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${riskBadgeClass(risk)}`}>
                    {riskLabel(risk)}
                  </span>
                );
              },
            },
            {
              header: "当前住宿状态",
              cell: (row) => (activeAllocationPersonIds.has(row.id) ? "在住" : "未入住"),
            },
            {
              header: "快速入住",
              cell: (row) => {
                if (activeAllocationPersonIds.has(row.id)) {
                  const allocation = activeAllocationByPerson.get(row.id);
                  return (
                    <span className="text-slate-500">
                      {allocation
                        ? `${dormMap.get(allocation.dorm_id) ?? "?"} / ${roomMap.get(allocation.room_id) ?? "?"}`
                        : "在住"}
                    </span>
                  );
                }
                if (!canEdit) {
                  return <span className="text-slate-400">-</span>;
                }
                const roomChoices = availableRoomsForPerson(row);
                if (roomChoices.length === 0) {
                  return <span className="text-slate-400">暂无空房间</span>;
                }
                const selected = quickSelection[row.id] ?? String(roomChoices[0].id);
                return (
                  <div className="flex items-center gap-2">
                    <select
                      className={fieldControlClass}
                      value={selected}
                      onChange={(e) => setQuickSelection((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    >
                      {roomChoices.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.dormName} / {room.room_name}（{room.available_beds}）
                        </option>
                      ))}
                    </select>
                    <button
                      className={primaryButtonClass}
                      type="button"
                      disabled={assigningId === row.id}
                      onClick={() => void onQuickAssign(row, Number(selected))}
                    >
                      {assigningId === row.id ? "提交中..." : "入住"}
                    </button>
                  </div>
                );
              },
            },
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
