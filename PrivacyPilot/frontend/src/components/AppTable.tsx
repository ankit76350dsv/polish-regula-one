/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUpDown } from 'lucide-react';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface AppTableProps<T> {
  id: string;
  columns: TableColumn<T>[];
  data: T[];
  onSort?: (key: string) => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  selectable?: boolean;
  selectedIds?: string[];
  onSelectAll?: (checked: boolean) => void;
  onSelectRow?: (rowId: string, checked: boolean) => void;
  getRowId?: (row: T) => string;
}

export function AppTable<T>({
  id,
  columns,
  data,
  onSort,
  sortKey,
  sortOrder,
  selectable = false,
  selectedIds = [],
  onSelectAll,
  onSelectRow,
  getRowId,
}: AppTableProps<T>) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;

  return (
    <div id={id} className="w-full overflow-x-auto rounded-md border border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850">
            {selectable && onSelectAll && (
              <th className="w-10 px-3 py-2 text-center border-b border-slate-200 dark:border-slate-850">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-3 w-3 rounded-xs border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500/10"
                />
              </th>
            )}
            {columns.map((col, index) => (
              <th
                key={index}
                className="px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 select-none border-b border-slate-200 dark:border-slate-850"
              >
                {col.sortable && onSort ? (
                  <button
                    onClick={() => onSort(col.key as string)}
                    className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors uppercase font-extrabold text-[10px] tracking-widest"
                  >
                    {col.header}
                    <ArrowUpDown className="h-2.5 w-2.5" />
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-6 text-xs text-slate-400">
                No matching compliance logs found
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const rowId = getRowId ? getRowId(row) : (row as any).id || String(rowIndex);
              const isSelected = selectedIds.includes(rowId);

              return (
                <tr
                  key={rowId}
                  className={`hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors ${
                    isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                  }`}
                >
                  {selectable && onSelectRow && (
                    <td className="px-3 py-2 text-center border-b border-dotted border-slate-200 dark:border-slate-800/80">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelectRow(rowId, e.target.checked)}
                        className="h-3 w-3 rounded-xs border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500/10"
                      />
                    </td>
                  )}
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className="px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 border-b border-dotted border-slate-200 dark:border-slate-800/80">
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
