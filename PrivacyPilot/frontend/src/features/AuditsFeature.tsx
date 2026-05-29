/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  FileDown,
  Activity,
  AlertTriangle,
  Info,
  Clock,
  Eye,
  Server,
  Code2,
} from 'lucide-react';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppTable } from '../components/AppTable';
import { AppModal } from '../components/AppModal';
import { AuditLog } from '../types';

interface AuditsFeatureProps {
  id: string;
  initialAudits: AuditLog[];
}

export const AuditsFeature: React.FC<AuditsFeatureProps> = ({ id, initialAudits }) => {
  const [audits, setAudits] = useState<AuditLog[]>(initialAudits);
  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');

  // Preview detailed diff comparison popup
  const [previewLog, setPreviewLog] = useState<AuditLog | null>(null);

  const filteredAudits = useMemo(() => {
    return audits.filter((log) => {
      const matchesSearch =
        log.user.toLowerCase().includes(search.toLowerCase()) ||
        log.email.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.ipAddress.includes(search);

      const matchesSeverity = selectedSeverity === 'All' || log.severity === selectedSeverity;

      return matchesSearch && matchesSeverity;
    });
  }, [audits, search, selectedSeverity]);

  // Download auditing JSON payload
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(filteredAudits, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PrivacyPilot_AuditTrail_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id={id} className="space-y-6">
      {/* Top action header info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Immutable Regulatory Audit Stream (Article 30(4))
          </h2>
          <p className="text-xs text-slate-500">
            Cryptographically sealed system activities tracking operations. Every configuration change, export, and assessment is registered below.
          </p>
        </div>

        <AppButton
          id="btn-export-audit-trail"
          variant="outline"
          size="sm"
          className="h-9 border-slate-200 dark:border-slate-800 bg-white"
          onClick={handleExportJSON}
        >
          <FileDown className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
          Export JSON Trail
        </AppButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left statistics panel (lg:col-span-3) */}
        <div className="col-span-1 lg:col-span-3 space-y-4">
          <AppCard id="audit-system-brief" title="System Security Metrics">
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-lg">
                <span className="text-[10px] text-slate-450 font-black uppercase tracking-wider block">Security Integrity Grade</span>
                <span className="text-sm font-bold text-emerald-650 dark:text-emerald-450 block mt-1">S-Class Sealed ✓</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-lg">
                <span className="text-[10px] text-slate-450 font-black uppercase tracking-wider block">Encryption Standard</span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 block mt-1">AES-GCM-256</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-lg">
                <span className="text-[10px] text-slate-450 font-black uppercase tracking-wider block">Auditable active events</span>
                <span className="text-xs font-bold text-indigo-550 dark:text-indigo-400 block mt-1">{audits.length} Registered operations</span>
              </div>
            </div>
          </AppCard>
        </div>

        {/* Right Logs Grid (lg:col-span-9) */}
        <div className="col-span-1 lg:col-span-9 space-y-4">
          {/* Advanced filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-4.5 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="flex-1">
              <AppTextField
                id="search-audits"
                placeholder="Search audit trail by user identity, operations query, IP address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-4 w-4 text-slate-400" />}
              />
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-500 whitespace-nowrap">Severity filter:</span>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md py-1.5 px-3 outline-hidden text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <option value="All">All types</option>
                <option value="Info">Info logs</option>
                <option value="Warning">Warning alerts</option>
                <option value="Critical">Critical actions</option>
              </select>
            </div>
          </div>

          <AppTable<AuditLog>
            id="audit-trail-ledger-table"
            columns={[
              {
                key: 'timestamp',
                header: 'TIMESTAMP / SECURE ID',
                render: (row) => (
                  <div className="font-mono text-xs text-slate-500 font-bold">
                    <p className="text-slate-800 dark:text-slate-200">{row.timestamp}</p>
                    <span className="text-[10px] opacity-75">{row.id}</span>
                  </div>
                ),
              },
              {
                key: 'user',
                header: 'AUDITED USER CONTEXT',
                render: (row) => (
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {row.user}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {row.email}
                    </p>
                  </div>
                ),
              },
              {
                key: 'action',
                header: 'COMPLIANCE ACTION',
                render: (row) => (
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {row.action}
                  </p>
                ),
              },
              {
                key: 'ipAddress',
                header: 'IP ADDRESS',
                render: (row) => (
                  <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-450 rounded-sm border border-slate-200/40 dark:border-slate-800">
                    {row.ipAddress}
                  </span>
                ),
              },
              {
                key: 'severity',
                header: 'ALERT GRADE',
                render: (row) => (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full ${
                      row.severity === 'Critical'
                        ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20'
                        : row.severity === 'Warning'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10'
                    }`}
                  >
                    {row.severity}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                render: (row) => (
                  <div className="flex justify-end">
                    <AppButton
                      id={`btn-view-diff-${row.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewLog(row)}
                      className="px-2.5 py-1 text-xs border-slate-300"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Inspect Diffs
                    </AppButton>
                  </div>
                ),
              },
            ]}
            data={filteredAudits}
          />
        </div>
      </div>

      {/* Audit Diff Preview Log modal */}
      <AppModal
        id="audit-trail-inspect-modal"
        isOpen={!!previewLog}
        onClose={() => setPreviewLog(null)}
        title="Immutable Event History Inspect"
        maxWidth="xl"
        footer={
          <AppButton id="btn-close-audit-det" variant="secondary" size="sm" onClick={() => setPreviewLog(null)}>
            Close inspection log
          </AppButton>
        }
      >
        {previewLog && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200/30 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-indigo-500" />
                <span className="text-xs text-slate-655 dark:text-slate-300 font-bold">Logged at: {previewLog.timestamp}</span>
              </div>
              <span className="text-xs text-slate-400 font-mono font-semibold">User Host: {previewLog.ipAddress}</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Triggering Operation Description</span>
              <p className="text-sm font-bold text-slate-850 dark:text-slate-100">{previewLog.action}</p>
            </div>

            {/* Diffs Side-Back Compare */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] text-rose-500 uppercase font-black block">Original Value Baseline</span>
                <div className="p-3.5 bg-rose-50/10 dark:bg-rose-950/15 border border-rose-300/40 rounded-xl font-mono text-[11px] text-rose-700 dark:text-rose-400 whitespace-pre-wrap leading-relaxed">
                  {previewLog.oldValue}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-emerald-500 uppercase font-black block">Authorized Updated Metric</span>
                <div className="p-3.5 bg-emerald-50/10 dark:bg-emerald-950/15 border border-emerald-300/40 rounded-xl font-mono text-[11px] text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap leading-relaxed">
                  {previewLog.newValue}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-250/30 rounded-xl text-[11px] text-indigo-805 dark:text-indigo-400 leading-snug flex gap-3">
              <Server className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="block mb-0.5">Sealed Record Verification Summary</strong>
                These variables are anchored inside continuous compliance logs. Manual overrides of diff histories are systemwise locked.
              </div>
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );
};
