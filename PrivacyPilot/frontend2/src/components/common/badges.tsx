/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface RiskBadgeProps {
  level?: 'low' | 'medium' | 'high' | 'critical' | string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level = 'low' }) => {
  const norm = level.toLowerCase();
  switch (norm) {
    case 'critical':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900">
          ● Krytyczne / Critical
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
          ● Wysokie / High
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900">
          ● Średnie / Medium
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          ● Niskie / Low
        </span>
      );
  }
};

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const norm = status.toLowerCase();
  switch (norm) {
    case 'approved':
    case 'completed':
    case 'resolved':
    case 'published':
    case 'active':
    case 'signed':
    case 'eea_only':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          Zatwierdzone / Approved
        </span>
      );
    case 'in_review':
    case 'legal_review':
    case 'advice_pending':
    case 'triage':
    case 'in_progress':
    case 'in_negotiation':
    case 'safeguards_active':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          W toku / In Review
        </span>
      );
    case 'action_required':
    case 'dpo_advice':
    case 'no_safeguards_warning':
    case 'missing':
    case 'overdue':
    case 'alert':
    case 'open':
    case 'risk_assessment':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
          Wymaga Akcji / Action Required
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          Szkic / Draft
        </span>
      );
  }
};
