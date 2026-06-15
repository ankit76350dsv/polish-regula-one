/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AppTextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const AppTextField: React.FC<AppTextFieldProps> = ({
  id,
  label,
  error,
  helperText,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[11px] font-bold text-slate-700 dark:text-slate-350 tracking-tight">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-2.5 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={`w-full text-xs rounded-md border px-3 py-1.5 transition-all duration-200 outline-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400/80 focus:ring-1 ${
            icon ? 'pl-8.5' : ''
          } ${
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-750 focus:border-indigo-500 focus:ring-indigo-505/15'
          }`}
          {...props}
        />
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
