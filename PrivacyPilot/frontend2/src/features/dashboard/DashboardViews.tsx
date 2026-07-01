/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';
import { RiskBadge, StatusBadge } from '../../components/common/badges';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell } from 'recharts';

export const DashboardView: React.FC = () => {
  const {
    activeRole,
    currentLanguage,
    activities,
    dpias,
    incidents,
    requests,
    vendors,
    audits,
    tasks,
    navigateTo,
    tenants,
    tickets,
    platformLogs
  } = useApp();

  // Helper Metrics
  const activeTenant = tenants[0];
  const pendingApprovalsCount = activities.filter((a) => a.status === 'in_review').length;
  const highRiskCount = activities.filter((a) => a.dpiaRequired === 'required').length;
  const overdueReviewsCount = tasks.filter((t) => t.status === 'overdue').length;
  const completenessAverage = Math.round(activities.reduce((sum, act) => sum + act.completenessScore, 0) / activities.length) || 0;

  // Render Charts Mock Data
  const chartData = [
    { name: 'HR Dept', ROPAs: activities.filter(a => a.department === 'Human Resources').length, Risks: 2 },
    { name: 'Legal', ROPAs: activities.filter(a => a.department === 'Legal & Compliance').length, Risks: 1 },
    { name: 'Sales', ROPAs: activities.filter(a => a.department === 'Sales & Marketing').length, Risks: 3 },
    { name: 'Ops', ROPAs: activities.filter(a => a.department.toLowerCase().includes('oper') || a.department.toLowerCase().includes('sec')).length, Risks: 4 }
  ];

  const pieData = [
    { name: 'Approved', value: activities.filter(a => a.status === 'approved').length },
    { name: 'In Review', value: activities.filter(a => a.status === 'in_review').length },
    { name: 'Action Required', value: activities.filter(a => a.status === 'action_required').length },
    { name: 'Drafts', value: activities.filter(a => a.status === 'draft').length }
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

  // Standard KPI Card
  const KpiCard = ({ title, value, icon, onClick, trend, colorClass = 'text-[#C5A059] bg-[#1C1C1E]' }: any) => (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 hover:border-[#C5A059]/50 p-5 rounded-lg shadow-xs transition-all flex justify-between items-center group cursor-pointer"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-light text-[#C5A059] group-hover:text-white transition-colors">{value}</p>
        {trend && <p className="text-[10px] text-emerald-500 font-semibold font-mono">{trend}</p>}
      </div>
      <div className={`p-2.5 rounded-sm flex items-center justify-center ${colorClass}`}>
        <ComplianceIcon name={icon} size={18} />
      </div>
    </div>
  );

  // ----------------------------------------------------
  // ROLE-SPECIFIC RENDERERS
  // ----------------------------------------------------

  // 1. TENANT ADMIN
  if (activeRole === 'TENANT_ADMIN') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {currentLanguage === 'pl' ? 'Panel Administratora Spółki' : 'Tenant Administrator Dashboard'}
            </h1>
            <p className="text-xs text-slate-500">
              {activeTenant.name} — {currentLanguage === 'pl' ? 'Ogólny stan zgodności i zatwierdzeń.' : 'General compliance state and active controls.'}
            </p>
          </div>
          <button
            onClick={() => navigateTo('#/app/ropa/export')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ComplianceIcon name="FileText" size={14} /> {currentLanguage === 'pl' ? 'Wyeksportuj Rejestr RCP' : 'Export Audit-Ready ROPA'}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Compliance Score" value={`${completenessAverage}%`} icon="Shield" trend="+4% this quarter" />
          <KpiCard title="Processing Activities (ROPA)" value={activities.length} icon="FolderKanban" onClick={() => navigateTo('#/app/activities')} />
          <KpiCard title="Open Approvals Needed" value={pendingApprovalsCount} icon="CheckSquare" colorClass="text-amber-600 bg-amber-50" onClick={() => navigateTo('#/app/activities')} />
          <KpiCard title="High Risk DPIAs" value={highRiskCount} icon="Scale" colorClass="text-red-600 bg-red-50" onClick={() => navigateTo('#/app/dpia')} />
        </div>

        {/* Charts & Tasks Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart Card */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{currentLanguage === 'pl' ? 'Działalność i ryzyka według departamentów' : 'ROPA Records by Department'}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2c" />
                  <XAxis dataKey="name" stroke="#8e8e93" fontSize={11} />
                  <YAxis stroke="#8e8e93" fontSize={11} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#161618', borderColor: '#2a2a2c', color: '#e0e0e0' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ROPAs" fill="#C5A059" radius={[4, 4, 0, 0]} name="Czynności / ROPAs" />
                  <Bar dataKey="Risks" fill="#dc2626" radius={[4, 4, 0, 0]} name="Zidentyfikowane Ryzyka" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Tasks */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{currentLanguage === 'pl' ? 'Zadania Zgodności' : 'Overdue Tasks & Alerts'}</h3>
              <div className="space-y-3 max-h-56 overflow-y-auto">
                {tasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex gap-2.5 items-start text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${t.status === 'overdue' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 leading-tight">{t.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Deadline: {t.dueDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => navigateTo('#/app/tasks')}
              className="w-full text-center py-2 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline mt-4 cursor-pointer"
            >
              {currentLanguage === 'pl' ? 'Przejdź do Centrum Zadań' : 'Go to Task Center'} →
            </button>
          </div>

        </div>
      </div>
    );
  }

  // 2. COMPLIANCE OFFICER
  if (activeRole === 'COMPLIANCE_OFFICER') {
    const unresolvedBreaches = incidents.filter(i => i.status !== 'closed');
    const openDSARs = requests.filter(r => r.status !== 'closed');
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {currentLanguage === 'pl' ? 'Panel Specjalisty ds. Zgodności' : 'Compliance Officer Dashboard'}
          </h1>
          <p className="text-xs text-slate-500">
            {currentLanguage === 'pl' ? 'Codzienne monitorowanie rejestru RCP, naruszeń i żądań DSR.' : 'Operational queue for ROPA records, active breaches, and subject requests.'}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Active Breaches" value={unresolvedBreaches.length} icon="Skull" colorClass="text-red-600 bg-red-50" onClick={() => navigateTo('#/app/incidents')} />
          <KpiCard title="Pending DSAR Deadlines" value={openDSARs.length} icon="UserCheck" colorClass="text-amber-600 bg-amber-50" onClick={() => navigateTo('#/app/requests')} />
          <KpiCard title="Vendor Agreements Checked" value={`${vendors.filter(v => v.dpaStatus === 'signed').length}/${vendors.length}`} icon="Users" onClick={() => navigateTo('#/app/vendors')} />
          <KpiCard title="DPIA Threshold Screening" value={dpias.length} icon="Scale" onClick={() => navigateTo('#/app/dpia')} />
        </div>

        {/* Operational Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Active Breaches Countdown Table */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{currentLanguage === 'pl' ? 'Aktywne Naruszenia (Zegar 72h)' : 'Active Breaches & 72h UODO Clocks'}</h3>
            <div className="space-y-3">
              {incidents.slice(0, 3).map((i) => {
                const clockActive = i.status !== 'closed';
                return (
                  <div key={i.id} className="p-3 border border-slate-100 bg-slate-50 rounded flex justify-between items-center text-xs gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{i.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono">ID: {i.id}</span>
                        <RiskBadge level={i.risk} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {clockActive ? (
                        <span className="text-[10px] font-mono font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded border border-red-100 animate-pulse">
                          ⏳ Report Required
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded">
                          ✓ Documented & Closed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incoming DSAR Deadlines */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{currentLanguage === 'pl' ? 'Otrzymane Wnioski Podmiotów (DSR)' : 'Incoming DSAR Deadlines (SLA)'}</h3>
            <div className="space-y-3">
              {requests.slice(0, 3).map((r) => (
                <div key={r.id} className="p-3 border border-slate-100 bg-slate-50 rounded flex justify-between items-center text-xs gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{r.requesterName}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{r.requestType} request — Article 15-22</p>
                  </div>
                  <div className="text-right font-mono text-[10px]">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">1-Month SLA</span>
                    <p className="text-slate-400 mt-1">Due: {r.deadline ? r.deadline.split('T')[0] : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // 3. DPO / IOD
  if (activeRole === 'DPO') {
    const adviceRequests = dpias.filter(d => d.status === 'advice_pending');
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {currentLanguage === 'pl' ? 'Panel Inspektora Ochrony Danych (IOD)' : 'DPO / IOD Supervision Dashboard'}
          </h1>
          <p className="text-xs text-slate-500">
            {currentLanguage === 'pl' ? 'Niezależny nadzór nad analizami DPIA, rejestrami ryzyka i wnioskami Art. 36.' : 'Independent oversight on high-risk assessments, risk ledgers, and prior consultation packs.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="DPIA Advice Requests" value={adviceRequests.length} icon="Scale" colorClass="text-teal-600 bg-teal-50" onClick={() => navigateTo('#/app/dpia')} />
          <KpiCard title="High Residual Risks" value={dpias.filter(d => d.residualRisk === 'high').length} icon="ShieldAlert" colorClass="text-red-600 bg-red-50" onClick={() => navigateTo('#/app/dpia')} />
          <KpiCard title="Supervisory Contacts" value="UODO Warsaw" icon="Globe" />
          <KpiCard title="Prior Consultation (Art 36)" value={dpias.filter(d => d.status === 'prior_consultation').length} icon="FileStack" />
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{currentLanguage === 'pl' ? 'Oczekujące wnioski o opinię IOD' : 'DPIA Advice Queue (Article 35(2))'}</h3>
          {adviceRequests.length === 0 ? (
            <p className="text-xs text-slate-400">{currentLanguage === 'pl' ? 'Brak oczekujących analiz do zaopiniowania.' : 'No outstanding DPIA advice requests.'}</p>
          ) : (
            <div className="space-y-3">
              {adviceRequests.map((d) => (
                <div key={d.id} className="p-4 border border-slate-100 bg-slate-50 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-900">{d.activityName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Matched Polish DPIA criteria: {d.criteriaMatched.length} ({d.criteriaMatched.join(', ')})</p>
                  </div>
                  <button
                    onClick={() => navigateTo(`#/app/dpia/${d.id}`)}
                    className="self-start sm:self-auto px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-[10px] font-bold text-white rounded cursor-pointer uppercase tracking-wider"
                  >
                    Provide DPO Advice
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. MANAGER (Department Owner)
  if (activeRole === 'MANAGER') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {currentLanguage === 'pl' ? 'Panel Kierownika Departamentu (HR)' : 'Department Owner Dashboard (Human Resources)'}
          </h1>
          <p className="text-xs text-slate-500">
            Manage your department processing activities and answer compliance questionnaires.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="My Department Activities" value={activities.filter(a => a.department === 'Human Resources').length} icon="FolderKanban" onClick={() => navigateTo('#/app/activities')} />
          <KpiCard title="Assigned Questionnaires" value="2 Pending" icon="CheckSquare" />
          <KpiCard title="Stale Retention Reviews" value="1 Overdue" icon="ShieldAlert" colorClass="text-red-600 bg-red-50" />
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Active Processing Records</h3>
          <div className="space-y-3">
            {activities.filter(a => a.department === 'Human Resources').map((a) => (
              <div key={a.id} className="p-3 bg-slate-50 rounded border border-slate-100 flex justify-between items-center text-xs gap-3">
                <div>
                  <p className="font-bold text-slate-900">{a.name}</p>
                  <p className="text-[10px] text-slate-400">{a.systemUsed} — Retention: {a.retentionPeriod}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 5. EMPLOYEE
  if (activeRole === 'EMPLOYEE') {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-slate-900 text-white rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <span className="bg-blue-600 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">Security Awareness</span>
            <h2 className="text-lg font-bold">Agnieszka Kaczmarek (Logistics)</h2>
            <p className="text-xs text-slate-400">Complete assigned mandatory GDPR training and log any physical data security incidents immediately.</p>
          </div>
          <button
            onClick={() => navigateTo('#/app/incidents/new')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-xs font-bold text-white rounded flex items-center gap-2 cursor-pointer"
          >
            <ComplianceIcon name="AlertOctagon" size={14} /> Report Privacy Incident
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Security Training</h3>
            <div className="p-4 border border-emerald-100 bg-emerald-50 rounded flex items-center gap-3">
              <ComplianceIcon name="CheckSquare" className="text-emerald-600 shrink-0" size={24} />
              <div className="text-xs">
                <p className="font-bold text-emerald-900">Polish RODO Baseline Training 2026</p>
                <p className="text-emerald-700 mt-0.5">Completed: 2026-03-10. Valid for 12 months.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Active Tasks</h3>
            <div className="space-y-2 text-xs">
              <p className="text-slate-400 italic">No pending tasks or policies requiring acknowledgement.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for Auditor, Legal, etc - show a nice consolidated table
  const unresolvedTasks = tasks.filter((t) => t.status !== 'done');
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {currentLanguage === 'pl' ? 'Konsola Audytu i Doradztwa' : 'Auditor & Legal Counsel Dashboard'}
          </h1>
          <p className="text-xs text-slate-500">Consolidated read-only compliance tracker, audit logs, and evidence check-ins.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Active Audits" value={audits.length} icon="FileStack" onClick={() => navigateTo('#/app/audits')} />
        <KpiCard title="Outstanding Findings" value={audits.reduce((sum, a) => sum + a.findings.length, 0)} icon="ShieldAlert" colorClass="text-amber-600 bg-amber-50" />
        <KpiCard title="Pending Review Documents" value={unresolvedTasks.length} icon="CheckSquare" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ROPA completeness overview */}
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ROPA Activities Completeness & Status</h3>
          <div className="space-y-3">
            {activities.slice(0, 4).map((a) => (
              <div key={a.id} className="p-3 bg-slate-50 rounded border border-slate-100 flex justify-between items-center text-xs gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{a.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Lawful basis: {a.lawfulBasis}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded">Comp: {a.completenessScore}%</span>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Evidence Status */}
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit Evidence Summary</h3>
          <div className="space-y-3">
            {audits.map((aud) => (
              <div key={aud.id} className="p-3 border border-slate-100 bg-slate-50 rounded text-xs space-y-2">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{aud.title}</span>
                  <span className="text-[10px] uppercase text-blue-600 font-mono">{aud.status}</span>
                </div>
                <p className="text-[10px] text-slate-400">Auditor: {aud.auditor}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-150">
                  <span>Evidence Files: {aud.evidenceCount}</span>
                  <span className="font-bold text-amber-600">Findings: {aud.findings.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
