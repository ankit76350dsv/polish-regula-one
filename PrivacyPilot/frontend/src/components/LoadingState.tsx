/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LoadingStateProps {
  id: string;
  message?: string;
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  id,
  message = 'Retrieving compliance records...',
  rows = 4,
}) => {
  return (
    <div id={id} className="w-full flex flex-col items-center justify-center py-12 px-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        {/* Shimmer items */}
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 w-full animate-pulse">
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-sm w-1/3" />
            <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg w-full" />
          </div>
        ))}
        <div className="text-center mt-3 text-xs font-medium text-slate-400 animate-pulse">
          {message}
        </div>
      </div>
    </div>
  );
};
