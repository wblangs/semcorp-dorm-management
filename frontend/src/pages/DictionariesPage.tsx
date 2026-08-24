import { FormEvent, useState } from "react";

import {
  defaultDictionaries,
  dictionaryLabels,
} from "../dictionaries";
import type { DictionaryKey, DictionaryOption } from "../dictionaries";
import { api } from "../api";
import { deleteButtonClass, fieldControlClass, FormField, primaryButtonClass } from "../components/FormField";
import { useDictionaries } from "../hooks/useDictionaries";
import { ErrorDialog } from "../components/ErrorDialog";

const dictionaryKeys = Object.keys(dictionaryLabels) as DictionaryKey[];

const emptyOption = { label: "", value: "" };

export function DictionariesPage() {
  const dictionaries = useDictionaries();
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<DictionaryKey, DictionaryOption>>(
    () =>
      Object.fromEntries(dictionaryKeys.map((key) => [key, emptyOption])) as Record<
        DictionaryKey,
        DictionaryOption
      >,
  );

  const updateDictionary = async (key: DictionaryKey, options: DictionaryOption[]) => {
    setError("");
    try {
      await api.replaceDictionary(key, {
        label: dictionaryLabels[key],
        items: options.map((option, index) => ({ ...option, sort_order: index })),
      });
      window.dispatchEvent(new Event("dictionaries:updated"));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onAdd = (event: FormEvent, key: DictionaryKey) => {
    event.preventDefault();
    const draft = drafts[key];
    const value = draft.value.trim() || draft.label.trim();
    const label = draft.label.trim() || value;
    if (!value || !label) return;
    void updateDictionary(key, [...dictionaries[key], { label, value }]);
    setDrafts((current) => ({ ...current, [key]: emptyOption }));
  };

  const restoreDefaults = async () => {
    if (!confirm("确认恢复全部默认字典？")) return;
    setError("");
    try {
      await Promise.all(
        dictionaryKeys.map((key) =>
          api.replaceDictionary(key, {
            label: dictionaryLabels[key],
            items: defaultDictionaries[key].map((option, index) => ({ ...option, sort_order: index })),
          }),
        ),
      );
      window.dispatchEvent(new Event("dictionaries:updated"));
    } catch (err) {
      setError((err as Error).message);
    }
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
      <ErrorDialog message={error} onClose={() => setError("")} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {dictionaryKeys.map((key) => (
          <section key={key} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">{dictionaryLabels[key]}</h3>
            <div className="mb-3 space-y-2">
              {dictionaries[key].map((option, index) => (
                <div key={`${option.value}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <FormField label="显示名称">
                  <input
                    className={fieldControlClass}
                    value={option.label}
                    aria-label={`${dictionaryLabels[key]}显示名称`}
                    onChange={(event) => {
                      const options = dictionaries[key].map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item,
                      );
                      void updateDictionary(key, options);
                    }}
                  />
                  </FormField>
                  <FormField label="保存值">
                  <input
                    className={fieldControlClass}
                    value={option.value}
                    aria-label={`${dictionaryLabels[key]}保存值`}
                    onChange={(event) => {
                      const options = dictionaries[key].map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value: event.target.value } : item,
                      );
                      void updateDictionary(key, options);
                    }}
                  />
                  </FormField>
                  <button
                    className={`${deleteButtonClass} self-end rounded-lg px-3 py-2 text-sm`}
                    type="button"
                    onClick={() => {
                      if (!confirm("确认删除该字典项？")) return;
                      void updateDictionary(key, dictionaries[key].filter((_, itemIndex) => itemIndex !== index));
                    }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={(event) => onAdd(event, key)} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
              <FormField label="新增显示名称">
              <input
                className={fieldControlClass}
                value={drafts[key].label}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [key]: { ...current[key], label: event.target.value } }))
                }
              />
              </FormField>
              <FormField label="新增保存值">
              <input
                className={fieldControlClass}
                value={drafts[key].value}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [key]: { ...current[key], value: event.target.value } }))
                }
              />
              </FormField>
              <button className={`${primaryButtonClass} self-end`} type="submit">
                新增
              </button>
            </form>
          </section>
        ))}
      </div>
    </section>
  );
}
