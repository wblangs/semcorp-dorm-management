import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { deleteButtonClass, editButtonClass, fieldControlClass, FormField, primaryButtonClass } from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import type { StayRecord } from "../types";

export function StayPage() {
  const { isAdmin } = useAuth();
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<StayRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    person_id: "",
    visa_type: "",
    arrival_date: "",
    planned_leave_date: "",
    max_stay_date: "",
    actual_leave_date: "",
    note: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getStays();
      setRows(data);
      if (!form.person_id && data[0]) {
        setForm((f) => ({ ...f, person_id: String(data[0].person_id) }));
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

  const selectedPersonStay = useMemo(
    () => rows.find((row) => String(row.person_id) === form.person_id) ?? null,
    [rows, form.person_id],
  );

  useEffect(() => {
    if (!selectedPersonStay) return;
    setForm((f) => ({
      ...f,
      visa_type: selectedPersonStay.visa_type ?? "",
      arrival_date: selectedPersonStay.arrival_date ?? "",
      planned_leave_date: selectedPersonStay.planned_leave_date ?? "",
      max_stay_date: selectedPersonStay.max_stay_date ?? "",
      actual_leave_date: selectedPersonStay.actual_leave_date ?? "",
      note: selectedPersonStay.note ?? "",
    }));
  }, [selectedPersonStay?.person_id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await api.upsertStay({
        person_id: Number(form.person_id),
        visa_type: form.visa_type,
        arrival_date: form.arrival_date,
        planned_leave_date: form.planned_leave_date,
        max_stay_date: form.max_stay_date || null,
        actual_leave_date: form.actual_leave_date || null,
        note: form.note.trim() || null,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
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

  const editStay = (row: StayRecord) => {
    setForm({
      person_id: String(row.person_id),
      visa_type: row.visa_type ?? "",
      arrival_date: row.arrival_date ?? "",
      planned_leave_date: row.planned_leave_date ?? "",
      max_stay_date: row.max_stay_date ?? "",
      actual_leave_date: row.actual_leave_date ?? "",
      note: row.note ?? "",
    });
  };

  const overstayedRows = rows.filter(
    (row) => row.remaining_legal_days !== null && row.remaining_legal_days < 0 && !row.actual_leave_date,
  );
  const expiring30Rows = rows.filter(
    (row) =>
      row.remaining_legal_days !== null &&
      row.remaining_legal_days >= 0 &&
      row.remaining_legal_days <= 30,
  );
  const expiring60Rows = rows.filter(
    (row) =>
      row.remaining_legal_days !== null &&
      row.remaining_legal_days > 30 &&
      row.remaining_legal_days <= 60,
  );
  const unknownRows = rows.filter((row) => row.risk_level === "unknown");

  const riskColumns = [
    {
      header: "人员",
      cell: (row: StayRecord) => `${row.person.chinese_name}/${row.person.english_name || "-"}`,
    },
    { header: "部门", cell: (row: StayRecord) => row.person.department },
    { header: "签证类型", cell: (row: StayRecord) => row.visa_type ?? "-" },
    { header: "赴美日期", cell: (row: StayRecord) => row.arrival_date ?? "-" },
    { header: "计划离美日期", cell: (row: StayRecord) => row.planned_leave_date ?? "-" },
    { header: "最大停留日期", cell: (row: StayRecord) => row.max_stay_date ?? "-" },
    {
      header: "剩余合法停留天数",
      cell: (row: StayRecord) => (row.remaining_legal_days === null ? "-" : row.remaining_legal_days),
    },
    {
      header: "风险等级",
      cell: (row: StayRecord) => (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${riskBadgeClass(row.risk_level)}`}>
          {riskLabel(row.risk_level)}
        </span>
      ),
    },
    {
      header: "操作",
      cell: (row: StayRecord) => (
        <div className="flex gap-2">
          <button className={editButtonClass} type="button" onClick={() => editStay(row)}>
            修改
          </button>
          {isAdmin ? (
            <button
              className={deleteButtonClass}
              type="button"
              disabled={!row.id}
              onClick={async () => {
                if (!row.id) return;
                if (!confirm("确认删除该停留记录？")) return;
                try {
                  await api.deleteStay(row.id);
                  await load();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              删除
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">停留风险</h2>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
      >
        <FormField label="人员" required>
        <select
          className={fieldControlClass}
          value={form.person_id}
          onChange={(e) => setForm((f) => ({ ...f, person_id: e.target.value }))}
          required
        >
          {rows.map((row) => (
            <option key={row.person_id} value={row.person_id}>
              {row.person.chinese_name}/{row.person.english_name || "-"} (#{row.person_id})
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="签证类型" required>
        <select
          className={fieldControlClass}
          value={form.visa_type}
          onChange={(e) => setForm((f) => ({ ...f, visa_type: e.target.value }))}
          required
        >
          <option value="">选择签证类型</option>
          {dictionaries.visaTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        </FormField>
        <FormField label="赴美日期" required>
          <input
            className={fieldControlClass}
            type="date"
            value={form.arrival_date}
            onChange={(e) => setForm((f) => ({ ...f, arrival_date: e.target.value }))}
            required
          />
        </FormField>
        <FormField label="计划离美日期" required>
          <input
            className={fieldControlClass}
            type="date"
            value={form.planned_leave_date}
            onChange={(e) => setForm((f) => ({ ...f, planned_leave_date: e.target.value }))}
            required
          />
        </FormField>
        <FormField label="最大停留日期">
          <input
            className={fieldControlClass}
            type="date"
            value={form.max_stay_date}
            onChange={(e) => setForm((f) => ({ ...f, max_stay_date: e.target.value }))}
          />
        </FormField>
        <FormField label="实际离美日期">
          <input
            className={fieldControlClass}
            type="date"
            value={form.actual_leave_date}
            onChange={(e) => setForm((f) => ({ ...f, actual_leave_date: e.target.value }))}
          />
        </FormField>
        <FormField label="备注" className="md:col-span-2">
          <input
            className={fieldControlClass}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </FormField>
        <button className={primaryButtonClass} type="submit">
          保存风险处理信息
        </button>
      </form>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <div className="space-y-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">已超期</h3>
            <DataTable rows={overstayedRows} rowKey={(row) => `over-${row.person_id}`} columns={riskColumns} />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">30天内到期</h3>
            <DataTable rows={expiring30Rows} rowKey={(row) => `30-${row.person_id}`} columns={riskColumns} />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">60天内到期</h3>
            <DataTable rows={expiring60Rows} rowKey={(row) => `60-${row.person_id}`} columns={riskColumns} />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">未维护最大停留日期</h3>
            <DataTable rows={unknownRows} rowKey={(row) => `unknown-${row.person_id}`} columns={riskColumns} />
          </section>
        </div>
      )}
    </section>
  );
}
