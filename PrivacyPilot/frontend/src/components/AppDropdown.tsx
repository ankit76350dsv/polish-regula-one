/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface DropdownItem {
  value: string;
  label: string;
}

interface AppDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label?: string;
  items: DropdownItem[];
  error?: string;
  helperText?: string;
}

export const AppDropdown: React.FC<AppDropdownProps> = ({
  id,
  label,
  items,
  error,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={`w-full text-sm rounded-lg border px-3.5 py-2.5 transition-all duration-200 outline-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/10'
          }`}
          {...props}
        >
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
      {error && (
        <span className="text-xs text-red-500 font-medium">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span className="text-xs text-slate-400">
          {helperText}
        </span>
      )}
    </div>
  );
};
