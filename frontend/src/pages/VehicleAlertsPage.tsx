import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { secondaryButtonClass } from "../components/FormField";
import type { VehicleAlertItem, VehicleAlertsPayload } from "../types";
import { ErrorDialog } from "../components/ErrorDialog";

const GROUPS: { key: keyof VehicleAlertsPayload; title: string; chipClass: string }[] = [
  { key: "missing", title: "档案缺失", chipClass: "bg-rose-100 text-rose-700" },
  { key: "overdue", title: "已过期", chipClass: "bg-rose-100 text-rose-700" },
  { key: "within7", title: "7 天内到期", chipClass: "bg-amber-100 text-amber-700" },
  { key: "within30", title: "30 天内到期（租赁合同 60 天）", chipClass: "bg-amber-100 text-amber-700" },
  { key: "claimStalled", title: "理赔超期未结案", chipClass: "bg-indigo-100 text-indigo-700" },
];

export function VehicleAlertsPage() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<VehicleAlertsPayload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .getVehicleAlerts()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const onTestSend = async () => {
    setMessage("");
    setError("");
    try {
      await api.sendVehicleTestMessage();
      setMessage("测试消息已发送，请在钉钉查收");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (error && !data) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">车辆提醒</h2>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </section>
    );
  }
  if (!data) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>;
  }

  const total = GROUPS.reduce((sum, group) => sum + data[group.key].length, 0);

  const columns = (group: keyof VehicleAlertsPayload) => [
    {
      header: "车辆",
      cell: (row: VehicleAlertItem) => (
        <span>
          <Link className="font-semibold text-indigo-600 hover:underline" to={`/vehicles/${row.vehicle_id}`}>
            {row.plate_number}
          </Link>
          {row.vehicle_label ? <span className="block text-xs text-slate-400">{row.vehicle_label}</span> : null}
        </span>
      ),
    },
    { header: "宿舍", cell: (row: VehicleAlertItem) => row.dorm_name ?? "未分配" },
    {
      header: "提醒项",
      cell: (row: VehicleAlertItem) => (
        <span>
          {group === "missing" ? row.extra : row.kind_label}
          {group !== "missing" && row.extra ? <span className="block text-xs text-slate-400">{row.extra}</span> : null}
        </span>
      ),
    },
    {
      header: group === "claimStalled" ? "报案日期" : "到期日",
      cell: (row: VehicleAlertItem) => row.due_date ?? "—",
    },
    {
      header: group === "claimStalled" ? "已报案" : "剩余/逾期",
      cell: (row: VehicleAlertItem) => {
        if (group === "missing") return <span className="font-semibold text-rose-600">待补录</span>;
        if (group === "claimStalled") return <span className="font-semibold text-indigo-600">{row.days_open} 天</span>;
        if (row.days_left == null) return "—";
        if (row.days_left < 0) return <span className="font-semibold text-rose-600">逾期 {-row.days_left} 天</span>;
        if (row.days_left === 0) return <span className="font-semibold text-amber-600">今天</span>;
        return <span className="font-semibold text-amber-600">{row.days_left} 天</span>;
      },
    },
    {
      header: "操作",
      cell: (row: VehicleAlertItem) => (
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          to={`/vehicles/${row.vehicle_id}`}
        >
          去处理
        </Link>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">车辆提醒</h2>
        <span className="text-sm text-slate-500">共 {total} 项待处理</span>
        <span className="ml-auto" />
        {isAdmin ? (
          <button className={secondaryButtonClass} type="button" onClick={() => void onTestSend()}>
            测试钉钉发送
          </button>
        ) : null}
      </div>
      <p className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm text-indigo-900">
        钉钉提醒每天 9 点后自动发送：保险 30/15/7 天、年检与注册 30/7 天、保养 15 天或里程达间隔 90%、租赁合同 60/30 天、驾照 30/7 天，理赔超 30 天未结案每 30 天一次。同一到期日的同一档位只提醒一次。接收人在用户管理页勾选「接收车辆提醒」。
      </p>

      <ErrorDialog message={error} onClose={() => setError("")} />
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

      {total === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-700">
          🎉 所有车辆事项正常，没有需要处理的提醒
        </div>
      ) : null}

      {GROUPS.map((group) =>
        data[group.key].length > 0 ? (
          <div key={group.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${group.chipClass}`}>{data[group.key].length}</span>
            </div>
            <DataTable rows={data[group.key]} rowKey={(row) => `${row.vehicle_id}-${row.kind}-${row.due_date}-${row.extra}`} columns={columns(group.key)} />
          </div>
        ) : null,
      )}
    </section>
  );
}
