"use client";

import { ChevronLeft, ChevronRight, Pencil, Trash2, Eye, DatabaseZap } from "lucide-react";

export interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface Props {
  columns: Column[];
  data: Record<string, unknown>[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit?: (row: Record<string, unknown>) => void;
  onDelete?: (row: Record<string, unknown>) => void;
  onView?: (row: Record<string, unknown>) => void;
  loading?: boolean;
}

const SKELETON_WIDTHS = ["72%", "88%", "60%", "80%", "68%"];

export default function AdminTable({
  columns,
  data,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onView,
  loading,
}: Props) {
  const showActions = onEdit || onDelete || onView;
  const perPage = 15;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  function getPageNumbers(): number[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  }

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-zinc-200/80 bg-white shadow-[0_22px_70px_-45px_rgba(15,23,42,0.55)] ring-1 ring-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200/80 bg-zinc-50/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500"
                >
                  {col.label}
                </th>
              ))}
              {showActions && (
                <th className="px-4 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col, j) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div
                        className="h-4 rounded-full bg-zinc-100"
                        style={{ width: SKELETON_WIDTHS[(i + j) % SKELETON_WIDTHS.length] }}
                      />
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-4 py-3.5">
                      <div className="ml-auto h-7 w-20 rounded-lg bg-zinc-100" />
                    </td>
                  )}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showActions ? 1 : 0)}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
                      <DatabaseZap className="h-5 w-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-700">No live records found</p>
                      <p className="mt-0.5 text-xs text-zinc-400">Try adjusting the search or filters</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={String(row.id ?? i)}
                  className="transition-colors duration-150 hover:bg-orange-50/40"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 text-zinc-700">
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-4 py-3.5">
                      <div className="ml-auto inline-flex items-center justify-end rounded-xl border border-zinc-200 bg-zinc-50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                        {onView && (
                          <button
                            onClick={() => onView(row)}
                            className="rounded-lg p-2 text-zinc-500 transition-[background-color,color,transform] hover:bg-white hover:text-orange-600 hover:shadow-sm active:scale-[0.97]"
                            title="View details"
                            aria-label="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="rounded-lg p-2 text-zinc-500 transition-[background-color,color,transform] hover:bg-white hover:text-zinc-950 hover:shadow-sm active:scale-[0.97]"
                            title="Edit"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="rounded-lg p-2 text-zinc-500 transition-[background-color,color,transform] hover:bg-red-50 hover:text-red-600 active:scale-[0.97]"
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer — always shown */}
      <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-4 py-3">
        <span className="text-xs text-zinc-500">
          {total === 0
            ? "No records"
            : `Showing ${from}–${to} of ${total.toLocaleString()} records`}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition-[background-color,box-shadow,transform] hover:bg-white hover:shadow-sm active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {getPageNumbers().map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                  page === p
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition-[background-color,box-shadow,transform] hover:bg-white hover:shadow-sm active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
