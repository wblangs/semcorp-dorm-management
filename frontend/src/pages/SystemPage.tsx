import { useEffect, useState } from "react";

import { api } from "../api";
import { ApiError } from "../api/client";
import type { SystemInfo } from "../types";
import { ErrorDialog } from "../components/ErrorDialog";

export function SystemPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getSystemInfo()
      .then(setInfo)
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载系统信息失败"));
  }, []);

  const rows = info
    ? [
        ["当前版本", info.version],
        ["数据库类型", info.database],
        ["系统环境", info.environment],
        ["当前用户", info.current_user.display_name || info.current_user.username],
        ["当前角色", info.current_user.role],
      ]
    : [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">系统信息</h2>
        <p className="mt-1 text-sm text-slate-500">仅展示非敏感运行信息。</p>
      </div>

      <ErrorDialog message={error} onClose={() => setError("")} />

      {!info && !error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>
      ) : null}

      {info ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-3 border-b border-slate-100 last:border-b-0">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{label}</div>
              <div className="col-span-2 px-4 py-3 text-sm text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
