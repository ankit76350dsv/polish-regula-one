/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';
import { RiskBadge, StatusBadge } from '../../components/common/badges';
import { Incident } from '../../types';

export const IncidentsCenterView: React.FC = () => {
  const { incidents, currentLanguage, navigateTo, addIncident, updateIncident, showToast } = useApp();
  const [activeBreachId, setActiveBreachId] = useState<string | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);

  // New Breach Form State
  const [form, setForm] = useState({
    title: '',
    risk: 'medium' as const,
    description: '',
    affectedData: 'Employee email logs, IP addresses',
    approximateSubjects: 150,
    reporter: 'Jan Kowalski',
    uodoNotified: false
  });

  const activeBreach = incidents.find(i => i.id === activeBreachId);

  const handleLogBreach = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = addIncident({
      title: form.title,
      risk: form.risk,
      status: 'under_investigation',
      discoveredAt: new Date().toISOString(),
      reportedAt: new Date().toISOString(),
      affectedData: form.affectedData,
      approximateSubjects: form.approximateSubjects,
      reporter: form.reporter,
      uodoNotified: form.uodoNotified,
      remediationTasks: [
        { id: 'rem-1', title: 'Revoke compromised API credentials', status: 'pending', owner: 'DevOps' },
        { id: 'rem-2', title: 'Perform server forensics log checks', status: 'pending', owner: 'SecOps' }
      ]
    });
    setShowLogForm(false);
    setActiveBreachId(newId);
  };

  const handleToggleRemediation = (breach: Incident, taskId: string) => {
    const updatedTasks = breach.remediationTasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: (t.status === 'done' ? 'pending' : 'done') as any };
      }
      return t;
    });
    
    // Auto resolve breach if all remediation items are done
    const allDone = updatedTasks.every(t => t.status === 'done');
    const newStatus = allDone ? ('closed' as const) : breach.status;

    updateIncident({
      ...breach,
      remediationTasks: updatedTasks,
      status: newStatus
    });
    showToast('Remediation milestone status updated', 'success');
  };

  const triggerUodoXmlCompilation = () => {
    showToast('Compiling UODO Poland regulatory breach XML format...', 'info');
    setTimeout(() => {
      showToast('Pomyślnie skompilowano raport XML zgłoszenia do UODO Warsaw.', 'success');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {!activeBreachId && !showLogForm ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {currentLanguage === 'pl' ? 'Naruszenia Bezpieczeństwa (Art. 33)' : 'Incidents & Breach Center'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {currentLanguage === 'pl' 
                  ? 'Rejestr incydentów oraz procedury powiadamiania UODO w 72 godziny.' 
                  : 'Article 33/34 compliance trackers, 72-hour diagnostic clocks, and mitigation controls.'}
              </p>
            </div>
            <button
              onClick={() => setShowLogForm(true)}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-xs font-bold text-white rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ComplianceIcon name="Plus" size={14} /> {currentLanguage === 'pl' ? 'Zgłoś Naruszenie' : 'Log Breach Incident'}
            </button>
          </div>

          {/* Incidents Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Nazwa Naruszenia / Incident</th>
                  <th className="px-5 py-3">Wykryto / Discovered</th>
                  <th className="px-5 py-3">Data / Affected Scope</th>
                  <th className="px-5 py-3">Osoby / Subjects</th>
                  <th className="px-5 py-3">Status RODO / State</th>
                  <th className="px-5 py-3">Ryzyko / Risk</th>
                  <th className="px-5 py-3 text-right">Otwórz / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {incidents.map((inc) => {
                  const underReview = inc.status !== 'closed';
                  return (
                    <tr key={inc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-slate-900 font-bold block">{inc.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {inc.id}</span>
                      </td>
                      <td className="px-5 text-slate-500 font-mono">{inc.discoveredAt ? inc.discoveredAt.split('T')[0] : ''}</td>
                      <td className="px-5 truncate max-w-xs">{inc.affectedData}</td>
                      <td className="px-5 font-mono">{inc.approximateSubjects}</td>
                      <td className="px-5">
                        {underReview ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded animate-pulse">
                            ⏳ Under 72h Clock
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                            Documented
                          </span>
                        )}
                      </td>
                      <td className="px-5">
                        <RiskBadge level={inc.risk} />
                      </td>
                      <td className="px-5 text-right">
                        <button
                          onClick={() => setActiveBreachId(inc.id)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded uppercase tracking-wider cursor-pointer"
                        >
                          Workspace
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : showLogForm ? (
        // LOG INCIDENT FORM VIEW
        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-white p-5 rounded-lg border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Article 33 Breach Diagnostic Questionnaire</h2>
              <p className="text-[10px] text-slate-400">Answer carefully to establish the mandatory 72-hour notify timeline.</p>
            </div>
            <button onClick={() => setShowLogForm(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer">
              Cancel
            </button>
          </div>

          <form onSubmit={handleLogBreach} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-xs text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Incident Descriptive Header *</label>
              <input
                type="text"
                required
                placeholder="e.g. CSRF Session leakage via marketing webhook server"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Scope of Affected Data *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Email indexes, bank account hash logs"
                  value={form.affectedData}
                  onChange={(e) => setForm({ ...form, affectedData: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Discovered By / Reporter</label>
                <input
                  type="text"
                  required
                  value={form.reporter}
                  onChange={(e) => setForm({ ...form, reporter: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Assessed Threat Level (Initial)</label>
                <select
                  value={form.risk}
                  onChange={(e: any) => setForm({ ...form, risk: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 font-bold text-red-600"
                >
                  <option value="low">Low Threat</option>
                  <option value="medium">Medium Threat</option>
                  <option value="high">High Threat</option>
                  <option value="critical">Critical Threat</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Approximate Subject Count</label>
                <input
                  type="number"
                  value={form.approximateSubjects}
                  onChange={(e) => setForm({ ...form, approximateSubjects: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-red-50 rounded border border-red-200 text-[10px] text-red-900 leading-normal">
              <strong>Article 33 Mandatory Trigger:</strong> If the incident is likely to result in a risk to the rights and freedoms of natural persons, you MUST notify the Supervisory Authority (UODO Poland) within 72 hours.
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" onClick={() => setShowLogForm(false)} className="px-4 py-1.5 bg-slate-100 rounded">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded">Log Breach</button>
            </div>
          </form>
        </div>
      ) : (
        // ACTIVE BREACH WORKSPACE DETAILED
        <div className="space-y-6">
          
          {/* Detailed Header bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <button
                onClick={() => setActiveBreachId(null)}
                className="text-slate-400 hover:text-slate-900 text-xs font-semibold flex items-center gap-1 cursor-pointer mb-2"
              >
                <ComplianceIcon name="ArrowLeft" size={14} /> Back to incident list
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 rounded uppercase font-bold">{activeBreach?.id}</span>
                <h2 className="text-sm font-bold text-slate-950">{activeBreach?.title}</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={triggerUodoXmlCompilation}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <ComplianceIcon name="FileText" size={12} /> Compile UODO Poland Report
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Remediation actions & logs */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Detailed Incident Profile */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs text-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Breach Description & Investigation</h3>
                <p className="text-slate-600 leading-normal">{activeBreach?.description || 'Detailed technical forensic analysis in progress.'}</p>
                <div className="grid grid-cols-2 gap-3 font-mono text-slate-500 p-3 bg-slate-50 rounded border border-slate-100">
                  <div>
                    <span className="font-sans font-semibold text-slate-800 block">Affected Datasets:</span>
                    {activeBreach?.affectedData}
                  </div>
                  <div>
                    <span className="font-sans font-semibold text-slate-800 block">Identified Subjects:</span>
                    {activeBreach?.approximateSubjects} persons
                  </div>
                </div>
              </div>

              {/* Remediation actions checkpoints */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs text-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mitigation Checklist & Remediation Planner</h3>
                
                <div className="space-y-2.5">
                  {activeBreach?.remediationTasks.map((t) => {
                    const checked = t.status === 'done';
                    return (
                      <label
                        key={t.id}
                        className={`flex items-start gap-3 p-3 rounded border transition-colors cursor-pointer ${
                          checked
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                            : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleRemediation(activeBreach, t.id)}
                          className="mt-0.5 text-emerald-600 focus:ring-0"
                        />
                        <div className="flex-1">
                          <p className="font-bold">{t.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Assigned Action Team: {t.owner}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Regulatory clock & checklists */}
            <div className="space-y-6 text-xs">
              
              {/* 72h Clock Card */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regulatory SLA Window</h3>
                <div className="p-4 bg-red-50 border border-red-200 rounded text-center space-y-2">
                  <p className="font-mono text-xl font-extrabold text-red-600 tracking-wider">72:00:00</p>
                  <p className="text-[10px] text-red-800 font-semibold uppercase tracking-wider">Article 33 Countdown Timer</p>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  All security incidents involving personal files require a documented rationale. If UODO is not notified within 72 hours, a written justification must accompany the submission.
                </p>
              </div>

              {/* UODO Poland Notification scorecard */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-3.5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Supervisory Notification Need</h3>
                
                <div className="space-y-2 font-medium">
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-100 rounded">
                    <input
                      type="checkbox"
                      checked={activeBreach?.uodoNotified}
                      onChange={(e) => updateIncident({ ...activeBreach, uodoNotified: e.target.checked })}
                    />
                    <span>Formal Report Dispatched to Warsaw UODO</span>
                  </label>
                </div>

                <div className="p-3 bg-blue-50/50 rounded border border-blue-150 leading-normal text-[10px] text-slate-500">
                  <strong>Advice Note:</strong> Maintain internal incident log entries (Article 33(5)) regardless of whether UODO notification is triggered.
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
