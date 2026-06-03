import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/dorms", label: "宿舍" },
  { to: "/rooms", label: "房间" },
  { to: "/people", label: "人员" },
  { to: "/stay", label: "停留风险" },
  { to: "/allocations", label: "入住分配" },
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <h1 className="text-lg font-semibold">宿舍与通勤管理系统</h1>
          <nav className="flex flex-wrap items-center gap-2">
            {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <span className="ml-2 text-sm text-slate-600">{user?.display_name || user?.username}</span>
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {language === "zh" ? "English" : "中文"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              退出登录
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
