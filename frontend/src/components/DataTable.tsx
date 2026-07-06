import type { CSSProperties, ReactNode } from "react";

type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyText?: string;
  rowStyle?: (row: T) => CSSProperties | undefined;
};

export function DataTable<T>({ columns, rows, rowKey, emptyText = "暂无数据", rowStyle }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className="whitespace-nowrap px-3 py-2.5 font-semibold sm:px-4 sm:py-3">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-400" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition hover:bg-slate-50/70" style={rowStyle?.(row)}>
              {columns.map((column) => (
                <td key={column.header} className="px-3 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
