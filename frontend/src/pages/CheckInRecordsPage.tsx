import { FormEvent, useEffect, useMemo, useState } from "react";

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
import type { Allocation, Dorm, Person, Room } from "../types";
import { todayISO } from "../utils/date";

export function CheckInRecordsPage() {
  const { isAdmin } = useAuth();

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocationSearch, setAllocationSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    person_id: "",
    dorm_id: "",
    room_id: "",
    check_in_date: "",
    expected_check_out_date: "",
    note: "",
  });

  const load = async () => {
    try {
      setLoading(true);

      const [a, p, d, r] = await Promise.all([
        api.getAllocationBackupHistory(),
        api.getPeople(),
        api.getDorms(),
        api.getRooms(),
      ]);

      setAllocations(a);
      setPeople(p);
      setDorms(d);
      setRooms(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const personMap = useMemo(
    () => new Map(people.map((person) => [person.id, `${person.chinese_name}/${person.english_name || "-"}`])),
    [people],
  );

  const dormMap = useMemo(() => new Map(dorms.map((dorm) => [dorm.id, dorm.name])), [dorms]);

  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room.room_name])), [rooms]);

  const roomOptions = useMemo(
    () => rooms.filter((room) => String(room.dorm_id) === form.dorm_id),
    [rooms, form.dorm_id],
  );

  const filteredAllocations = useMemo(() => {
    const keyword = allocationSearch.trim().toLowerCase();

    if (!keyword) return allocations;

    return allocations.filter((allocation) =>
      [
        allocation.id,
        allocation.person_id,
        personMap.get(allocation.person_id),
        allocation.dorm_id,
        dormMap.get(allocation.dorm_id),
        allocation.room_id,
        roomMap.get(allocation.room_id),
        allocation.check_in_date,
        allocation.expected_check_out_date,
        allocation.actual_check_out_date,
        allocation.check_out_date,
        allocation.note,
        allocation.status === "active" ? "在住" : "已退宿",
        allocation.hidden_from_user_history ? "用户已删除" : "用户可见",
        allocation.status,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [allocationSearch, allocations, dormMap, personMap, roomMap]);

  const onEdit = (row: Allocation) => {
    if (row.status !== "active") return;

    setEditingId(row.id);
    setForm({
      person_id: String(row.person_id),
      dorm_id: String(row.dorm_id),
      room_id: String(row.room_id),
      check_in_date: row.check_in_date,
      expected_check_out_date: row.expected_check_out_date ?? "",
      note: row.note ?? "",
    });
  };

  const onSubmitEdit = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingId) return;

    setError("");
    setSubmitting(true);

    try {
      await api.updateAllocation(editingId, {
        dorm_id: Number(form.dorm_id),
        room_id: Number(form.room_id),
        check_in_date: form.check_in_date,
        expected_check_out_date: form.expected_check_out_date || null,
        note: form.note.trim() || null,
      });

      setEditingId(null);
      setForm({
        person_id: "",
        dorm_id: "",
        room_id: "",
        check_in_date: "",
        expected_check_out_date: "",
        note: "",
      });

      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onCheckout = async (row: Allocation) => {
    setError("");

    try {
      await api.checkoutAllocation(row.id, todayISO());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onDelete = async (row: Allocation) => {
    if (!confirm("确认删除该入住记录？")) return;

    setError("");

    try {
      await api.deleteAllocationBackup(row.id);

      if (editingId === row.id) {
        setEditingId(null);
      }

      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onRecover = async (row: Allocation) => {
    setError("");
    try {
      await api.recoverAllocationUserHistory(row.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">入住备份记录</h2>

      {editingId ? (
        <form
          onSubmit={onSubmitEdit}
          className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4"
        >
          <FormField label="人员">
            <input
              className={fieldControlClass}
              value={personMap.get(Number(form.person_id)) ?? "Unknown"}
              disabled
            />
          </FormField>

          <FormField label="宿舍" required>
            <select
              className={fieldControlClass}
              value={form.dorm_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dorm_id: e.target.value,
                  room_id: "",
                }))
              }
              required
            >
              {dorms.map((dorm) => (
                <option key={dorm.id} value={dorm.id}>
                  {dorm.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="房间" required>
            <select
              className={fieldControlClass}
              value={form.room_id}
              onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value }))}
              required
            >
              {roomOptions.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="入住日期" required>
            <input
              className={fieldControlClass}
              type="date"
              value={form.check_in_date}
              onChange={(e) => setForm((f) => ({ ...f, check_in_date: e.target.value }))}
              required
            />
          </FormField>

          <FormField label="预计退宿日期">
            <input
              className={fieldControlClass}
              type="date"
              value={form.expected_check_out_date}
              onChange={(e) => setForm((f) => ({ ...f, expected_check_out_date: e.target.value }))}
            />
          </FormField>

          <FormField label="备注" className="md:col-span-3">
            <input
              className={fieldControlClass}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </FormField>

          <button className={`${primaryButtonClass} md:col-span-2`} type="submit" disabled={submitting}>
            {submitting ? "保存中..." : "保存修改"}
          </button>

          <button
            className={`${secondaryButtonClass} md:col-span-2`}
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({
                person_id: "",
                dorm_id: "",
                room_id: "",
                check_in_date: "",
                expected_check_out_date: "",
                note: "",
              });
            }}
          >
            取消编辑
          </button>
        </form>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">加载入住记录中...</div>
      ) : (
        <div className="space-y-2">
          <input
            className={fieldControlClass}
            value={allocationSearch}
            onChange={(event) => setAllocationSearch(event.target.value)}
            placeholder="搜索入住记录"
          />

          <DataTable
            rows={filteredAllocations}
            rowKey={(row) => row.id}
            emptyText="没有匹配记录"
            columns={[
              { header: "人员", cell: (row) => personMap.get(row.person_id) ?? "Unknown" },
              { header: "宿舍", cell: (row) => dormMap.get(row.dorm_id) ?? "Unknown" },
              { header: "房间", cell: (row) => roomMap.get(row.room_id) ?? "Unknown" },
              { header: "入住日期", cell: (row) => row.check_in_date },
              { header: "预计退宿日期", cell: (row) => row.expected_check_out_date ?? "-" },
              { header: "实际退宿日期", cell: (row) => row.actual_check_out_date ?? row.check_out_date ?? "-" },
              { header: "备注", cell: (row) => row.note ?? "-" },
              {
                header: "状态",
                cell: (row) => (row.status === "active" ? "在住" : "已退宿"),
              },
              {
                header: "用户页面",
                cell: (row) => (row.hidden_from_user_history ? "用户已删除" : "用户可见"),
              },
              {
                header: "操作",
                cell: (row) => (
                  <div className="flex gap-2">
                    {row.status === "active" ? (
                      <button className={editButtonClass} type="button" onClick={() => onEdit(row)}>
                        修改
                      </button>
                    ) : null}

                    {row.status === "active" ? (
                      <button className={editButtonClass} type="button" onClick={() => void onCheckout(row)}>
                        退房
                      </button>
                    ) : null}

                    {isAdmin && row.status !== "active" ? (
                      <button className={deleteButtonClass} type="button" onClick={() => void onDelete(row)}>
                        删除
                      </button>
                    ) : null}
                    {isAdmin && row.hidden_from_user_history ? (
                      <button className={editButtonClass} type="button" onClick={() => void onRecover(row)}>
                        恢复
                      </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </section>
  );
}
