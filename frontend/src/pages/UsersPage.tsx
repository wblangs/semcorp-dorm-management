import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { ApiError } from "../api/client";
import { DataTable } from "../components/DataTable";
import {
  deleteButtonClass,
  editButtonClass,
  fieldControlClass,
  FormField,
  primaryButtonClass,
  secondaryButtonClass,
} from "../components/FormField";
import type { User } from "../types";

type UserFormState = {
  username: string;
  password: string;
  display_name: string;
  role: "admin" | "user" | "viewer";
  status: "active" | "disabled";
  dingtalk_userid: string;
};

const emptyForm: UserFormState = {
  username: "",
  password: "",
  display_name: "",
  role: "user",
  status: "active",
  dingtalk_userid: "",
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    const data = await api.getUsers();
    setUsers(data);
  }

  useEffect(() => {
    loadUsers().catch((err) => setError(err instanceof ApiError ? err.message : "加载用户失败"));
  }, []);

  function startEdit(user: User) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: "",
      display_name: user.display_name ?? "",
      role: user.role,
      status: user.status,
      dingtalk_userid: user.dingtalk_userid ?? "",
    });
    setResetPassword("");
    setError("");
    setMessage("");
  }

  async function handleDelete(user: User) {
    if (!confirm(`确认删除用户 ${user.display_name || user.username}？`)) return;
    setError("");
    setMessage("");
    try {
      await api.deleteUser(user.id);
      if (editingId === user.id) {
        resetForm();
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setResetPassword("");
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (editingId && !confirm("确认保存修改？")) return;
    setError("");
    setMessage("");
    try {
      if (editingId) {
        await api.updateUser(editingId, {
          display_name: form.display_name || null,
          role: form.role,
          status: form.status,
          dingtalk_userid: form.dingtalk_userid.trim() || undefined,
        });
        if (resetPassword) {
          await api.resetUserPassword(editingId, resetPassword);
        }
        setMessage("用户已更新");
      } else {
        await api.createUser({
          username: form.username,
          password: form.password,
          display_name: form.display_name || null,
          role: form.role,
          status: form.status,
        });
        setMessage("用户已创建");
      }
      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败");
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">用户管理</h2>
        <p className="mt-1 text-sm text-slate-500">仅 admin 可维护系统账号、角色和状态。</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="用户名" required={!editingId}>
            <input
              className={fieldControlClass}
              value={form.username}
              disabled={Boolean(editingId)}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
          </FormField>
          <FormField label={editingId ? "重置密码" : "密码"} required={!editingId}>
            <input
              className={fieldControlClass}
              type="password"
              value={editingId ? resetPassword : form.password}
              onChange={(event) =>
                editingId ? setResetPassword(event.target.value) : setForm({ ...form, password: event.target.value })
              }
            />
          </FormField>
          <FormField label="显示名">
            <input
              className={fieldControlClass}
              value={form.display_name}
              onChange={(event) => setForm({ ...form, display_name: event.target.value })}
            />
          </FormField>
          <FormField label="角色" required>
            <select
              className={fieldControlClass}
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as UserFormState["role"] })}
            >
              <option value="admin">admin</option>
              <option value="user">user</option>
              <option value="viewer">viewer（只读）</option>
            </select>
          </FormField>
          <FormField label="状态" required>
            <select
              className={fieldControlClass}
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as UserFormState["status"] })}
            >
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </FormField>
          {editingId ? (
            <FormField label="钉钉UserID（免登绑定）">
              <input
                className={fieldControlClass}
                value={form.dingtalk_userid}
                onChange={(event) => setForm({ ...form, dingtalk_userid: event.target.value })}
              />
            </FormField>
          ) : null}
          <div className="flex items-end gap-2">
            <button className={primaryButtonClass}>{editingId ? "保存用户" : "新增用户"}</button>
            {editingId ? (
              <button type="button" className={secondaryButtonClass} onClick={resetForm}>
                取消
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{message}</div>
      ) : null}

      <DataTable
        rows={users}
        rowKey={(user) => user.id}
        emptyText="暂无用户"
        columns={[
          { header: "ID", cell: (user) => user.id },
          { header: "用户名", cell: (user) => user.username },
          { header: "显示名", cell: (user) => user.display_name || "-" },
          { header: "角色", cell: (user) => user.role },
          { header: "状态", cell: (user) => user.status },
          { header: "钉钉绑定", cell: (user) => (user.dingtalk_userid ? "已绑定" : "-") },
          { header: "最后登录", cell: (user) => user.last_login_at || "-" },
          {
            header: "操作",
            cell: (user) => (
              <div className="flex gap-2">
                <button type="button" className={editButtonClass} onClick={() => startEdit(user)}>
                  编辑
                </button>
                <button type="button" className={deleteButtonClass} onClick={() => void handleDelete(user)}>
                  删除
                </button>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
