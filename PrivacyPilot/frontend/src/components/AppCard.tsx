/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AppCardProps {
  id: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  hoverEffect?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({
  id,
  title,
  subtitle,
  headerAction,
  footer,
  className = '',
  children,
  hoverEffect = false,
}) => {
  return (
    <div
      id={id}
      className={`bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 ${
        hoverEffect ? 'hover:shadow-md hover:border-slate-350 dark:hover:border-slate-750 hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-150 leading-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-0.5 leading-none">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className="p-4">{children}</div>

      {footer && (
        <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
};
