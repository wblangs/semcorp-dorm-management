import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { deleteButtonClass, editButtonClass, fieldControlClass, FormField, primaryButtonClass, secondaryButtonClass } from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Allocation, Person, StayRecord } from "../types";

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
  const { isAdmin } = useAuth();
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<Person[]>([]);
  const [stays, setStays] = useState<StayRecord[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [form, setForm] = useState<PersonFormState>(emptyForm);
  const [stayForm, setStayForm] = useState<StayFormState>(emptyStayForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [peopleData, stayData, allocationData] = await Promise.all([
        api.getPeople(),
        api.getStays(),
        api.getAllocations(),
      ]);
      setRows(peopleData);
      setStays(stayData);
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

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
  const activeAllocationPersonIds = new Set(
    allocations.filter((allocation) => allocation.status === "active").map((allocation) => allocation.person_id),
  );

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

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">人员管理</h2>
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

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
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
              header: "操作",
              cell: (row) => (
                <div className="flex gap-2">
                  <button className={editButtonClass} type="button" onClick={() => onEdit(row)}>
                    修改
                  </button>
                  {isAdmin ? (
                    <button className={deleteButtonClass} type="button" onClick={() => void onDelete(row)}>
                      删除
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}
