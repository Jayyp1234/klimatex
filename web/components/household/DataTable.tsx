"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { downloadCsv } from "@/lib/household";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Sort key and CSV value. Columns without one can't be sorted or exported. */
  value?: (row: T) => string | number;
  align?: "right";
};

type Sort = { id: string; dir: "asc" | "desc" };

/** The one table used across the household app: search, filters, sorting, paging and CSV export. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Search",
  filters,
  exportName,
  initialSort,
  pageSizes = [10, 25, 50],
  onRowClick,
  empty = "Nothing to show yet.",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  exportName?: string;
  initialSort?: Sort;
  pageSizes?: number[];
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSizes[0]);

  const sorted = useMemo(() => {
    const term = query.trim().toLowerCase();
    const found = term && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(term)) : rows;
    const column = sort ? columns.find((c) => c.id === sort.id) : undefined;
    if (!sort || !column?.value) return found;
    const value = column.value;
    return [...found].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? order : -order;
    });
  }, [rows, columns, query, sort, searchText]);

  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * size, current * size + size);
  const from = sorted.length ? current * size + 1 : 0;
  const to = Math.min(sorted.length, (current + 1) * size);

  const toggleSort = (id: string) => {
    setSort((s) => (s?.id !== id ? { id, dir: "desc" } : s.dir === "desc" ? { id, dir: "asc" } : null));
    setPage(0);
  };

  const exportCsv = () => {
    const exportable = columns.filter((c) => c.value);
    downloadCsv(`${exportName}.csv`, exportable.map((c) => c.header), sorted.map((r) => exportable.map((c) => c.value!(r))));
  };

  return (
    <div>
      {(searchText || filters || exportName) && (
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
          {searchText && (
            <label className="relative w-full sm:w-[260px]">
              <span className="sr-only">{searchPlaceholder}</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-leaf focus:ring-4 focus:ring-leaf/12"
              />
            </label>
          )}
          {filters}
          {exportName && (
            <button type="button" onClick={exportCsv} disabled={!sorted.length} className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-mint disabled:opacity-50">
              <Download size={15} /> Export CSV
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-[#fafbf9] text-left text-[12px] uppercase tracking-[0.04em] text-muted">
              {columns.map((c) => {
                const active = sort?.id === c.id;
                const SortIcon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={`whitespace-nowrap px-4 py-3 font-semibold first:pl-5 last:pr-5 ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.value ? (
                      <button type="button" onClick={() => toggleSort(c.id)} className={`inline-flex items-center gap-1.5 uppercase hover:text-ink ${active ? "text-ink" : ""}`}>
                        {c.header} <SortIcon size={13} aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-body">
                  {query ? "No rows match your search." : empty}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-line last:border-0 ${onRowClick ? "cursor-pointer hover:bg-[#fafbf9]" : ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.id} className={`whitespace-nowrap px-4 py-3.5 first:pl-5 last:pr-5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSizes[0] && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-body">
          <span>
            Showing <strong className="font-medium text-ink">{from}–{to}</strong> of {sorted.length}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Rows
              <select
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value));
                  setPage(0);
                }}
                className="h-8 rounded-lg border border-line bg-white px-2 outline-none focus:border-leaf"
              >
                {pageSizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-lg border border-line p-1.5 hover:bg-mint disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[64px] text-center">Page {current + 1} of {pages}</span>
              <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-lg border border-line p-1.5 hover:bg-mint disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
