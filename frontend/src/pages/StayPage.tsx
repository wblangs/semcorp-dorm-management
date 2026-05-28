import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { DataTable } from "../components/DataTable";
import { useDictionaries } from "../hooks/useDictionaries";
import type { StayRecord } from "../types";

export function StayPage() {
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

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">签证与停留管理</h2>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
      >
        <select
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={form.person_id}
          onChange={(e) => setForm((f) => ({ ...f, person_id: e.target.value }))}
          required
        >
          {rows.map((row) => (
            <option key={row.person_id} value={row.person_id}>
              {row.person.chinese_name}/{row.person.english_name} (#{row.person_id})
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2"
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
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>赴美日期</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900"
            type="date"
            value={form.arrival_date}
            onChange={(e) => setForm((f) => ({ ...f, arrival_date: e.target.value }))}
            required
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>计划离美日期</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900"
            type="date"
            value={form.planned_leave_date}
            onChange={(e) => setForm((f) => ({ ...f, planned_leave_date: e.target.value }))}
            required
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>最大合法停留日期</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900"
            type="date"
            value={form.max_stay_date}
            onChange={(e) => setForm((f) => ({ ...f, max_stay_date: e.target.value }))}
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>实际离美日期</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900"
            type="date"
            value={form.actual_leave_date}
            onChange={(e) => setForm((f) => ({ ...f, actual_leave_date: e.target.value }))}
          />
        </label>
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
          placeholder="备注"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
        <button className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700" type="submit">
          保存 Stay
        </button>
      </form>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.person_id}
          columns={[
            {
              header: "人员",
              cell: (row) => `${row.person.chinese_name}/${row.person.english_name}`,
            },
            { header: "部门", cell: (row) => row.person.department },
            { header: "人员类型", cell: (row) => row.person.person_type },
            { header: "签证类型", cell: (row) => row.visa_type ?? "-" },
            { header: "赴美日期", cell: (row) => row.arrival_date ?? "-" },
            { header: "计划离美日期", cell: (row) => row.planned_leave_date ?? "-" },
            { header: "最大停留日期", cell: (row) => row.max_stay_date ?? "-" },
            { header: "实际离美日期", cell: (row) => row.actual_leave_date ?? "-" },
            {
              header: "剩余合法停留天数",
              cell: (row) => (row.remaining_legal_days === null ? "-" : row.remaining_legal_days),
            },
            {
              header: "风险等级",
              cell: (row) => (
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${riskBadgeClass(row.risk_level)}`}>
                  {row.risk_level}
                </span>
              ),
            },
            { header: "备注", cell: (row) => row.note ?? "-" },
            {
              header: "操作",
              cell: (row) => (
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, person_id: String(row.person_id) }))}
                  >
                    修改
                  </button>
                  <button
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    type="button"
                    onClick={async () => {
                      if (!row.id) return;
                      if (!confirm("确认删除该 Stay 记录？")) return;
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
                </div>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}
