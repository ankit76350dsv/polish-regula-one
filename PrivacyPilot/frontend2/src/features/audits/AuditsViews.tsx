/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';
import { StatusBadge } from '../../components/common/badges';

export const AuditsCenterView: React.FC = () => {
  const { audits, currentLanguage, updateAudit, showToast } = useApp();
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);

  const activeAudit = audits.find(a => a.id === activeAuditId);

  const handleUploadMockEvidence = () => {
    if (!activeAudit) return;
    updateAudit({
      ...activeAudit,
      evidenceCount: activeAudit.evidenceCount + 1
    });
    showToast('Mock Evidence file logged successfully in Audit Vault', 'success');
  };

  const handleToggleFinding = (audit: typeof audits[0], findingId: string) => {
    const updatedFindings = audit.findings.map(f => {
      if (f.id === findingId) {
        return { ...f, status: (f.status === 'resolved' ? 'open' : 'resolved') as any };
      }
      return f;
    });
    
    updateAudit({
      ...audit,
      findings: updatedFindings
    });
    showToast('Remediation finding status toggled', 'success');
  };

  const triggerAuditPackCompilation = () => {
    showToast('Assembling official RODO Audit Evidence Pack...', 'info');
    setTimeout(() => {
      showToast('Szkielet audytu RODO gotowy. PP_AuditEvidence_UODO.zip wyeksportowany.', 'success');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {!activeAuditId ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {currentLanguage === 'pl' ? 'Audyty i Rejestr Dowodów' : 'Compliance Audits & Evidence'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {currentLanguage === 'pl' 
                  ? 'Planowanie kontroli wewnętrznych, zbieranie dowodów rozliczalności (Art. 5 ust. 2 RODO).' 
                  : 'Establish statutory GDPR accountability evidence, organize annual audits, and document findings.'}
              </p>
            </div>
          </div>

          {/* Audits Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Nazwa Audytu / Audit Scope</th>
                  <th className="px-5 py-3">Audytor / Inspector</th>
                  <th className="px-5 py-3">Dowody / Evidence</th>
                  <th className="px-5 py-3">Zalecenia / Findings</th>
                  <th className="px-5 py-3">Termin / Schedule</th>
                  <th className="px-5 py-3">Status RODO / State</th>
                  <th className="px-5 py-3 text-right">Szczegóły / View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {audits.map((aud) => {
                  const openFindings = aud.findings.filter(f => f.status === 'open').length;
                  return (
                    <tr key={aud.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-slate-900 font-bold block">{aud.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {aud.id}</span>
                      </td>
                      <td className="px-5">{aud.auditor}</td>
                      <td className="px-5 font-mono text-slate-500">
                        {aud.evidenceCount} files uploaded
                      </td>
                      <td className="px-5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          openFindings > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {openFindings} Open Findings
                        </span>
                      </td>
                      <td className="px-5 text-slate-500 font-mono">{aud.dueDate}</td>
                      <td className="px-5">
                        <StatusBadge status={aud.status} />
                      </td>
                      <td className="px-5 text-right">
                        <button
                          onClick={() => setActiveAuditId(aud.id)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded uppercase tracking-wider cursor-pointer"
                        >
                          Evidence Room
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ACTIVE AUDIT EVIDENCE WORKSPACE DETAILED
        <div className="space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <button
                onClick={() => setActiveAuditId(null)}
                className="text-slate-400 hover:text-slate-900 text-xs font-semibold flex items-center gap-1 cursor-pointer mb-2"
              >
                <ComplianceIcon name="ArrowLeft" size={14} /> Back to audits registry
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 rounded uppercase font-bold">{activeAudit?.id}</span>
                <h2 className="text-sm font-bold text-slate-950">{activeAudit?.title} Evidence Vault</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={triggerAuditPackCompilation}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <ComplianceIcon name="FileText" size={12} /> Export Audit Evidence ZIP Pack
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Audit findings log */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Audit Findings Register */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs text-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identified Regulatory Findings & Action Items</h3>
                
                <div className="space-y-2.5">
                  {activeAudit?.findings.map((f) => {
                    const resolved = f.status === 'resolved';
                    return (
                      <label
                        key={f.id}
                        className={`flex items-start gap-3 p-3.5 rounded border transition-colors cursor-pointer ${
                          resolved
                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                            : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={resolved}
                          onChange={() => handleToggleFinding(activeAudit, f.id)}
                          className="mt-0.5 text-emerald-600 focus:ring-0"
                        />
                        <div className="flex-1">
                          <p className="font-bold flex items-center gap-2">
                            <span>{f.description}</span>
                            <span className={`text-[9px] uppercase font-bold px-1.5 rounded font-mono ${
                              f.severity === 'high' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                            }`}>{f.severity}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">Regulatory Violation Basis: {f.clause}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Right Column: Evidence upload box */}
            <div className="space-y-6 text-xs">
              
              {/* Accountability Evidence locker */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accountability Locker (Art. 5(2))</h3>
                
                <div className="p-4 bg-slate-50 border border-slate-150 border-dashed rounded text-center space-y-3">
                  <ComplianceIcon name="FileText" className="text-slate-400 mx-auto" size={24} />
                  <div>
                    <p className="font-bold text-slate-800">Locker Evidence Files</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{activeAudit?.evidenceCount} files securely logged</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUploadMockEvidence}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold uppercase tracking-wider text-[10px] cursor-pointer inline-block"
                  >
                    Upload Evidence File
                  </button>
                </div>
                
                <p className="text-[10px] text-slate-400 leading-normal">
                  Uploaded files reside inside sovereign EU cloud hosts, matching encrypted zero-knowledge keys and compliance audits guidelines.
                </p>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
