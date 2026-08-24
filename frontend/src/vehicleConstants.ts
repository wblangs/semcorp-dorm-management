// 车辆模块固定值域：这些值参与后端状态联动/进度条/统计口径，
// 有意不做成可编辑字典（见 docs/VEHICLE_MODULE_DESIGN.md §3.11），这里只维护中文标签。

export const vehicleStatusOptions = [
  { value: "available", label: "可用" },
  { value: "in_repair", label: "在修" },
  { value: "disabled", label: "停用" },
  { value: "disposed", label: "已处置" },
] as const;

export const ownershipOptions = [
  { value: "owned", label: "自购" },
  { value: "leased", label: "租赁" },
] as const;

export const driverRoleOptions = [
  { value: "primary", label: "主要驾驶人" },
  { value: "secondary", label: "第二驾驶人" },
] as const;

export const policyStatusOptions = [
  { value: "active", label: "生效中" },
  { value: "expired", label: "已到期" },
  { value: "cancelled", label: "已退保" },
] as const;

export const repairStatusOptions = [
  { value: "reported", label: "已报修" },
  { value: "in_repair", label: "在修" },
  { value: "done", label: "已完成" },
  { value: "cancelled", label: "已取消" },
] as const;

export const paidByOptions = [
  { value: "company", label: "公司" },
  { value: "insurance", label: "保险" },
  { value: "driver", label: "个人" },
] as const;

export const claimStatusOptions = [
  { value: "not_filed", label: "未报案" },
  { value: "filed", label: "已报案" },
  { value: "surveying", label: "定损中" },
  { value: "approved", label: "已核准" },
  { value: "paid", label: "已赔付" },
  { value: "rejected", label: "拒赔" },
  { value: "closed", label: "已结案" },
] as const;

export const alertKindLabels: Record<string, string> = {
  insurance_expire: "保险到期",
  inspection_expire: "年检到期",
  registration_expire: "注册到期",
  maintenance_due: "保养到期",
  maintenance_mileage: "保养里程临近",
  lease_expire: "租赁合同到期",
  license_expire: "驾照到期",
  claim_stalled: "理赔超期未结案",
};

export function labelOf(options: readonly { value: string; label: string }[], value: string | null | undefined) {
  if (!value) return "-";
  return options.find((option) => option.value === value)?.label ?? value;
}

// 到期日染色：红=已过期，橙=30天内，其余中性。
export function dueDateClass(dateStr: string | null | undefined, warnDays = 30): string {
  if (!dateStr) return "text-slate-400";
  const due = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "font-semibold text-rose-600";
  if (days <= warnDays) return "font-semibold text-amber-600";
  return "text-slate-700";
}

export function daysLeft(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const due = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}
