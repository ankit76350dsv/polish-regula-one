/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check } from 'lucide-react';

interface AppStepperProps {
  id: string;
  steps: string[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export const AppStepper: React.FC<AppStepperProps> = ({
  id,
  steps,
  currentStep,
  onStepClick,
}) => {
  return (
    <div id={id} className="w-full flex flex-col gap-4">
      {/* Dynamic Header representation for smaller viewports */}
      <div className="flex md:hidden justify-between items-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4.5 rounded-lg mb-2">
        <div>
          <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-500">
            Step {currentStep + 1} of {steps.length}
          </span>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
            {steps[currentStep]}
          </h4>
        </div>
        <div className="text-xs font-mono font-bold bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-sm">
          {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
        </div>
      </div>

      {/* Progress Line */}
      <div className="relative w-full hidden md:block">
        <div className="absolute top-4 left-0 w-full h-[3px] bg-slate-100 dark:bg-slate-800 -z-10 rounded-full" />
        <div
          className="absolute top-4 left-0 h-[3px] bg-indigo-500 -z-10 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        <div className="flex justify-between items-start">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isActive = idx === currentStep;

            return (
              <button
                key={idx}
                type="button"
                disabled={!onStepClick}
                onClick={() => onStepClick && onStepClick(idx)}
                className="flex flex-col items-center flex-1 focus:outline-hidden disabled:cursor-default"
                style={{ minWidth: '70px' }}
              >
                <div
                  className={`w-8.5 h-8.5 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300 ${
                    isCompleted
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                      : isActive
                      ? 'bg-white dark:bg-slate-950 border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-4 ring-indigo-500/10'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {isCompleted ? <Check className="h-4.5 w-4.5 stroke-[2.5]" /> : idx + 1}
                </div>

                <span
                  className={`text-[10px] text-center mt-2 font-bold px-1 line-clamp-2 leading-tight transition-colors duration-250 ${
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400 font-extrabold'
                      : isCompleted
                      ? 'text-slate-700 dark:text-slate-355'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {step}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
