export type DictionaryKey =
  | "dormTypes"
  | "roomTypes"
  | "personTypes"
  | "visaTypes"
  | "statuses";

export type DictionaryOption = {
  label: string;
  value: string;
};

export type DictionaryState = Record<DictionaryKey, DictionaryOption[]>;

export const dictionaryLabels: Record<DictionaryKey, string> = {
  dormTypes: "宿舍类型",
  roomTypes: "房间类型",
  personTypes: "人员类型",
  visaTypes: "签证类型",
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
  visaTypes: [
    { label: "B1/B2", value: "B1/B2" },
    { label: "L1", value: "L1" },
    { label: "H1B", value: "H1B" },
    { label: "ESTA", value: "ESTA" },
  ],
  statuses: [
    { label: "active", value: "active" },
    { label: "inactive", value: "inactive" },
  ],
};

const storageKey = "dormCommuteDictionaries";

export function loadDictionaries(): DictionaryState {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaultDictionaries;
    const parsed = JSON.parse(stored) as Partial<DictionaryState>;
    return {
      ...defaultDictionaries,
      ...parsed,
    };
  } catch {
    return defaultDictionaries;
  }
}

export function saveDictionaries(dictionaries: DictionaryState) {
  window.localStorage.setItem(storageKey, JSON.stringify(dictionaries));
  window.dispatchEvent(new Event("dictionaries:updated"));
}
