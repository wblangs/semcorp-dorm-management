import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/dorms", label: "宿舍" },
  { to: "/rooms", label: "房间" },
  { to: "/room-assets", label: "房间资产" },
  { to: "/people", label: "人员" },
  { to: "/stay", label: "停留风险" },
  { to: "/allocations", label: "入住分配" },
  { to: "/summary", label: "汇总报表" },
  { to: "/check-in-records", label: "入住备份记录", adminOnly: true },
  { to: "/vehicles", label: "车辆" },
  { to: "/dictionaries", label: "字典", adminOnly: true },
  { to: "/users", label: "用户管理", adminOnly: true },
  { to: "/system", label: "系统", adminOnly: true },
];

export function AdminLayout() {
  const { user, isAdmin, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
              宿
            </span>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">宿舍管理系统</h1>
          </div>

          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.display_name || user?.username}</span>
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {language === "zh" ? "English" : "中文"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
