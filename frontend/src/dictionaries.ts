export type DictionaryKey =
  | "dormTypes"
  | "roomTypes"
  | "assetItems"
  | "personTypes"
  | "departments"
  | "visaTypes"
  | "vehicleTypes"
  | "insuranceCoverageTypes"
  | "maintenanceItems"
  | "accidentTypes"
  | "liabilityTypes"
  | "vehicleVendors"
  | "maintenanceIntervalDefaults"
  | "feeTypes"
  | "statuses";

export type DictionaryOption = {
  label: string;
  value: string;
  sort_order?: number;
};

export type DictionaryState = Record<DictionaryKey, DictionaryOption[]>;

export const dictionaryLabels: Record<DictionaryKey, string> = {
  dormTypes: "宿舍类型",
  roomTypes: "房间类型",
  assetItems: "资产物品",
  personTypes: "人员类型",
  departments: "部门",
  visaTypes: "签证类型",
  vehicleTypes: "车辆类型",
  insuranceCoverageTypes: "险种",
  maintenanceItems: "保养项目",
  accidentTypes: "事故类型",
  liabilityTypes: "责任判定",
  vehicleVendors: "车辆供应商",
  maintenanceIntervalDefaults: "保养间隔默认值",
  feeTypes: "缴费类型",
  statuses: "状态",
};

export const defaultDictionaries: DictionaryState = {
  dormTypes: [
    { label: "House", value: "House" },
    { label: "Apartment", value: "Apartment" },
    { label: "Hotel", value: "Hotel" },
  ],
  roomTypes: [
    { label: "Single", value: "Single" },
    { label: "Double", value: "Double" },
    { label: "Suite", value: "Suite" },
  ],
  assetItems: [
    { label: "床", value: "床" },
    { label: "灯", value: "灯" },
    { label: "床头柜", value: "床头柜" },
    { label: "垃圾桶", value: "垃圾桶" },
  ],
  personTypes: [
    { label: "Employee", value: "Employee" },
    { label: "Contractor", value: "Contractor" },
    { label: "Visitor", value: "Visitor" },
  ],
  departments: [
    { label: "IT", value: "IT" },
    { label: "质量", value: "质量" },
    { label: "生产", value: "生产" },
    { label: "技术", value: "技术" },
    { label: "设备", value: "设备" },
    { label: "EHS", value: "EHS" },
    { label: "仓库", value: "仓库" },
    { label: "HR", value: "HR" },
    { label: "财务", value: "财务" },
    { label: "行政", value: "行政" },
    { label: "采购", value: "采购" },
    { label: "物流", value: "物流" },
  ],
  visaTypes: [
    { label: "B1/B2", value: "B1/B2" },
    { label: "L1", value: "L1" },
    { label: "H1B", value: "H1B" },
    { label: "ESTA", value: "ESTA" },
  ],
  vehicleTypes: [
    { label: "SUV", value: "SUV" },
    { label: "Sedan", value: "Sedan" },
    { label: "Van", value: "Van" },
    { label: "Pickup", value: "Pickup" },
    { label: "Other", value: "Other" },
  ],
  insuranceCoverageTypes: [
    { label: "Liability", value: "Liability" },
    { label: "Collision", value: "Collision" },
    { label: "Comprehensive", value: "Comprehensive" },
    { label: "Full Coverage", value: "Full Coverage" },
  ],
  maintenanceItems: [
    { label: "换机油", value: "换机油" },
    { label: "换机油滤", value: "换机油滤" },
    { label: "换空气滤", value: "换空气滤" },
    { label: "轮胎更换", value: "轮胎更换" },
    { label: "四轮定位", value: "四轮定位" },
    { label: "刹车片", value: "刹车片" },
    { label: "电瓶", value: "电瓶" },
    { label: "变速箱油", value: "变速箱油" },
  ],
  accidentTypes: [
    { label: "单方事故", value: "单方事故" },
    { label: "双方碰撞", value: "双方碰撞" },
    { label: "停车剐蹭", value: "停车剐蹭" },
    { label: "被追尾", value: "被追尾" },
    { label: "车辆被撞（无人在车）", value: "车辆被撞（无人在车）" },
    { label: "其他", value: "其他" },
  ],
  liabilityTypes: [
    { label: "全责", value: "全责" },
    { label: "主要责任", value: "主要责任" },
    { label: "同等责任", value: "同等责任" },
    { label: "次要责任", value: "次要责任" },
    { label: "无责", value: "无责" },
    { label: "待定", value: "待定" },
  ],
  vehicleVendors: [],
  maintenanceIntervalDefaults: [
    { label: "保养里程间隔 (miles)", value: "miles:5000" },
    { label: "保养月数间隔 (months)", value: "months:6" },
  ],
  feeTypes: [
    { label: "房租", value: "房租" },
    { label: "水费", value: "水费" },
    { label: "电费", value: "电费" },
    { label: "网费", value: "网费" },
    { label: "燃气费", value: "燃气费" },
  ],
  statuses: [
    { label: "active", value: "active" },
    { label: "inactive", value: "inactive" },
  ],
};

export function mergeDictionaries(dictionaries: Partial<DictionaryState>): DictionaryState {
  return {
    ...defaultDictionaries,
    ...dictionaries,
  };
}
