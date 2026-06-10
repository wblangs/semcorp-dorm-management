import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import type { DashboardData } from "../types";

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string>("");
  const [showRenewalDorms, setShowRenewalDorms] = useState(false);
  const [showRiskBreakdown, setShowRiskBreakdown] = useState(false);

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

  const housingCards = [
    { label: "宿舍总数", value: data.dormTotal },
    { label: "房间总数", value: data.roomTotal },
    { label: "总床位数", value: data.bedTotal },
    { label: "当前入住人数", value: data.currentOccupancy },
    { label: "空床数", value: data.emptyBeds },
    { label: "入住率", value: `${data.occupancyRate}%` },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* ✅ 单独写续租按钮，不放进 cards.map */}
        <button
          type="button"
          onClick={() => setShowRenewalDorms((value) => !value)}
          className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-left shadow-sm transition hover:border-orange-300 hover:bg-orange-100"
        >
          <p className="text-sm text-slate-500">需要续租宿舍数(&lt;=90天)</p>
          <p className="mt-1 text-2xl font-bold">{data.leaseExpiring90 ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">
            {showRenewalDorms ? "点击收起详情" : "点击查看详情"}
          </p>
        </button>

        {housingCards.map((card) => (
          <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </article>
        ))}

        <Link
          to="/stay"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          <p className="text-sm text-slate-500">Green 正常人数</p>
          <p className="mt-1 text-2xl font-bold">{data.riskGreen}</p>
        </Link>

        <button
          type="button"
          onClick={() => setShowRiskBreakdown((value) => !value)}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm text-slate-500">风险人数(&lt;=60天)</p>
          <p className="mt-1 text-2xl font-bold">{data.riskPeople}</p>
          <p className="mt-1 text-xs text-slate-500">
            {showRiskBreakdown ? "点击收起明细" : "点击查看明细"}
          </p>
        </button>

        {showRiskBreakdown ? (
          <>
            <Link
              to="/stay"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
            >
              <p className="text-sm text-slate-500">Yellow 风险人数</p>
              <p className="mt-1 text-2xl font-bold">{data.riskYellow}</p>
            </Link>
            <Link
              to="/stay"
              className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm transition hover:border-red-300 hover:bg-red-100"
            >
              <p className="text-sm text-slate-500">Red 风险人数</p>
              <p className="mt-1 text-2xl font-bold">{data.riskRed}</p>
            </Link>
          </>
        ) : null}
      </div>

      {showRenewalDorms ? (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">90天内需要续租的宿舍</h3>

          {(data.renewalNeededDorms ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">暂无需要续租的宿舍</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">宿舍名称</th>
                    <th className="px-3 py-2">地址</th>
                    <th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">租约开始</th>
                    <th className="px-3 py-2">租约到期</th>
                    <th className="px-3 py-2">剩余天数</th>
                  </tr>
                </thead>

                <tbody>
                  {(data.renewalNeededDorms ?? []).map((dorm) => (
                    <tr key={dorm.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">{dorm.id}</td>
                      <td className="px-3 py-2">{dorm.name}</td>
                      <td className="px-3 py-2">{dorm.address ?? "-"}</td>
                      <td className="px-3 py-2">{dorm.type ?? "-"}</td>
                      <td className="px-3 py-2">{dorm.status ?? "-"}</td>
                      <td className="px-3 py-2">{dorm.lease_start_date ?? "-"}</td>
                      <td className="px-3 py-2">{dorm.lease_end_date ?? "-"}</td>
                      <td className="px-3 py-2">{dorm.days_left}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : null}

      {showRiskBreakdown ? (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">未来30天最大停留到期</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {data.stayExpiring30.slice(0, 10).map((item) => (
              <li key={`30-${item.person_id}`}>
                {item.person.chinese_name}/{item.person.english_name || "-"} - 剩余 {item.remaining_legal_days} 天
              </li>
            ))}
            {data.stayExpiring30.length === 0 ? <li>暂无</li> : null}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">未来60天最大停留到期</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {data.stayExpiring60.slice(0, 10).map((item) => (
              <li key={`60-${item.person_id}`}>
                {item.person.chinese_name}/{item.person.english_name || "-"} - 剩余 {item.remaining_legal_days} 天
              </li>
            ))}
            {data.stayExpiring60.length === 0 ? <li>暂无</li> : null}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">已超期未离美</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {data.stayOverstayed.slice(0, 10).map((item) => (
              <li key={`over-${item.person_id}`}>
                {item.person.chinese_name}/{item.person.english_name || "-"} - 超期{" "}
                {Math.abs(item.remaining_legal_days ?? 0)} 天
              </li>
            ))}
            {data.stayOverstayed.length === 0 ? <li>暂无</li> : null}
          </ul>
        </article>
      </div>
      ) : null}
    </section>
  );
}