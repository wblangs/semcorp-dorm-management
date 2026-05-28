import { FormEvent, useState } from "react";

import {
  defaultDictionaries,
  dictionaryLabels,
  saveDictionaries,
} from "../dictionaries";
import type { DictionaryKey, DictionaryOption } from "../dictionaries";
import { useDictionaries } from "../hooks/useDictionaries";

const dictionaryKeys = Object.keys(dictionaryLabels) as DictionaryKey[];

const emptyOption = { label: "", value: "" };

export function DictionariesPage() {
  const dictionaries = useDictionaries();
  const [drafts, setDrafts] = useState<Record<DictionaryKey, DictionaryOption>>({
    dormTypes: emptyOption,
    roomTypes: emptyOption,
    personTypes: emptyOption,
    visaTypes: emptyOption,
    statuses: emptyOption,
  });

  const updateDictionary = (key: DictionaryKey, options: DictionaryOption[]) => {
    saveDictionaries({ ...dictionaries, [key]: options });
  };

  const onAdd = (event: FormEvent, key: DictionaryKey) => {
    event.preventDefault();
    const draft = drafts[key];
    const value = draft.value.trim() || draft.label.trim();
    const label = draft.label.trim() || value;
    if (!value || !label) return;
    updateDictionary(key, [...dictionaries[key], { label, value }]);
    setDrafts((current) => ({ ...current, [key]: emptyOption }));
  };

  const restoreDefaults = () => {
    if (!confirm("确认恢复全部默认字典？")) return;
    saveDictionaries(defaultDictionaries);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">字典配置</h2>
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          type="button"
          onClick={restoreDefaults}
        >
          恢复默认
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {dictionaryKeys.map((key) => (
          <section key={key} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">{dictionaryLabels[key]}</h3>
            <div className="mb-3 space-y-2">
              {dictionaries[key].map((option, index) => (
                <div key={`${option.value}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={option.label}
                    aria-label={`${dictionaryLabels[key]}显示名称`}
                    onChange={(event) => {
                      const options = dictionaries[key].map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item,
                      );
                      updateDictionary(key, options);
                    }}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={option.value}
                    aria-label={`${dictionaryLabels[key]}保存值`}
                    onChange={(event) => {
                      const options = dictionaries[key].map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value: event.target.value } : item,
                      );
                      updateDictionary(key, options);
                    }}
                  />
                  <button
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    type="button"
                    onClick={() => updateDictionary(key, dictionaries[key].filter((_, itemIndex) => itemIndex !== index))}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={(event) => onAdd(event, key)} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="显示名称"
                value={drafts[key].label}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [key]: { ...current[key], label: event.target.value } }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="保存值"
                value={drafts[key].value}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [key]: { ...current[key], value: event.target.value } }))
                }
              />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" type="submit">
                新增
              </button>
            </form>
          </section>
        ))}
      </div>
    </section>
  );
}
