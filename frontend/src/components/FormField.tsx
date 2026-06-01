import type { ReactNode } from "react";

type FormFieldProps = {
  children: ReactNode;
  label: string;
  required?: boolean;
  className?: string;
};

export function FormField({ children, label, required = false, className = "" }: FormFieldProps) {
  return (
    <label className={`space-y-1 text-sm font-medium text-slate-700 ${className}`}>
      <span>
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export const fieldControlClass = "w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900";

export const primaryButtonClass = "rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700";

export const secondaryButtonClass =
  "rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-100";

export const editButtonClass = "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100";

export const deleteButtonClass = "rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50";
