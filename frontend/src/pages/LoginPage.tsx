import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { api } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { fieldControlClass, FormField, primaryButtonClass } from "../components/FormField";
import { useLanguage } from "../i18n";

const isInsideDingtalk = () => /DingTalk/i.test(window.navigator.userAgent);

export function LoginPage() {
  const { user, login, loginWithDingtalk } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ddLoggingIn, setDdLoggingIn] = useState(() => isInsideDingtalk());

  // 免登: when opened inside DingTalk and the server has DingTalk configured,
  // exchange a JSAPI authCode for a session automatically. Any failure falls
  // back to the normal username/password form.
  useEffect(() => {
    if (!isInsideDingtalk() || user) {
      setDdLoggingIn(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const config = await api.getDingtalkConfig();
        if (!config.enabled || cancelled) {
          setDdLoggingIn(false);
          return;
        }
        const dd = (await import("dingtalk-jsapi")).default;
        const result = await dd.runtime.permission.requestAuthCode({ corpId: config.corp_id });
        if (cancelled) return;
        await loginWithDingtalk(result.code);
        if (!cancelled) navigate("/", { replace: true });
      } catch (err) {
        if (!cancelled) {
          setDdLoggingIn(false);
          setError(err instanceof ApiError ? err.message : "钉钉自动登录失败，请使用账号密码登录");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-6 text-slate-900">
      <button
        type="button"
        onClick={toggleLanguage}
        className="absolute right-6 top-6 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        {language === "zh" ? "English" : "中文"}
      </button>
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-sm">
            宿
          </span>
          <h1 className="text-xl font-semibold tracking-tight">宿舍管理系统</h1>
          <p className="mt-1 text-sm text-slate-500">内部试用版登录</p>
        </div>

        {ddLoggingIn ? (
          <div className="py-6 text-center text-sm text-slate-500">钉钉登录中...</div>
        ) : (
        <div className="space-y-4">
          <FormField label="用户名" required>
            <input
              className={fieldControlClass}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </FormField>
          <FormField label="密码" required>
            <input
              className={fieldControlClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </FormField>
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <button className={`${primaryButtonClass} w-full`} disabled={submitting}>
            {submitting ? "登录中..." : "登录"}
          </button>
        </div>
        )}
      </form>
    </div>
  );
}
