export type DictionaryKey =
  | "dormTypes"
  | "roomTypes"
  | "personTypes"
  | "departments"
  | "visaTypes"
  | "vehicleTypes"
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
  personTypes: "人员类型",
  departments: "部门",
  visaTypes: "签证类型",
  vehicleTypes: "车辆类型",
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
