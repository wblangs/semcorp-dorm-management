import { createContext, ReactNode, RefObject, useContext, useEffect, useMemo, useRef, useState } from "react";

type Language = "zh" | "en";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  text: (zhText: string) => string;
};

const LANGUAGE_STORAGE_KEY = "semcorp-language";

const translations: Record<string, string> = {
  "宿舍管理系统": "Dorm Management System",
  "内部试用版登录": "Internal Trial Login",
  "用户名": "Username",
  "密码": "Password",
  "登录": "Login",
  "登录中...": "Logging in...",
  "退出登录": "Log out",
  "正在恢复登录状态...": "Restoring login session...",
  "Dashboard": "Dashboard",
  "宿舍": "Dorms",
  "房间": "Rooms",
  "汇总报表": "Summary Report",
  "宿舍汇总报表": "Dorm Summary Report",
  "导出 Excel": "Export Excel",
  "导出中...": "Exporting...",
  "搜索汇总记录": "Search summary records",
  "序号": "No.",
  "住址": "Address",
  "姓名": "Name",
  "职称": "Title",
  "空铺": "Empty Bed",
  "房间资产": "Room Assets",
  "房间资产管理": "Room Asset Management",
  "同一宿舍使用同一色系，不同房间用深浅区分。": "Each dorm uses one colour family; rooms are distinguished by shade.",
  "搜索房间资产": "Search room assets",
  "该宿舍暂无房间": "No rooms in this dorm",
  "保存中...": "Saving...",
  "物品": "Item",
  "型号": "Type",
  "数量": "Count",
  "资产物品": "Assets",
  "添加": "Add",
  "添加资产": "Add Asset",
  "暂无资产": "No assets",
  "选择房间": "Select Room",
  "物品(可输入或选择)": "Item (type or pick)",
  "每个房间可自由增删资产物品；同一宿舍同色系，不同房间用深浅区分。": "Add or remove asset items freely per room; each dorm shares a colour family, rooms by shade.",
  "型号(可选)": "Type (optional)",
  "人员": "People",
  "车辆": "Vehicles",
  "字典": "Dictionaries",
  "用户管理": "Users",
  "系统": "System",
  "加载中...": "Loading...",
  "操作未完成": "Action not completed",
  "知道了": "Got it",
  "暂无": "None",
  "暂无数据": "No data",
  "没有匹配记录": "No matching records",
  "操作": "Actions",
  "修改": "Edit",
  "删除": "Delete",
  "保存": "Save",
  "取消": "Cancel",
  "取消编辑": "Cancel edit",
  "状态": "Status",
  "备注": "Note",
  "类型": "Type",
  "名称": "Name",
  "地址": "Address",
  "宿舍管理": "Dorm Management",
  "新增宿舍": "Add Dorm",
  "保存宿舍": "Save Dorm",
  "搜索宿舍记录": "Search dorm records",
  "租期开始": "Lease Start",
  "租期结束": "Lease End",
  "租期开始日期": "Lease Start Date",
  "租期结束日期": "Lease End Date",
  "房间管理": "Room Management",
  "新增房间": "Add Room",
  "保存房间": "Save Room",
  "搜索房间记录": "Search room records",
  "选择宿舍": "Select Dorm",
  "房间名": "Room Name",
  "房间类型": "Room Type",
  "床位数": "Beds",
  "床位": "Beds",
  "床型": "Bed Size",
  "灯具": "Light",
  "灯具类型": "Light Type",
  "床头柜": "Nightstand",
  "床头柜数量": "Nightstand Count",
  "垃圾桶": "Trash Can",
  "垃圾桶数量": "Trash Can Count",
  "未设置": "Not Set",
  "落地灯": "Floor Lamp",
  "顶灯": "Ceiling Light",
  "性别限制": "Gender Limit",
  "人员管理": "People Management",
  "新增人员": "Add Person",
  "保存人员": "Save Person",
  "搜索人员记录": "Search people records",
  "中文名": "Chinese Name",
  "英文名": "English Name",
  "部门": "Department",
  "人员类型": "Person Type",
  "性别": "Gender",
  "签证与停留": "Visa & Stay",
  "签证类型": "Visa Type",
  "赴美日期": "US Arrival Date",
  "计划离美日期": "Planned US Departure",
  "最大停留日期": "Max Stay Date",
  "实际离美日期": "Actual US Departure",
  "停留风险": "Stay Risk",
  "当前住宿状态": "Current Housing Status",
  "在住": "Living In",
  "未入住": "Not Assigned",
  "快速入住": "Quick Assign",
  "入住": "Assign",
  "暂无空房间": "No open rooms",
  "未维护": "Not Maintained",
  "选择部门": "Select Department",
  "选择签证类型": "Select Visa Type",
  "入住分配": "Allocation",
  "入住备份记录": "Allocation Backup Records",
  "入住记录": "Allocation Records",
  "历史入住记录": "Previous Allocation Records",
  "搜索历史入住记录": "Search previous allocation records",
  "搜索入住记录": "Search allocation records",
  "当前在住记录": "Current Living Records",
  "搜索当前在住记录": "Search current living records",
  "已退宿记录": "Checked-out Records",
  "搜索已退宿记录": "Search checked-out records",
  "收起记录": "Hide Records",
  "展开记录": "Show Records",
  "收起": "Hide",
  "展开": "Show",
  "用户页面": "User Page",
  "用户已删除": "Hidden From User",
  "用户可见": "Visible To User",
  "恢复": "Recover",
  "未分配房间人员": "People Without Rooms",
  "暂无未分配房间人员": "No people without rooms",
  "加载未分配人员中...": "Loading people without rooms...",
  "宿舍与可用房间": "Dorms & Available Rooms",
  "暂无宿舍": "No dorms",
  "暂无有空床位房间": "No rooms with open beds",
  "该宿舍暂无有空床位房间": "No rooms with open beds in this dorm",
  "展开房间": "Show Rooms",
  "收起房间": "Hide Rooms",
  "空床位": "Open Beds",
  "当前人员": "Current People",
  "人员信息": "Person Info",
  "房间信息": "Room Info",
  "请选择人员": "Please select a person",
  "请选择可用房间": "Please select an available room",
  "入住日期": "Check-in Date",
  "预计退宿日期": "Expected Checkout Date",
  "实际退宿日期": "Actual Checkout Date",
  "新增入住记录": "Add Allocation",
  "保存入住记录": "Save Allocation",
  "提交中...": "Submitting...",
  "退房": "Checkout",
  "已退宿": "Checked Out",
  "搜索入住分配记录": "Search allocation records",
  "车辆管理": "Vehicle Management",
  "新增车辆": "Add Vehicle",
  "保存车辆": "Save Vehicle",
  "搜索车辆记录": "Search vehicle records",
  "车牌号": "Plate Number",
  "座位数": "Seats",
  "座位": "Seats",
  "车辆类型": "Vehicle Type",
  "常驻宿舍": "Base Dorm",
  "选择车辆类型": "Select Vehicle Type",
  "选择常驻宿舍": "Select Base Dorm",
  "保险到期日": "Insurance Expiry Date",
  "年检到期日": "Inspection Expiry Date",
  "保养到期日": "Maintenance Due Date",
  "保险到期": "Insurance Expiry",
  "年检到期": "Inspection Expiry",
  "保养到期": "Maintenance Due",
  "可用": "Available",
  "维修": "Maintenance",
  "停用": "Disabled",
  "宿舍总数": "Dorm Total",
  "房间总数": "Room Total",
  "总床位数": "Total Beds",
  "当前入住人数": "Current Occupancy",
  "空床数": "Open Beds",
  "入住率": "Occupancy Rate",
  "风险人数(<=60天)": "Risk People (<=60 days)",
  "Red 风险人数": "Red Risk People",
  "Yellow 风险人数": "Yellow Risk People",
  "Green 正常人数": "Green Normal People",
  "点击查看明细": "Click to view details",
  "点击收起明细": "Click to collapse",
  "Unknown 未维护人数": "Unknown People",
  "可用车辆数": "Available Vehicles",
  "维修车辆数": "Maintenance Vehicles",
  "停用车辆数": "Disabled Vehicles",
  "30天内保险到期车辆数": "Insurance Expiring in 30 Days",
  "30天内年检到期车辆数": "Inspection Expiring in 30 Days",
  "30天内保养到期车辆数": "Maintenance Due in 30 Days",
  "未来30天最大停留到期": "Max Stay Expiring in 30 Days",
  "未来60天最大停留到期": "Max Stay Expiring in 60 Days",
  "已超期未离美": "Overstayed",
  "剩余": "Remaining",
  "超期": "Overdue",
  "天": "days",
  "系统信息": "System Info",
  "仅展示非敏感运行信息。": "Only non-sensitive runtime information is shown.",
  "当前版本": "Current Version",
  "数据库类型": "Database Type",
  "系统环境": "Environment",
  "当前用户": "Current User",
  "当前角色": "Current Role",
  "用户": "User",
  "新增用户": "Add User",
  "保存用户": "Save User",
  "显示名": "Display Name",
  "角色": "Role",
  "最后登录": "Last Login",
  "编辑": "Edit",
  "重置密码": "Reset Password",
  "用户已更新": "User updated",
  "用户已创建": "User created",
  "仅 admin 可维护系统账号、角色和状态。": "Only admins can manage system accounts, roles, and statuses.",
  "字典维护": "Dictionary Maintenance",
  "字典配置": "Dictionary Settings",
  "恢复默认": "Restore Defaults",
  "选项": "Options",
  "保存字典": "Save Dictionary",
  "显示名称": "Display Label",
  "保存值": "Stored Value",
  "新增显示名称": "New Display Label",
  "新增保存值": "New Stored Value",
  "新增": "Add",
  "保存风险处理信息": "Save Risk Handling Info",
  "已超期": "Overstayed",
  "30天内到期": "Due in 30 Days",
  "60天内到期": "Due in 60 Days",
  "未维护最大停留日期": "Missing Max Stay Date",
  "剩余合法停留天数": "Remaining Legal Stay Days",
  "风险等级": "Risk Level",
  "暂无用户": "No users",
  "加载用户失败": "Failed to load users",
  "保存失败": "Save failed",
  "Male": "Male",
  "Female": "Female",
  "Any": "Any",
  "Empty": "Empty",
  "Mixed": "Mixed",
  "Pure Male": "Pure Male",
  "Pure Female": "Pure Female",
  "active": "Active",
  "checked_out": "Checked Out",
  "available": "Available",
  "maintenance": "Maintenance",
  "disabled": "Disabled",
};

const reverseTranslations = Object.fromEntries(
  Object.entries(translations).map(([zh, en]) => [en, zh]),
);

const prefixTranslations = [
  ["在住人数：", "Occupancy: "],
  ["空床位：", "Open Beds: "],
  ["房间数：", "Rooms: "],
  ["宿舍数：", "Dorms: "],
  ["空铺：", "Empty Beds: "],
  ["床位总数：", "Total Beds: "],
  ["床头柜总数：", "Total Nightstands: "],
  ["垃圾桶总数：", "Total Trash Cans: "],
  ["当前人员：", "Current People: "],
  ["床位数：", "Beds: "],
  ["当前入住人数：", "Current Occupancy: "],
  ["性别限制：", "Gender Limit: "],
  ["姓名：", "Name: "],
  ["部门：", "Department: "],
  ["性别：", "Gender: "],
  ["人员类型：", "Person Type: "],
  ["剩余 ", "Remaining "],
  ["超期 ", "Overdue "],
];

const suffixTranslations = [[" 天", " days"]];

const LanguageContext = createContext<LanguageContextValue | null>(null);

function normalizeLanguage(value: string | null): Language {
  return value === "en" ? "en" : "zh";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)),
  );

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "zh" ? "en" : "zh"),
      text: (zhText: string) => (language === "en" ? translations[zhText] ?? zhText : zhText),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

function translateValue(value: string, language: Language) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  let body = value.trim();
  if (!body) return value;

  const exact = language === "en" ? translations[body] : reverseTranslations[body];
  if (exact) return `${leading}${exact}${trailing}`;

  const fromIndex = language === "en" ? 0 : 1;
  const toIndex = language === "en" ? 1 : 0;

  for (const pair of prefixTranslations) {
    if (body.startsWith(pair[fromIndex])) {
      body = `${pair[toIndex]}${body.slice(pair[fromIndex].length)}`;
    }
  }
  for (const pair of suffixTranslations) {
    if (body.endsWith(pair[fromIndex])) {
      body = `${body.slice(0, -pair[fromIndex].length)}${pair[toIndex]}`;
    }
  }
  return `${leading}${body}${trailing}`;
}

function translateElementTree(root: HTMLElement, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest("script,style,textarea")) continue;
    textNodes.push(node);
  }
  textNodes.forEach((node) => {
    const nextValue = translateValue(node.nodeValue ?? "", language);
    if (node.nodeValue !== nextValue) {
      node.nodeValue = nextValue;
    }
  });

  root.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]").forEach((element) => {
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const nextValue = translateValue(current, language);
      if (current !== nextValue) {
        element.setAttribute(attribute, nextValue);
      }
    });
  });
}

export function LanguageBoundary({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);

  useTranslateOnMutation(rootRef, language);

  return <div ref={rootRef}>{children}</div>;
}

function useTranslateOnMutation(rootRef: RefObject<HTMLElement | null>, language: Language) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let scheduled = false;
    const run = () => {
      scheduled = false;
      translateElementTree(root, language);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(run);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language, rootRef]);
}
