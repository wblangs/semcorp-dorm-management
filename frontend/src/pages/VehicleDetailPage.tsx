import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import {
  deleteButtonClass,
  editButtonClass,
  fieldControlClass,
  FormField,
  primaryButtonClass,
  secondaryButtonClass,
} from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import type { Dorm, InsurancePolicy, Person, VehicleAccident, VehicleDetail, VehicleMaintenance, VehicleRepair } from "../types";
import {
  claimStatusOptions,
  driverRoleOptions,
  dueDateClass,
  labelOf,
  ownershipOptions,
  paidByOptions,
  policyStatusOptions,
  repairStatusOptions,
  vehicleStatusOptions,
} from "../vehicleConstants";
import { todayISO } from "../utils/date";
import { ErrorDialog } from "../components/ErrorDialog";

const TABS = [
  { key: "drivers", label: "挂靠人" },
  { key: "policies", label: "保险" },
  { key: "maintenances", label: "保养" },
  { key: "repairs", label: "修理" },
  { key: "accidents", label: "事故理赔" },
  { key: "assignments", label: "宿舍调拨" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const numOrNull = (value: string) => (value.trim() === "" ? null : Number(value));
const money = (value: number | null | undefined) => (value != null ? `$${value.toLocaleString()}` : "-");

export function VehicleDetailPage() {
  const { vehicleId } = useParams();
  const id = Number(vehicleId);
  const { canEdit, isAdmin } = useAuth();
  const dictionaries = useDictionaries();
  const [detail, setDetail] = useState<VehicleDetail | null>(null);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [tab, setTab] = useState<TabKey>("drivers");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [detailData, dormData, peopleData] = await Promise.all([
        api.getVehicleDetail(id),
        api.getDorms(),
        api.getPeople(),
      ]);
      setDetail(detailData);
      setDorms(dormData);
      setPeople(peopleData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const dormMap = useMemo(() => new Map(dorms.map((dorm) => [dorm.id, dorm.name])), [dorms]);
  const personMap = useMemo(() => new Map(people.map((person) => [person.id, person.chinese_name])), [people]);

  const showWarnings = (warnings: string[]) => {
    if (warnings.length > 0) setNotice(warnings.join("\n"));
  };

  const onUpdateOdometer = async () => {
    if (!detail) return;
    const input = prompt("输入当前里程 (miles)", detail.vehicle.odometer != null ? String(detail.vehicle.odometer) : "");
    if (input === null) return;
    const value = Number(input);
    if (!Number.isFinite(value) || value < 0) {
      setError("里程必须是非负数字");
      return;
    }
    try {
      await api.updateVehicleOdometer(id, value);
      await load();
    } catch (err) {
      const message = (err as Error).message;
      // 409: 新里程小于当前里程，需要二次确认（换表/录错场景）。
      if (message.includes("小于当前里程") && confirm(`${message}\n\n仍要保存吗？`)) {
        await api.updateVehicleOdometer(id, value, true);
        await load();
      } else {
        setError(message);
      }
    }
  };

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>;
  if (!detail) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error || "车辆不存在"}</div>;

  const vehicle = detail.vehicle;
  const statusChipClass =
    vehicle.status === "available"
      ? "bg-emerald-100 text-emerald-700"
      : vehicle.status === "in_repair"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-200 text-slate-600";

  const heroStats: { label: string; value: string; className?: string; sub?: string }[] = [
    {
      label: "保险到期",
      value: vehicle.insurance_expire_date ?? "未上保险",
      className: vehicle.insurance_expire_date ? dueDateClass(vehicle.insurance_expire_date) : "font-semibold text-rose-600",
    },
    { label: "年检到期", value: vehicle.inspection_expire_date ?? "-", className: dueDateClass(vehicle.inspection_expire_date) },
    { label: "注册到期", value: vehicle.registration_expire_date ?? "-", className: dueDateClass(vehicle.registration_expire_date) },
    {
      label: "下次保养",
      value: vehicle.maintenance_due_date ?? "-",
      className: dueDateClass(vehicle.maintenance_due_date),
      sub: vehicle.maintenance_due_mileage != null ? `或 ${vehicle.maintenance_due_mileage.toLocaleString()} mi` : undefined,
    },
    {
      label: "当前里程",
      value: vehicle.odometer != null ? `${vehicle.odometer.toLocaleString()} mi` : "-",
      sub: vehicle.odometer_updated_on ? `更新于 ${vehicle.odometer_updated_on}` : undefined,
    },
  ];
  if (vehicle.ownership_type === "leased") {
    heroStats.push({
      label: "租赁合同到期",
      value: vehicle.lease_end_date ?? "-",
      className: dueDateClass(vehicle.lease_end_date, 60),
      sub: vehicle.lease_monthly_fee != null ? `${vehicle.lease_company ?? ""} $${vehicle.lease_monthly_fee}/月` : vehicle.lease_company ?? undefined,
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link to="/vehicles" className="text-indigo-600 hover:underline">车辆管理</Link>
        <span>/</span>
        <span>{vehicle.plate_number}</span>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{vehicle.plate_number}</h2>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChipClass}`}>
            {labelOf(vehicleStatusOptions, vehicle.status)}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {labelOf(ownershipOptions, vehicle.ownership_type)}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {vehicle.vehicle_type ?? "-"} · {vehicle.seat_count} 座
          </span>
          <span className="ml-auto" />
          {canEdit ? (
            <button className={secondaryButtonClass} type="button" onClick={() => void onUpdateOdometer()}>更新里程</button>
          ) : null}
        </div>
        <p className="text-sm text-slate-500">
          {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "品牌车型未填"}
          {vehicle.model_year ? ` ${vehicle.model_year}` : ""}
          {vehicle.color ? ` · ${vehicle.color}` : ""}
          {vehicle.vin ? ` · VIN ${vehicle.vin}` : ""}
          {" · "}
          常驻 {vehicle.base_dorm_id ? dormMap.get(vehicle.base_dorm_id) ?? "?" : "未分配"}
          {" · "}
          保养间隔 {vehicle.effective_interval_miles.toLocaleString()} mi / {vehicle.effective_interval_months} 个月
          {vehicle.note ? ` · 备注：${vehicle.note}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-3 xl:grid-cols-6">
          {heroStats.map((stat) => (
            <div key={stat.label} className="bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</p>
              <p className={`mt-0.5 text-base font-semibold ${stat.className ?? "text-slate-800"}`}>{stat.value}</p>
              {stat.sub ? <p className="text-xs text-slate-400">{stat.sub}</p> : null}
            </div>
          ))}
        </div>
        {detail.driver_warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {detail.driver_warnings.map((warning) => (
              <p key={warning}>⚠ {warning}</p>
            ))}
          </div>
        ) : null}
      </div>

      <ErrorDialog message={error} onClose={() => setError("")} />
      {notice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {notice.split("\n").map((line) => (
            <p key={line}>⚠ {line}</p>
          ))}
          <button className="mt-1 text-xs font-medium text-amber-700 underline" type="button" onClick={() => setNotice("")}>
            知道了
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 pt-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm font-medium transition ${
                tab === item.key ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {item.label}
              <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === item.key ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                {item.key === "drivers" ? detail.drivers.length : detail[item.key].length}
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-4 p-4">
          {tab === "drivers" ? (
            <DriversTab detail={detail} people={people} isAdmin={isAdmin} reload={load} onError={setError} onWarnings={showWarnings} />
          ) : null}
          {tab === "policies" ? (
            <PoliciesTab detail={detail} isAdmin={isAdmin} reload={load} onError={setError} onWarnings={showWarnings} dictionaries={dictionaries} />
          ) : null}
          {tab === "maintenances" ? (
            <MaintenancesTab detail={detail} canEdit={canEdit} isAdmin={isAdmin} reload={load} onError={setError} dictionaries={dictionaries} />
          ) : null}
          {tab === "repairs" ? (
            <RepairsTab detail={detail} canEdit={canEdit} isAdmin={isAdmin} reload={load} onError={setError} />
          ) : null}
          {tab === "accidents" ? (
            <AccidentsTab detail={detail} canEdit={canEdit} isAdmin={isAdmin} reload={load} onError={setError} onWarnings={showWarnings} personMap={personMap} people={people} dictionaries={dictionaries} />
          ) : null}
          {tab === "assignments" ? (
            <AssignmentsTab detail={detail} dorms={dorms} dormMap={dormMap} canEdit={canEdit} reload={load} onError={setError} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ---------------- 挂靠人 ----------------

function DriversTab({
  detail,
  people,
  isAdmin,
  reload,
  onError,
  onWarnings,
}: {
  detail: VehicleDetail;
  people: Person[];
  isAdmin: boolean;
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onWarnings: (warnings: string[]) => void;
}) {
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState<"primary" | "secondary">("secondary");

  const activeIds = new Set(detail.drivers.map((driver) => driver.person_id));
  const candidates = people.filter((person) => !activeIds.has(person.id));

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!personId) return;
    try {
      const result = await api.addVehicleDriver(detail.vehicle.id, { person_id: Number(personId), role });
      onWarnings(result.warnings);
      setPersonId("");
      setRole("secondary");
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  const onRemove = async (driverId: number, name: string) => {
    if (!confirm(`确认解除 ${name} 的挂靠？记录将保留在历史中`)) return;
    try {
      await api.removeVehicleDriver(driverId);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  return (
    <>
      {isAdmin ? (
        <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <FormField label="人员" className="min-w-48">
            <select className={fieldControlClass} value={personId} onChange={(e) => setPersonId(e.target.value)} required>
              <option value="">选择人员</option>
              {candidates.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.chinese_name}（{person.department}）
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="角色">
            <select className={fieldControlClass} value={role} onChange={(e) => setRole(e.target.value as "primary" | "secondary")}>
              {driverRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FormField>
          <button className={primaryButtonClass} type="submit">新增挂靠</button>
          <span className="text-xs text-slate-500">每车最多 2 人，主要驾驶人最多 1 人；驾照缺失/过期会警告放行</span>
        </form>
      ) : (
        <p className="text-xs text-slate-500">挂靠人增减仅 admin 可操作；驾照信息在人员管理页维护。</p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {detail.drivers.map((driver) => (
          <div key={driver.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{driver.person?.chinese_name ?? "?"}</span>
              <span className="text-xs text-slate-500">{driver.person?.department}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${driver.role === "primary" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-600"}`}>
                {labelOf(driverRoleOptions, driver.role)}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">驾照号</dt>
              <dd>{driver.license?.license_number ?? <span className="text-amber-600">未维护</span>}</dd>
              <dt className="text-slate-500">签发州/类别</dt>
              <dd>{driver.license ? `${driver.license.license_state ?? "-"} · ${driver.license.license_class ?? "-"}` : "-"}</dd>
              <dt className="text-slate-500">驾照到期</dt>
              <dd className={dueDateClass(driver.license?.expire_date)}>{driver.license?.expire_date ?? "-"}</dd>
              <dt className="text-slate-500">挂靠起始</dt>
              <dd>{driver.start_date ?? "-"}</dd>
            </dl>
            {isAdmin ? (
              <button className={`${deleteButtonClass} mt-3`} type="button" onClick={() => void onRemove(driver.id, driver.person?.chinese_name ?? "?")}>
                解除挂靠
              </button>
            ) : null}
          </div>
        ))}
        {detail.drivers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-rose-300 bg-rose-50/50 p-6 text-center text-sm text-rose-600 md:col-span-2">
            该车尚未挂靠被保险人
          </div>
        ) : null}
      </div>

      <h4 className="text-sm font-semibold text-slate-700">挂靠历史</h4>
      <DataTable
        rows={detail.driver_history}
        rowKey={(row) => row.id}
        emptyText="暂无记录"
        columns={[
          { header: "人员", cell: (row) => row.person?.chinese_name ?? "?" },
          { header: "角色", cell: (row) => labelOf(driverRoleOptions, row.role) },
          { header: "起始", cell: (row) => row.start_date ?? "-" },
          { header: "结束", cell: (row) => row.end_date ?? "-" },
          {
            header: "状态",
            cell: (row) =>
              row.status === "active" ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">挂靠中</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">已解除</span>
              ),
          },
          { header: "备注", cell: (row) => row.note ?? "-" },
        ]}
      />
    </>
  );
}

// ---------------- 保险 ----------------

type PolicyFormState = {
  insurer: string;
  policy_number: string;
  coverage_type: string;
  coverage_amount: string;
  deductible: string;
  premium: string;
  premium_cycle: string;
  start_date: string;
  end_date: string;
  attachment_note: string;
  note: string;
};

const emptyPolicyForm: PolicyFormState = {
  insurer: "",
  policy_number: "",
  coverage_type: "",
  coverage_amount: "",
  deductible: "",
  premium: "",
  premium_cycle: "年",
  start_date: "",
  end_date: "",
  attachment_note: "",
  note: "",
};

function PoliciesTab({
  detail,
  isAdmin,
  reload,
  onError,
  onWarnings,
  dictionaries,
}: {
  detail: VehicleDetail;
  isAdmin: boolean;
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onWarnings: (warnings: string[]) => void;
  dictionaries: ReturnType<typeof useDictionaries>;
}) {
  const [form, setForm] = useState<PolicyFormState>(emptyPolicyForm);
  const [showForm, setShowForm] = useState(false);

  const current = detail.policies.find((policy) => policy.status === "active");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await api.createVehiclePolicy(detail.vehicle.id, {
        insurer: form.insurer.trim(),
        policy_number: form.policy_number.trim() || null,
        coverage_type: form.coverage_type || null,
        coverage_amount: numOrNull(form.coverage_amount),
        deductible: numOrNull(form.deductible),
        premium: numOrNull(form.premium),
        premium_cycle: form.premium_cycle.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date,
        attachment_note: form.attachment_note.trim() || null,
        note: form.note.trim() || null,
      });
      onWarnings(result.warnings);
      setForm(emptyPolicyForm);
      setShowForm(false);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  const onDelete = async (policy: InsurancePolicy) => {
    if (!confirm(`确认删除保单 ${policy.policy_number ?? policy.insurer}？`)) return;
    try {
      await api.deleteVehiclePolicy(policy.id);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  return (
    <>
      {current ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-800">当前保单</h4>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">生效中</span>
            <span className="ml-auto text-xs text-slate-500">登记续保后本张自动转为「已到期」</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
            <div><p className="text-xs text-slate-400">保险公司</p><p className="font-medium">{current.insurer}</p></div>
            <div><p className="text-xs text-slate-400">保单号</p><p className="font-medium">{current.policy_number ?? "-"}</p></div>
            <div><p className="text-xs text-slate-400">险种</p><p className="font-medium">{current.coverage_type ?? "-"}</p></div>
            <div><p className="text-xs text-slate-400">保额 / 免赔</p><p className="font-medium">{money(current.coverage_amount)} / {money(current.deductible)}</p></div>
            <div><p className="text-xs text-slate-400">保费</p><p className="font-medium">{money(current.premium)}{current.premium_cycle ? ` / ${current.premium_cycle}` : ""}</p></div>
            <div><p className="text-xs text-slate-400">起保 → 到期</p><p className="font-medium">{current.start_date} → <span className={dueDateClass(current.end_date)}>{current.end_date}</span></p></div>
            <div><p className="text-xs text-slate-400">承保驾驶人（快照）</p><p className="font-medium">{current.driver_snapshot ?? "-"}</p></div>
            <div><p className="text-xs text-slate-400">保单文件</p><p className="font-medium">{current.attachment_note ?? "-"}</p></div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-rose-300 bg-rose-50/50 p-4 text-center text-sm text-rose-600">
          该车没有生效中的保单
        </div>
      )}

      {isAdmin ? (
        <div>
          <button className={primaryButtonClass} type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "收起" : current ? "登记续保" : "登记保单"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">保单登记与续保仅 admin 可操作。</p>
      )}

      {isAdmin && showForm ? (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
          <FormField label="保险公司" required>
            <input className={fieldControlClass} value={form.insurer} onChange={(e) => setForm((f) => ({ ...f, insurer: e.target.value }))} required />
          </FormField>
          <FormField label="保单号">
            <input className={fieldControlClass} value={form.policy_number} onChange={(e) => setForm((f) => ({ ...f, policy_number: e.target.value }))} />
          </FormField>
          <FormField label="险种">
            <select className={fieldControlClass} value={form.coverage_type} onChange={(e) => setForm((f) => ({ ...f, coverage_type: e.target.value }))}>
              <option value="">选择险种</option>
              {dictionaries.insuranceCoverageTypes.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="保额 ($)">
            <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.coverage_amount} onChange={(e) => setForm((f) => ({ ...f, coverage_amount: e.target.value }))} />
          </FormField>
          <FormField label="免赔额 ($)">
            <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.deductible} onChange={(e) => setForm((f) => ({ ...f, deductible: e.target.value }))} />
          </FormField>
          <FormField label="保费 ($)">
            <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))} />
          </FormField>
          <FormField label="缴费周期">
            <input className={fieldControlClass} value={form.premium_cycle} placeholder="年 / 半年 / 月" onChange={(e) => setForm((f) => ({ ...f, premium_cycle: e.target.value }))} />
          </FormField>
          <FormField label="起保日" required>
            <input className={fieldControlClass} type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} required />
          </FormField>
          <FormField label="到期日" required>
            <input className={fieldControlClass} type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} required />
          </FormField>
          <FormField label="保单文件位置">
            <input className={fieldControlClass} placeholder="如共享盘路径（附件上传暂不做）" value={form.attachment_note} onChange={(e) => setForm((f) => ({ ...f, attachment_note: e.target.value }))} />
          </FormField>
          <FormField label="备注" className="md:col-span-2">
            <input className={fieldControlClass} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </FormField>
          <div className="flex items-end gap-2 md:col-span-4">
            <button className={primaryButtonClass} type="submit">保存保单</button>
            <span className="text-xs text-slate-500">保存后旧保单自动转为「已到期」，承保驾驶人按当前挂靠人快照记录</span>
          </div>
        </form>
      ) : null}

      <h4 className="text-sm font-semibold text-slate-700">续保历史</h4>
      <DataTable
        rows={detail.policies}
        rowKey={(row) => row.id}
        emptyText="暂无保单记录"
        columns={[
          { header: "保险公司", cell: (row) => row.insurer },
          { header: "保单号", cell: (row) => row.policy_number ?? "-" },
          { header: "险种", cell: (row) => row.coverage_type ?? "-" },
          { header: "保费", cell: (row) => money(row.premium) },
          { header: "起保", cell: (row) => row.start_date },
          { header: "到期", cell: (row) => <span className={row.status === "active" ? dueDateClass(row.end_date) : undefined}>{row.end_date}</span> },
          { header: "承保驾驶人", cell: (row) => row.driver_snapshot ?? "-" },
          {
            header: "状态",
            cell: (row) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {labelOf(policyStatusOptions, row.status)}
              </span>
            ),
          },
          {
            header: "操作",
            cell: (row) =>
              isAdmin ? (
                <button className={deleteButtonClass} type="button" onClick={() => void onDelete(row)}>删除</button>
              ) : (
                <span className="text-slate-400">-</span>
              ),
          },
        ]}
      />
    </>
  );
}

// ---------------- 保养 ----------------

type MaintenanceFormState = {
  maintenance_date: string;
  odometer: string;
  items: string[];
  vendor: string;
  cost: string;
  invoice_no: string;
  note: string;
};

function MaintenancesTab({
  detail,
  canEdit,
  isAdmin,
  reload,
  onError,
  dictionaries,
}: {
  detail: VehicleDetail;
  canEdit: boolean;
  isAdmin: boolean;
  reload: () => Promise<void>;
  onError: (message: string) => void;
  dictionaries: ReturnType<typeof useDictionaries>;
}) {
  const emptyMaintenanceForm: MaintenanceFormState = {
    maintenance_date: todayISO(),
    odometer: "",
    items: [],
    vendor: "",
    cost: "",
    invoice_no: "",
    note: "",
  };
  const [form, setForm] = useState<MaintenanceFormState>(emptyMaintenanceForm);
  const [showForm, setShowForm] = useState(false);

  const toggleItem = (value: string) => {
    setForm((f) => ({
      ...f,
      items: f.items.includes(value) ? f.items.filter((item) => item !== value) : [...f.items, value],
    }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.createVehicleMaintenance(detail.vehicle.id, {
        maintenance_date: form.maintenance_date,
        odometer: numOrNull(form.odometer),
        items: form.items.join("，") || null,
        vendor: form.vendor.trim() || null,
        cost: numOrNull(form.cost),
        invoice_no: form.invoice_no.trim() || null,
        next_due_date: null,
        next_due_mileage: null,
        note: form.note.trim() || null,
      });
      setForm(emptyMaintenanceForm);
      setShowForm(false);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  const onDelete = async (row: VehicleMaintenance) => {
    if (!confirm(`确认删除 ${row.maintenance_date} 的保养记录？下次保养到期会重新按剩余记录推算`)) return;
    try {
      await api.deleteVehicleMaintenance(row.id);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  return (
    <>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <button className={primaryButtonClass} type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "收起" : "新增保养"}
          </button>
          <span className="text-xs text-slate-500">
            保存后按「保养日期 + {detail.vehicle.effective_interval_months} 个月 / 里程 + {detail.vehicle.effective_interval_miles.toLocaleString()} mi」自动推算下次到期，并回写车辆里程
          </span>
        </div>
      ) : null}

      {canEdit && showForm ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField label="保养日期" required>
              <input className={fieldControlClass} type="date" value={form.maintenance_date} onChange={(e) => setForm((f) => ({ ...f, maintenance_date: e.target.value }))} required />
            </FormField>
            <FormField label="保养时里程 (mi)">
              <input className={fieldControlClass} type="number" min={0} value={form.odometer} onChange={(e) => setForm((f) => ({ ...f, odometer: e.target.value }))} />
            </FormField>
            <FormField label="门店">
              <input className={fieldControlClass} value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
            </FormField>
            <FormField label="费用 ($)">
              <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
            </FormField>
            <FormField label="发票号">
              <input className={fieldControlClass} value={form.invoice_no} onChange={(e) => setForm((f) => ({ ...f, invoice_no: e.target.value }))} />
            </FormField>
            <FormField label="备注" className="md:col-span-3">
              <input className={fieldControlClass} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </FormField>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">保养项目</p>
            <div className="flex flex-wrap gap-2">
              {dictionaries.maintenanceItems.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleItem(option.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    form.items.includes(option.value)
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button className={primaryButtonClass} type="submit">保存保养记录</button>
        </form>
      ) : null}

      <DataTable
        rows={detail.maintenances}
        rowKey={(row) => row.id}
        emptyText="暂无保养记录"
        columns={[
          { header: "保养日期", cell: (row) => row.maintenance_date },
          { header: "里程", cell: (row) => (row.odometer != null ? row.odometer.toLocaleString() : "-") },
          { header: "项目", cell: (row) => row.items ?? "-" },
          { header: "门店", cell: (row) => row.vendor ?? "-" },
          { header: "费用", cell: (row) => money(row.cost) },
          { header: "发票号", cell: (row) => row.invoice_no ?? "-" },
          {
            header: "下次到期",
            cell: (row) => `${row.next_due_date ?? "-"}${row.next_due_mileage != null ? ` / ${row.next_due_mileage.toLocaleString()} mi` : ""}`,
          },
          { header: "备注", cell: (row) => row.note ?? "-" },
          {
            header: "操作",
            cell: (row) =>
              isAdmin ? (
                <button className={deleteButtonClass} type="button" onClick={() => void onDelete(row)}>删除</button>
              ) : (
                <span className="text-slate-400">-</span>
              ),
          },
        ]}
      />
    </>
  );
}

// ---------------- 修理 ----------------

type RepairFormState = {
  reported_date: string;
  repair_start_date: string;
  repair_end_date: string;
  fault_description: string;
  repair_content: string;
  vendor: string;
  cost: string;
  paid_by: string;
  affects_availability: boolean;
  status: VehicleRepair["status"];
  accident_id: string;
};

function RepairsTab({
  detail,
  canEdit,
  isAdmin,
  reload,
  onError,
}: {
  detail: VehicleDetail;
  canEdit: boolean;
  isAdmin: boolean;
  reload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const emptyRepairForm: RepairFormState = {
    reported_date: todayISO(),
    repair_start_date: "",
    repair_end_date: "",
    fault_description: "",
    repair_content: "",
    vendor: "",
    cost: "",
    paid_by: "",
    affects_availability: true,
    status: "reported",
    accident_id: "",
  };
  const [form, setForm] = useState<RepairFormState>(emptyRepairForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const payload = () => ({
    accident_id: form.accident_id ? Number(form.accident_id) : null,
    reported_date: form.reported_date,
    repair_start_date: form.repair_start_date || null,
    repair_end_date: form.repair_end_date || null,
    fault_description: form.fault_description.trim() || null,
    repair_content: form.repair_content.trim() || null,
    vendor: form.vendor.trim() || null,
    cost: numOrNull(form.cost),
    paid_by: (form.paid_by || null) as VehicleRepair["paid_by"],
    affects_availability: form.affects_availability,
    status: form.status,
    note: null,
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (editingId) {
        await api.updateVehicleRepair(editingId, payload());
      } else {
        await api.createVehicleRepair(detail.vehicle.id, payload());
      }
      setForm(emptyRepairForm);
      setEditingId(null);
      setShowForm(false);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  const onEdit = (row: VehicleRepair) => {
    setEditingId(row.id);
    setShowForm(true);
    setForm({
      reported_date: row.reported_date,
      repair_start_date: row.repair_start_date ?? "",
      repair_end_date: row.repair_end_date ?? "",
      fault_description: row.fault_description ?? "",
      repair_content: row.repair_content ?? "",
      vendor: row.vendor ?? "",
      cost: row.cost != null ? String(row.cost) : "",
      paid_by: row.paid_by ?? "",
      affects_availability: row.affects_availability,
      status: row.status,
      accident_id: row.accident_id ? String(row.accident_id) : "",
    });
  };

  const onDelete = async (row: VehicleRepair) => {
    if (!confirm(`确认删除 ${row.reported_date} 的修理记录？`)) return;
    try {
      await api.deleteVehicleRepair(row.id);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  const downDays = (row: VehicleRepair) => {
    if (!row.repair_start_date || !row.repair_end_date) return "-";
    const days = Math.round(
      (new Date(row.repair_end_date).getTime() - new Date(row.repair_start_date).getTime()) / 86400000,
    );
    return days === 0 ? "当天" : `${days} 天`;
  };

  return (
    <>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <button
            className={primaryButtonClass}
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyRepairForm);
              setShowForm((v) => !v || editingId !== null);
            }}
          >
            {showForm && !editingId ? "收起" : "新增报修"}
          </button>
          <span className="text-xs text-slate-500">状态为「在修」且影响用车时，车辆状态自动变为在修；结单自动恢复（手工停用除外）</span>
        </div>
      ) : null}

      {canEdit && showForm ? (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
          <FormField label="报修日期" required>
            <input className={fieldControlClass} type="date" value={form.reported_date} onChange={(e) => setForm((f) => ({ ...f, reported_date: e.target.value }))} required />
          </FormField>
          <FormField label="送修日期">
            <input className={fieldControlClass} type="date" value={form.repair_start_date} onChange={(e) => setForm((f) => ({ ...f, repair_start_date: e.target.value }))} />
          </FormField>
          <FormField label="取车日期">
            <input className={fieldControlClass} type="date" value={form.repair_end_date} onChange={(e) => setForm((f) => ({ ...f, repair_end_date: e.target.value }))} />
          </FormField>
          <FormField label="状态">
            <select className={fieldControlClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VehicleRepair["status"] }))}>
              {repairStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="故障描述" className="md:col-span-2">
            <input className={fieldControlClass} value={form.fault_description} onChange={(e) => setForm((f) => ({ ...f, fault_description: e.target.value }))} />
          </FormField>
          <FormField label="维修内容" className="md:col-span-2">
            <input className={fieldControlClass} value={form.repair_content} onChange={(e) => setForm((f) => ({ ...f, repair_content: e.target.value }))} />
          </FormField>
          <FormField label="修理厂">
            <input className={fieldControlClass} value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
          </FormField>
          <FormField label="费用 ($)">
            <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
          </FormField>
          <FormField label="费用承担方">
            <select className={fieldControlClass} value={form.paid_by} onChange={(e) => setForm((f) => ({ ...f, paid_by: e.target.value }))}>
              <option value="">未定</option>
              {paidByOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="关联事故">
            <select className={fieldControlClass} value={form.accident_id} onChange={(e) => setForm((f) => ({ ...f, accident_id: e.target.value }))}>
              <option value="">无</option>
              {detail.accidents.map((accident) => (
                <option key={accident.id} value={accident.id}>
                  {accident.accident_datetime.slice(0, 10)} {accident.accident_type ?? ""}
                </option>
              ))}
            </select>
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
            <input type="checkbox" checked={form.affects_availability} onChange={(e) => setForm((f) => ({ ...f, affects_availability: e.target.checked }))} />
            影响用车（在修期间车辆不可用）
          </label>
          <div className="flex items-end gap-2 md:col-span-2">
            <button className={primaryButtonClass} type="submit">{editingId ? "保存修改" : "保存报修"}</button>
            {editingId ? (
              <button className={secondaryButtonClass} type="button" onClick={() => { setEditingId(null); setForm(emptyRepairForm); setShowForm(false); }}>取消</button>
            ) : null}
          </div>
        </form>
      ) : null}

      <DataTable
        rows={detail.repairs}
        rowKey={(row) => row.id}
        emptyText="暂无修理记录"
        columns={[
          { header: "报修", cell: (row) => row.reported_date },
          { header: "送修 → 取车", cell: (row) => `${row.repair_start_date ?? "-"} → ${row.repair_end_date ?? "-"}` },
          { header: "停用", cell: (row) => downDays(row) },
          {
            header: "故障/维修内容",
            cell: (row) => (
              <span>
                {row.fault_description ?? "-"}
                {row.repair_content ? <span className="block text-xs text-slate-400">{row.repair_content}</span> : null}
              </span>
            ),
          },
          { header: "修理厂", cell: (row) => row.vendor ?? "-" },
          { header: "费用", cell: (row) => money(row.cost) },
          { header: "承担方", cell: (row) => labelOf(paidByOptions, row.paid_by) },
          {
            header: "状态",
            cell: (row) => (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  row.status === "in_repair"
                    ? "bg-amber-100 text-amber-700"
                    : row.status === "done"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {labelOf(repairStatusOptions, row.status)}
              </span>
            ),
          },
          {
            header: "操作",
            cell: (row) => (
              <div className="flex gap-2">
                {canEdit ? <button className={editButtonClass} type="button" onClick={() => onEdit(row)}>修改</button> : null}
                {isAdmin ? <button className={deleteButtonClass} type="button" onClick={() => void onDelete(row)}>删除</button> : null}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

// ---------------- 事故理赔 ----------------

type AccidentFormState = {
  accident_date: string;
  accident_time: string;
  location: string;
  driver_person_id: string;
  driver_name_text: string;
  accident_type: string;
  liability: string;
  description: string;
  has_injury: boolean;
  injury_note: string;
  police_report_no: string;
  third_party_info: string;
  estimated_loss: string;
  claim_no: string;
  claim_status: VehicleAccident["claim_status"];
  claim_amount: string;
  settled_amount: string;
  deductible_paid: string;
  claim_filed_date: string;
  claim_closed_date: string;
};

function AccidentsTab({
  detail,
  canEdit,
  isAdmin,
  reload,
  onError,
  onWarnings,
  personMap,
  people,
  dictionaries,
}: {
  detail: VehicleDetail;
  canEdit: boolean;
  isAdmin: boolean;
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onWarnings: (warnings: string[]) => void;
  personMap: Map<number, string>;
  people: Person[];
  dictionaries: ReturnType<typeof useDictionaries>;
}) {
  const emptyAccidentForm: AccidentFormState = {
    accident_date: todayISO(),
    accident_time: "12:00",
    location: "",
    driver_person_id: "",
    driver_name_text: "",
    accident_type: "",
    liability: "",
    description: "",
    has_injury: false,
    injury_note: "",
    police_report_no: "",
    third_party_info: "",
    estimated_loss: "",
    claim_no: "",
    claim_status: "not_filed",
    claim_amount: "",
    settled_amount: "",
    deductible_paid: "",
    claim_filed_date: "",
    claim_closed_date: "",
  };
  const [form, setForm] = useState<AccidentFormState>(emptyAccidentForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const claimStepIndex = (status: VehicleAccident["claim_status"]) =>
    ["not_filed", "filed", "surveying", "approved", "paid", "closed"].indexOf(status === "rejected" ? "closed" : status);

  const payload = () => ({
    accident_datetime: `${form.accident_date}T${form.accident_time || "00:00"}:00`,
    location: form.location.trim() || null,
    driver_person_id: form.driver_person_id ? Number(form.driver_person_id) : null,
    driver_name_text: form.driver_name_text.trim() || null,
    accident_type: form.accident_type || null,
    liability: form.liability || null,
    description: form.description.trim() || null,
    has_injury: form.has_injury,
    injury_note: form.injury_note.trim() || null,
    police_report_no: form.police_report_no.trim() || null,
    third_party_info: form.third_party_info.trim() || null,
    estimated_loss: numOrNull(form.estimated_loss),
    policy_id: null,
    claim_no: form.claim_no.trim() || null,
    claim_status: form.claim_status,
    claim_amount: numOrNull(form.claim_amount),
    settled_amount: numOrNull(form.settled_amount),
    deductible_paid: numOrNull(form.deductible_paid),
    claim_filed_date: form.claim_filed_date || null,
    claim_closed_date: form.claim_closed_date || null,
    note: null,
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = editingId
        ? await api.updateVehicleAccident(editingId, payload())
        : await api.createVehicleAccident(detail.vehicle.id, payload());
      onWarnings(result.warnings);
      setForm(emptyAccidentForm);
      setEditingId(null);
      setShowForm(false);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  const onEdit = (row: VehicleAccident) => {
    setEditingId(row.id);
    setShowForm(true);
    setForm({
      accident_date: row.accident_datetime.slice(0, 10),
      accident_time: row.accident_datetime.slice(11, 16) || "00:00",
      location: row.location ?? "",
      driver_person_id: row.driver_person_id ? String(row.driver_person_id) : "",
      driver_name_text: row.driver_name_text ?? "",
      accident_type: row.accident_type ?? "",
      liability: row.liability ?? "",
      description: row.description ?? "",
      has_injury: row.has_injury,
      injury_note: row.injury_note ?? "",
      police_report_no: row.police_report_no ?? "",
      third_party_info: row.third_party_info ?? "",
      estimated_loss: row.estimated_loss != null ? String(row.estimated_loss) : "",
      claim_no: row.claim_no ?? "",
      claim_status: row.claim_status,
      claim_amount: row.claim_amount != null ? String(row.claim_amount) : "",
      settled_amount: row.settled_amount != null ? String(row.settled_amount) : "",
      deductible_paid: row.deductible_paid != null ? String(row.deductible_paid) : "",
      claim_filed_date: row.claim_filed_date ?? "",
      claim_closed_date: row.claim_closed_date ?? "",
    });
  };

  const onDelete = async (row: VehicleAccident) => {
    if (!confirm(`确认删除 ${row.accident_datetime.slice(0, 10)} 的事故记录？关联修理单会解除关联`)) return;
    try {
      await api.deleteVehicleAccident(row.id);
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  return (
    <>
      {canEdit ? (
        <button
          className={primaryButtonClass}
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(emptyAccidentForm);
            setShowForm((v) => !v || editingId !== null);
          }}
        >
          {showForm && !editingId ? "收起" : "新增事故"}
        </button>
      ) : null}

      {canEdit && showForm ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">事故信息</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField label="事故日期" required>
              <input className={fieldControlClass} type="date" value={form.accident_date} onChange={(e) => setForm((f) => ({ ...f, accident_date: e.target.value }))} required />
            </FormField>
            <FormField label="时间">
              <input className={fieldControlClass} type="time" value={form.accident_time} onChange={(e) => setForm((f) => ({ ...f, accident_time: e.target.value }))} />
            </FormField>
            <FormField label="地点" className="md:col-span-2">
              <input className={fieldControlClass} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </FormField>
            <FormField label="当事驾驶人（档案内）">
              <select className={fieldControlClass} value={form.driver_person_id} onChange={(e) => setForm((f) => ({ ...f, driver_person_id: e.target.value }))}>
                <option value="">不在档案 / 见右侧</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.chinese_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="当事人姓名（档案外）">
              <input className={fieldControlClass} value={form.driver_name_text} onChange={(e) => setForm((f) => ({ ...f, driver_name_text: e.target.value }))} />
            </FormField>
            <FormField label="事故类型">
              <select className={fieldControlClass} value={form.accident_type} onChange={(e) => setForm((f) => ({ ...f, accident_type: e.target.value }))}>
                <option value="">选择类型</option>
                {dictionaries.accidentTypes.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="责任判定">
              <select className={fieldControlClass} value={form.liability} onChange={(e) => setForm((f) => ({ ...f, liability: e.target.value }))}>
                <option value="">待定</option>
                {dictionaries.liabilityTypes.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="事故描述" className="md:col-span-2">
              <input className={fieldControlClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </FormField>
            <FormField label="报案号">
              <input className={fieldControlClass} value={form.police_report_no} onChange={(e) => setForm((f) => ({ ...f, police_report_no: e.target.value }))} />
            </FormField>
            <FormField label="定损金额 ($)">
              <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.estimated_loss} onChange={(e) => setForm((f) => ({ ...f, estimated_loss: e.target.value }))} />
            </FormField>
            <FormField label="对方信息（车牌/姓名/保险公司）" className="md:col-span-2">
              <input className={fieldControlClass} value={form.third_party_info} onChange={(e) => setForm((f) => ({ ...f, third_party_info: e.target.value }))} />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.has_injury} onChange={(e) => setForm((f) => ({ ...f, has_injury: e.target.checked }))} />
              有人受伤
            </label>
            {form.has_injury ? (
              <FormField label="伤情说明" className="md:col-span-3">
                <input className={fieldControlClass} value={form.injury_note} onChange={(e) => setForm((f) => ({ ...f, injury_note: e.target.value }))} />
              </FormField>
            ) : null}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">理赔信息（出险保单自动取事故日期覆盖的保单）</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField label="理赔案号">
              <input className={fieldControlClass} value={form.claim_no} onChange={(e) => setForm((f) => ({ ...f, claim_no: e.target.value }))} />
            </FormField>
            <FormField label="理赔状态">
              <select className={fieldControlClass} value={form.claim_status} onChange={(e) => setForm((f) => ({ ...f, claim_status: e.target.value as VehicleAccident["claim_status"] }))}>
                {claimStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="报案日期">
              <input className={fieldControlClass} type="date" value={form.claim_filed_date} onChange={(e) => setForm((f) => ({ ...f, claim_filed_date: e.target.value }))} />
            </FormField>
            <FormField label="结案日期">
              <input className={fieldControlClass} type="date" value={form.claim_closed_date} onChange={(e) => setForm((f) => ({ ...f, claim_closed_date: e.target.value }))} />
            </FormField>
            <FormField label="索赔金额 ($)">
              <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.claim_amount} onChange={(e) => setForm((f) => ({ ...f, claim_amount: e.target.value }))} />
            </FormField>
            <FormField label="实际赔付 ($)">
              <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.settled_amount} onChange={(e) => setForm((f) => ({ ...f, settled_amount: e.target.value }))} />
            </FormField>
            <FormField label="自付免赔 ($)">
              <input className={fieldControlClass} type="number" min={0} step="0.01" value={form.deductible_paid} onChange={(e) => setForm((f) => ({ ...f, deductible_paid: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex gap-2">
            <button className={primaryButtonClass} type="submit">{editingId ? "保存修改" : "保存事故记录"}</button>
            {editingId ? (
              <button className={secondaryButtonClass} type="button" onClick={() => { setEditingId(null); setForm(emptyAccidentForm); setShowForm(false); }}>取消</button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {detail.accidents.length === 0 ? (
          <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-400">暂无事故记录</div>
        ) : null}
        {detail.accidents.map((accident) => (
          <div key={accident.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{accident.accident_datetime.slice(0, 16).replace("T", " ")}</span>
              {accident.accident_type ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{accident.accident_type}</span> : null}
              {accident.liability ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{accident.liability}</span> : null}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${accident.has_injury ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                {accident.has_injury ? "有人伤" : "无人受伤"}
              </span>
              <span className="ml-auto" />
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${accident.claim_status === "closed" || accident.claim_status === "paid" ? "bg-emerald-100 text-emerald-700" : accident.claim_status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-indigo-50 text-indigo-600"}`}>
                {labelOf(claimStatusOptions, accident.claim_status)}
              </span>
              {canEdit ? <button className={editButtonClass} type="button" onClick={() => onEdit(accident)}>修改</button> : null}
              {isAdmin ? <button className={deleteButtonClass} type="button" onClick={() => void onDelete(accident)}>删除</button> : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm md:grid-cols-4">
              <div><p className="text-xs text-slate-400">地点</p><p>{accident.location ?? "-"}</p></div>
              <div><p className="text-xs text-slate-400">当事驾驶人</p><p>{accident.driver_person_id ? personMap.get(accident.driver_person_id) ?? "?" : accident.driver_name_text ?? "-"}</p></div>
              <div><p className="text-xs text-slate-400">报案号</p><p>{accident.police_report_no ?? "-"}</p></div>
              <div><p className="text-xs text-slate-400">对方信息</p><p>{accident.third_party_info ?? "-"}</p></div>
              <div><p className="text-xs text-slate-400">定损 / 索赔</p><p>{money(accident.estimated_loss)} / {money(accident.claim_amount)}</p></div>
              <div><p className="text-xs text-slate-400">实际赔付 / 自付</p><p>{money(accident.settled_amount)} / {money(accident.deductible_paid)}</p></div>
              <div><p className="text-xs text-slate-400">理赔案号</p><p>{accident.claim_no ?? "-"}</p></div>
              <div><p className="text-xs text-slate-400">报案 / 结案</p><p>{accident.claim_filed_date ?? "-"} / {accident.claim_closed_date ?? "-"}</p></div>
            </div>
            {accident.description ? <p className="mt-2 text-sm text-slate-600">{accident.description}</p> : null}
            <div className="mt-3 flex items-center gap-0 overflow-x-auto">
              {["未报案", "已报案", "定损中", "已核准", "已赔付", accident.claim_status === "rejected" ? "拒赔" : "已结案"].map((step, index, arr) => {
                const reached = index <= claimStepIndex(accident.claim_status);
                return (
                  <div key={step} className="flex items-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${reached ? (accident.claim_status === "rejected" && index === arr.length - 1 ? "bg-rose-500 text-white" : "bg-indigo-600 text-white") : "bg-slate-200 text-slate-400"}`}>
                        {reached ? "✓" : index + 1}
                      </span>
                      <span className={`whitespace-nowrap text-[11px] ${reached ? "font-medium text-slate-700" : "text-slate-400"}`}>{step}</span>
                    </div>
                    {index < arr.length - 1 ? <span className={`mx-1 mb-4 h-0.5 w-6 ${index < claimStepIndex(accident.claim_status) ? "bg-indigo-600" : "bg-slate-200"}`} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------- 宿舍调拨 ----------------

function AssignmentsTab({
  detail,
  dorms,
  dormMap,
  canEdit,
  reload,
  onError,
}: {
  detail: VehicleDetail;
  dorms: Dorm[];
  dormMap: Map<number, string>;
  canEdit: boolean;
  reload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [dormId, setDormId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const onAssign = async (event: FormEvent) => {
    event.preventDefault();
    if (!dormId) return;
    try {
      await api.assignVehicle(detail.vehicle.id, {
        dorm_id: Number(dormId),
        start_date: startDate || null,
        note: note.trim() || null,
      });
      setDormId("");
      setNote("");
      await reload();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  return (
    <>
      {canEdit ? (
        <form onSubmit={onAssign} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <FormField label="调拨到宿舍" className="min-w-44">
            <select className={fieldControlClass} value={dormId} onChange={(e) => setDormId(e.target.value)} required>
              <option value="">选择宿舍</option>
              {dorms
                .filter((dorm) => dorm.id !== detail.vehicle.base_dorm_id)
                .map((dorm) => (
                  <option key={dorm.id} value={dorm.id}>{dorm.name}</option>
                ))}
            </select>
          </FormField>
          <FormField label="调入日期">
            <input className={fieldControlClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label="调拨原因" className="min-w-56">
            <input className={fieldControlClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <button className={primaryButtonClass} type="submit">调拨</button>
          <span className="text-xs text-slate-500">新调拨自动结束旧记录</span>
        </form>
      ) : null}

      <DataTable
        rows={detail.assignments}
        rowKey={(row) => row.id}
        emptyText="暂无调拨记录"
        columns={[
          { header: "宿舍", cell: (row) => dormMap.get(row.dorm_id) ?? "?" },
          { header: "调入", cell: (row) => row.start_date },
          { header: "调出", cell: (row) => row.end_date ?? "-" },
          {
            header: "状态",
            cell: (row) =>
              row.status === "active" ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">生效中</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">已结束</span>
              ),
          },
          { header: "原因", cell: (row) => row.note ?? "-" },
        ]}
      />
    </>
  );
}
