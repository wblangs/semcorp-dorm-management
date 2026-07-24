import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { ErrorDialog } from "../components/ErrorDialog";
import {
  deleteButtonClass,
  editButtonClass,
  fieldControlClass,
  FormField,
  primaryButtonClass,
  secondaryButtonClass,
} from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Dorm, UtilityBill, UtilityBillRecipient } from "../types";
import { todayISO } from "../utils/date";

type BillFormState = {
  dorm_id: string;
  fee_type: string;
  due_date: string;
  account: string;
  amount: string;
  note: string;
  remind_enabled: boolean;
};

const emptyForm: BillFormState = {
  dorm_id: "",
  fee_type: "房租",
  due_date: "",
  account: "",
  amount: "",
  note: "",
  remind_enabled: true,
};


export function UtilityBillsPage() {
  const { canEdit } = useAuth();
  const dictionaries = useDictionaries();
  const [rows, setRows] = useState<UtilityBill[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [recipients, setRecipients] = useState<UtilityBillRecipient[]>([]);
  const [form, setForm] = useState<BillFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [billData, dormData, recipientData] = await Promise.all([
        api.getUtilityBills(),
        api.getDorms(),
        api.getUtilityBillRecipients(),
      ]);
      setRows(billData);
      setDorms(dormData);
      setRecipients(recipientData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payloadFromForm = () => ({
    dorm_id: Number(form.dorm_id),
    fee_type: form.fee_type,
    due_date: form.due_date,
    account: form.account.trim() || null,
    amount: form.amount === "" ? null : Number(form.amount),
    note: form.note.trim() || null,
    remind_enabled: form.remind_enabled,
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (editingId && !confirm("确认保存修改？")) return;
    setError("");
    try {
      if (editingId) {
        await api.updateUtilityBill(editingId, payloadFromForm());
      } else {
        await api.createUtilityBill(payloadFromForm());
      }
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onEdit = (row: UtilityBill) => {
    setEditingId(row.id);
    setForm({
      dorm_id: String(row.dorm_id),
      fee_type: row.fee_type,
      due_date: row.due_date,
      account: row.account ?? "",
      amount: row.amount === null ? "" : String(row.amount),
      note: row.note ?? "",
      remind_enabled: row.remind_enabled,
    });
  };

  const onDelete = async (row: UtilityBill) => {
    if (!confirm(`确认删除 ${dormMap.get(row.dorm_id) ?? ""} ${row.fee_type}（${row.due_date}）？`)) return;
    setError("");
    try {
      await api.deleteUtilityBill(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const dormMap = useMemo(() => new Map(dorms.map((dorm) => [dorm.id, dorm.name])), [dorms]);
  const today = todayISO();

  const daysUntil = (dueDate: string) =>
    Math.round((new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);

  const dueBadge = (row: UtilityBill) => {
    const days = daysUntil(row.due_date);
    if (days < 0) return <span className="font-semibold text-red-600">已逾期 {-days} 天</span>;
    if (days === 0) return <span className="font-semibold text-red-600">今天到期</span>;
    if (days <= 3) return <span className="font-semibold text-amber-600">{days} 天后</span>;
    return <span className="text-slate-600">{days} 天后</span>;
  };

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (monthFilter && !row.due_date.startsWith(monthFilter)) return false;
      if (!keyword) return true;
      return [
        dormMap.get(row.dorm_id),
        row.fee_type,
        row.account,
        row.due_date,
        row.amount,
        row.note,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [dormMap, monthFilter, rows, search]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">水电网气房费</h2>

      {canEdit ? (
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
        >
          <FormField label="宿舍" required>
            <select
              className={fieldControlClass}
              value={form.dorm_id}
              onChange={(e) => setForm((f) => ({ ...f, dorm_id: e.target.value }))}
              required
            >
              <option value="">选择宿舍</option>
              {dorms.map((dorm) => (
                <option key={dorm.id} value={dorm.id}>
                  {dorm.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="缴费类型" required>
            <select
              className={fieldControlClass}
              value={form.fee_type}
              onChange={(e) => setForm((f) => ({ ...f, fee_type: e.target.value }))}
              required
            >
              {dictionaries.feeTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="缴费日期" required>
            <input
              className={fieldControlClass}
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="宿舍账号">
            <input
              className={fieldControlClass}
              value={form.account}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
              placeholder="手写账号备注，选填"
            />
          </FormField>
          <FormField label="金额">
            <input
              className={fieldControlClass}
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="选填"
            />
          </FormField>
          <FormField label="是否需要提醒">
            <select
              className={fieldControlClass}
              value={form.remind_enabled ? "yes" : "no"}
              onChange={(e) => setForm((f) => ({ ...f, remind_enabled: e.target.value === "yes" }))}
            >
              <option value="yes">需要提醒（前 3 天早上 9 点）</option>
              <option value="no">不提醒</option>
            </select>
          </FormField>
          <FormField label="备注">
            <input
              className={fieldControlClass}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </FormField>
          <button className={primaryButtonClass} type="submit">
            {editingId ? "保存缴费项" : "新增缴费项"}
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
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              className={fieldControlClass}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索缴费记录"
            />
            <input
              className={`${fieldControlClass} md:w-48`}
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              title="按月份筛选缴费日期"
            />
          </div>
          <DataTable
            rows={filteredRows}
            rowKey={(row) => row.id}
            emptyText="没有匹配记录"
            columns={[
              { header: "宿舍", cell: (row) => dormMap.get(row.dorm_id) ?? "Unknown" },
              { header: "类型", cell: (row) => row.fee_type },
              { header: "宿舍账号", cell: (row) => row.account ?? "-" },
              { header: "缴费日期", cell: (row) => row.due_date },
              { header: "距到期", cell: dueBadge },
              { header: "金额", cell: (row) => (row.amount === null ? "-" : row.amount) },
              {
                header: "钉钉提醒",
                cell: (row) =>
                  !row.remind_enabled ? (
                    <span className="text-slate-400">不提醒</span>
                  ) : row.reminded_on ? (
                    <span className="text-emerald-700">已提醒 {row.reminded_on}</span>
                  ) : (
                    <span className="text-amber-600">待提醒</span>
                  ),
              },
              { header: "备注", cell: (row) => row.note ?? "-" },
              {
                header: "操作",
                cell: (row) => (
                  <div className="flex flex-wrap gap-2">
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">钉钉提醒设置</h3>
        <p className="mt-1 text-sm text-slate-500">
          开启了「需要提醒」的缴费项，系统会在缴费日期
          <span className="font-semibold text-slate-700">前 3 天的早上 9 点</span>
          自动发送钉钉工作通知（每条缴费项只提醒一次，修改日期后会重新提醒）。
          接收人在<span className="font-semibold text-slate-700">用户管理</span>
          中为用户开启「接收缴费钉钉提醒」来设置，且需要用钉钉登录过本系统一次完成绑定。
        </p>
        <div className="mt-3 text-sm text-slate-600">
          当前接收人：
          {recipients.length === 0
            ? "未设置（请到用户管理中为用户开启「接收缴费钉钉提醒」）"
            : recipients
                .map((item) => `${item.display_name || item.username}${item.has_dingtalk ? "" : "（未绑定钉钉）"}`)
                .join("、")}
        </div>
      </div>
    </section>
  );
}
