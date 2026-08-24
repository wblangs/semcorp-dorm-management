import { useState } from "react";
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
  { to: "/vehicle-alerts", label: "车辆提醒" },
  { to: "/utility-bills", label: "水电房费" },
  { to: "/dictionaries", label: "字典", adminOnly: true },
  { to: "/users", label: "用户管理", adminOnly: true },
  { to: "/system", label: "系统", adminOnly: true },
];

export function AdminLayout() {
  const { user, isAdmin, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 text-slate-700 active:bg-slate-200"
    }`;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-6 md:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
              宿
            </span>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">宿舍管理系统</h1>
          </div>

          {/* Desktop nav */}
          <nav className="hidden flex-1 flex-wrap items-center gap-1 md:flex">
            {visibleItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm text-slate-500">{user?.display_name || user?.username}</span>
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

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="菜单"
            onClick={() => setMenuOpen((open) => !open)}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm md:hidden"
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu panel */}
        {menuOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-3 md:hidden">
            <nav className="grid grid-cols-2 gap-2">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={mobileNavLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <span className="mr-auto text-sm text-slate-500">{user?.display_name || user?.username}</span>
              <button
                type="button"
                onClick={toggleLanguage}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
              >
                {language === "zh" ? "English" : "中文"}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 shadow-sm"
              >
                退出登录
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
