import { useEffect, useState } from "react";

import { api } from "../api";
import type { DashboardData } from "../types";

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  }

  if (!data) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4">加载中...</div>;
  }

  const cards = [
    ["宿舍总数", data.dormTotal],
    ["房间总数", data.roomTotal],
    ["总床位数", data.bedTotal],
    ["当前入住人数", data.currentOccupancy],
    ["空床数", data.emptyBeds],
    ["入住率", `${data.occupancyRate}%`],
    ["风险人数(<=60天)", data.riskPeople],
    ["可用车辆数", data.availableVehicles],
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
