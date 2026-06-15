/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Award,
  ArrowUpRight,
  TrendingUp,
  FileCheck,
  Layers,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { ProcessingActivity, AuditLog } from '../types';

interface DashboardFeatureProps {
  id: string;
  activities: ProcessingActivity[];
  audits: AuditLog[];
  onNavigate: (route: string) => void;
  onRefreshData: () => void;
}

export const DashboardFeature: React.FC<DashboardFeatureProps> = ({
  id,
  activities,
  audits,
  onNavigate,
  onRefreshData,
}) => {
  const [hoveredChartBar, setHoveredChartBar] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // Computed Indicators
  const totalActivities = activities.length;
  const dpiaRequiredActivities = activities.filter((a) => a.dpiaRequired).length;
  const expiredOrExpiringCount = activities.filter(
    (a) => a.retentionPeriod.includes('1 Year') || a.retentionPeriod.includes('6 Months')
  ).length;

  const complianceScore = Math.round(
    ((activities.filter((a) => a.status === 'Active').length * 10 +
      activities.filter((a) => !a.dpiaRequired || (a.dpiaRequired && a.status === 'Active')).length * 10) /
      (totalActivities * 20)) *
      100 || 84
  );

  // Department counts for the Bar Chart
  const deptCounts: Record<string, number> = {};
  activities.forEach((act) => {
    deptCounts[act.department] = (deptCounts[act.department] || 0) + 1;
  });

  const barChartData = Object.entries(deptCounts).map(([department, count]) => ({
    department,
    count,
  }));

  // Legal basis counts for Pie segments
  const basisCounts: Record<string, number> = {};
  activities.forEach((act) => {
    const brief = act.legalBasis.split(' ')[0];
    basisCounts[brief] = (basisCounts[brief] || 0) + 1;
  });

  const pieChartData = Object.entries(basisCounts).map(([basis, count]) => ({
    basis,
    count,
    color:
      basis === 'Consent'
        ? '#6366f1' // Indigo
        : basis === 'Contract'
        ? '#10b981' // Emerald
        : basis === 'Legal'
        ? '#3b82f6' // Blue
        : basis === 'Legitimate'
        ? '#f59e0b' // Amber
        : '#8b5cf6', // Violet
  }));

  const totalBasisCount = Object.values(basisCounts).reduce((a, b) => a + b, 0);

  return (
    <div id={id} className="space-y-6">
      {/* Top Banner section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 dark:bg-slate-950 text-white rounded-md p-4.5 border border-slate-200 dark:border-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -z-10" />
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-slate-850/40 rounded-full blur-2xl -z-10" />

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-indigo-900 border border-indigo-700/55 text-indigo-300 font-extrabold uppercase rounded-md px-2 py-0.5 tracking-wider inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 animate-pulse" /> Live Audit Shield
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-sm">
              Art. 30 GDPR Secured
            </span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-50">
            Compliance Command Center
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            You are viewing the <strong className="text-slate-200">PrivacyPilot</strong> SaaS module. ROPA and DPIA risk indices are compiled continuously for external auditor analysis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AppButton
            id="btn-re-verify"
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs py-2 h-9"
            onClick={onRefreshData}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Recalculate Indices
          </AppButton>
          <AppButton
            id="btn-new-ropa"
            variant="primary"
            className="text-xs py-2 h-9"
            onClick={() => onNavigate('/activities?action=create')}
          >
            Launch GDPR Wizard
          </AppButton>
        </div>
      </div>

      {/* Numerical Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Activities */}
        <div
          onClick={() => onNavigate('/activities')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-md p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 dark:hover:border-slate-755 cursor-pointer transition-all duration-300 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Processing Activities (ROPA)
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {totalActivities}
            </span>
            <span className="text-[10px] text-green-500 font-bold inline-flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> Active
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
            <span>Core processing registers</span>
            <span className="text-indigo-500 hover:underline">View register →</span>
          </p>
        </div>

        {/* DPIA Required Card */}
        <div
          onClick={() => onNavigate('/dpia')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 rounded-md p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 dark:hover:border-slate-755 cursor-pointer transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              High-Risk DPIA Watch
            </span>
            <div className={`p-2 rounded-lg ${dpiaRequiredActivities > 0 ? 'bg-amber-50 dark:bg-amber-950/45 text-amber-600 dark:text-amber-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {dpiaRequiredActivities}
            </span>
            <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 dark:bg-amber-500/20 px-1.5 py-0.5 rounded-sm">
              Art 35
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
            <span>Automatic sensitivity scans</span>
            <span className="text-amber-500 hover:underline">Verify risks →</span>
          </p>
        </div>

        {/* Expiring records */}
        <div
          onClick={() => onNavigate('/settings')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 rounded-md p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 dark:hover:border-slate-755 cursor-pointer transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Retention Warning Rules
            </span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-rose-600 dark:text-rose-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {expiredOrExpiringCount}
            </span>
            <span className="text-[10px] text-rose-400 font-medium">
              Limits Applied
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
            <span>Requires review checks</span>
            <span className="text-rose-500 hover:underline">Edit limits →</span>
          </p>
        </div>

        {/* Compliance Rating Card */}
        <div
          className="bg-gradient-to-br from-indigo-950 to-slate-950 dark:from-slate-900 dark:to-slate-950 text-white rounded-md p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative overflow-hidden border border-slate-200 dark:border-slate-850"
        >
          <div className="absolute -right-3 -top-3 h-24 w-24 bg-white/5 rounded-full" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-250">
              Compliance Score Rating
            </span>
            <div className="p-2 bg-white/10 rounded-lg text-indigo-300">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-100">
              {complianceScore}%
            </span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              A+ Grade
            </span>
          </div>
          <p className="text-[10px] text-indigo-300/80 mt-1.5">
            Audit Ready Status: Verified compliant under Art 32.
          </p>
        </div>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
        {/* ROPA Legal Basis Segmentation - Pie Chart (lg:col-span-5) */}
        <AppCard
          id="card-pie-chart"
          title="ROPA Data Legal Basis Distribution"
          subtitle="Proportion of activities mapped to Art 6 GDPR basis"
          className="col-span-1 lg:col-span-5"
        >
          <div className="flex flex-col items-center">
            {/* Custom SVG Pie Chart */}
            <div className="relative w-44 h-44 mt-2">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {(() => {
                  let accumulatedAngle = 0;
                  return pieChartData.map((seg, idx) => {
                    const percentage = seg.count / totalBasisCount;
                    const angle = percentage * 360;

                    // Compute start and end points of arc
                    const r = 38; // Radius
                    const cx = 50;
                    const cy = 50;

                    const x1 = cx + r * Math.cos((accumulatedAngle * Math.PI) / 180);
                    const y1 = cy + r * Math.sin((accumulatedAngle * Math.PI) / 180);

                    accumulatedAngle += angle;

                    const x2 = cx + r * Math.cos((accumulatedAngle * Math.PI) / 180);
                    const y2 = cy + r * Math.sin((accumulatedAngle * Math.PI) / 180);

                    // Large arc flag
                    const largeArcFlag = angle > 180 ? 1 : 0;

                    // Path data
                    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                    return (
                      <path
                        key={idx}
                        d={d}
                        fill={seg.color}
                        stroke="#1e293b animate-pulse"
                        strokeWidth="1"
                        className="transition-all duration-300 hover:opacity-80"
                        onMouseEnter={() => setHoveredSegment(seg.basis)}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                    );
                  });
                })()}
                {/* Center Hole for Donut-style */}
                <circle cx="50" cy="50" r="22" className="fill-white dark:fill-slate-900" />
              </svg>
              {/* Central Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                  {totalActivities}
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                  Total ROPA
                </span>
              </div>
            </div>

            {/* Legends Row */}
            <div className="grid grid-cols-2 gap-3 w-full mt-6 text-xs">
              {pieChartData.map((seg) => (
                <div
                  key={seg.basis}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all ${
                    hoveredSegment === seg.basis
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-350 dark:border-slate-700'
                      : 'border-transparent'
                  }`}
                >
                  <div className="w-3 h-3 rounded-xs flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">
                    {seg.basis}
                  </span>
                  <span className="ml-auto font-extrabold text-slate-800 dark:text-slate-100">
                    {seg.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </AppCard>

        {/* Processing Activities by Department - Bar Chart (lg:col-span-7) */}
        <AppCard
          id="card-bar-chart"
          title="Processing Activities by Organization Unit"
          subtitle="Distribution of Article 30 registries across enterprise departments"
          className="col-span-1 lg:col-span-7"
          headerAction={
            <div className="text-[11px] text-slate-400 font-mono font-bold bg-slate-100 dark:bg-slate-800/40 px-2 py-1 rounded-sm">
              Continuous Sync
            </div>
          }
        >
          <div className="h-64 flex flex-col justify-between mt-4">
            <div className="flex-1 flex items-end gap-5 border-b border-slate-150 dark:border-slate-800/80 pb-3 h-48">
              {barChartData.map((bar, idx) => {
                const maxCount = Math.max(...barChartData.map((d) => d.count)) || 1;
                const percentage = (bar.count / maxCount) * 85; // Max height at 85%

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative cursor-pointer"
                    onMouseEnter={() => setHoveredChartBar(idx)}
                    onMouseLeave={() => setHoveredChartBar(null)}
                  >
                    {/* Bar Shimmer Container */}
                    <div className="w-full bg-slate-50/50 dark:bg-slate-950/20 rounded-t-lg h-36 flex items-end relative overflow-hidden">
                      <div
                        className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-sm transition-all duration-500 ease-out absolute bottom-0"
                        style={{ height: `${percentage}%` }}
                      >
                        {/* Shimmer Reflex inside bar */}
                        <div className="absolute inset-0 bg-white/5" />
                      </div>
                    </div>

                    {/* Active tooltip popover */}
                    {hoveredChartBar === idx && (
                      <div className="absolute -top-12 z-20 bg-slate-950 text-white text-[10px] px-2.5 py-1 rounded-lg shadow-lg font-bold">
                        {bar.count} Activities
                      </div>
                    )}

                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 truncate w-full text-center">
                      {bar.department}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Custom Grid lines description */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500" /> Primary Register Activities
              </span>
              <span>Y-Axis: Relative Count</span>
            </div>
          </div>
        </AppCard>
      </div>

      {/* Audit Readiness and Recent Activities timeline list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Audit Readiness Card (lg:col-span-5) */}
        <AppCard
          id="card-audit-readiness"
          title="RODO Auditor Readiness Index"
          subtitle="Ongoing review of external audit variables"
          className="col-span-1 lg:col-span-5"
        >
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-md">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                  Article 30 Documentation Integrity
                </span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold">
                  100% Prepared
                </span>
              </div>
              <div className="h-1.5 bg-slate-205 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-md">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                  DPIA High-Risk Assess Actions
                </span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold">
                  80% Completed
                </span>
              </div>
              <div className="h-1.5 bg-slate-205 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '80%' }} />
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-md">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                  Subprocessor Security Binding (SCC)
                </span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold">
                  66% Reviewed
                </span>
              </div>
              <div className="h-1.5 bg-slate-205 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '66%' }} />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs p-1 pt-2">
              <span className="text-slate-500">Security rating authority:</span>
              <span className="font-extrabold text-emerald-505 dark:text-emerald-400 flex items-center gap-1">
                🛡️ Audit Grade: S-Class
              </span>
            </div>
          </div>
        </AppCard>

        {/* Recent Activity Timeline (lg:col-span-7) */}
        <AppCard
          id="card-activity-timeline"
          title="Recent Compliance Operations Timeline"
          subtitle="Real-time secure event stream of RODO audits"
          className="col-span-1 lg:col-span-7"
          headerAction={
            <button
              onClick={() => onNavigate('/audits')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              View System Logs
            </button>
          }
        >
          <div className="flow-root">
            <ul className="-mb-8">
              {audits.slice(0, 4).map((log, logIdx) => (
                <li key={log.id}>
                  <div className="relative pb-8">
                    {logIdx !== audits.slice(0, 4).length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100 dark:bg-slate-800" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3.5">
                      <div>
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 ${
                          log.severity === 'Critical'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-455'
                            : log.severity === 'Warning'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-450'
                            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                        }`}>
                          <Layers className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {log.action}{' '}
                            <span className="text-[10px] text-slate-400 font-mono font-medium">
                              {log.user} ({log.email})
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {log.newValue}
                          </p>
                        </div>
                        <div className="text-right text-[10px] whitespace-nowrap text-slate-450 font-bold font-mono">
                          {log.timestamp.split(' ')[1]}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </AppCard>
      </div>
    </div>
  );
};
