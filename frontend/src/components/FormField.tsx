import type { ReactNode } from "react";

type FormFieldProps = {
  children: ReactNode;
  label: string;
  required?: boolean;
  className?: string;
};

export function FormField({ children, label, required = false, className = "" }: FormFieldProps) {
  return (
    <label className={`space-y-1.5 text-sm font-medium text-slate-700 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export const fieldControlClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50";

export const editButtonClass =
  "inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50";

export const deleteButtonClass =
  "inline-flex items-center rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 shadow-sm transition hover:bg-rose-50";
