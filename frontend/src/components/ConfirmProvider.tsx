import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

import { deleteButtonClass, fieldControlClass, primaryButtonClass, secondaryButtonClass } from "./FormField";

// 应用内确认/输入弹窗，替代原生 window.confirm / window.prompt。
// 原因：部分公司安全浏览器会拦截原生弹窗（弹窗不出现、静默返回取消），
// 表现为"保存/删除按钮点了没反应"。全站统一走这里，行为在所有浏览器一致。

type ConfirmOptions = {
  title?: string;
  /** 确认按钮使用红色危险样式（删除类操作） */
  danger?: boolean;
  confirmText?: string;
};

type PromptOptions = {
  title?: string;
  defaultValue?: string;
  placeholder?: string;
  /** input type，如 number */
  inputType?: string;
};

type ConfirmState = { kind: "confirm"; message: string } & ConfirmOptions;
type PromptState = { kind: "prompt"; message: string } & PromptOptions;

type ConfirmContextValue = {
  confirmDialog: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  promptDialog: (message: string, options?: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return value;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | PromptState | null>(null);
  const [inputValue, setInputValue] = useState("");
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const promptResolver = useRef<((value: string | null) => void) | null>(null);

  const confirmDialog = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setState({ kind: "confirm", message, ...options });
    });
  }, []);

  const promptDialog = useCallback((message: string, options: PromptOptions = {}) => {
    return new Promise<string | null>((resolve) => {
      promptResolver.current = resolve;
      setInputValue(options.defaultValue ?? "");
      setState({ kind: "prompt", message, ...options });
    });
  }, []);

  const close = (confirmed: boolean) => {
    if (state?.kind === "confirm") {
      confirmResolver.current?.(confirmed);
      confirmResolver.current = null;
    } else if (state?.kind === "prompt") {
      promptResolver.current?.(confirmed ? inputValue : null);
      promptResolver.current = null;
    }
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirmDialog, promptDialog }}>
      {children}
      {state ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{state.title ?? "请确认"}</h3>
            <p className="whitespace-pre-line text-sm text-slate-600">{state.message}</p>
            {state.kind === "prompt" ? (
              <input
                className={`${fieldControlClass} mt-3`}
                type={state.inputType ?? "text"}
                value={inputValue}
                placeholder={state.placeholder}
                autoFocus
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") close(true);
                }}
              />
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button className={secondaryButtonClass} type="button" onClick={() => close(false)}>
                取消
              </button>
              <button
                className={state.kind === "confirm" && state.danger ? `${deleteButtonClass} px-4 py-2 text-sm` : primaryButtonClass}
                type="button"
                autoFocus={state.kind === "confirm"}
                onClick={() => close(true)}
              >
                {(state.kind === "confirm" && state.confirmText) || "确认"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
