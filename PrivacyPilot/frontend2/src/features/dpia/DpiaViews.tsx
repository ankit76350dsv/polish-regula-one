/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';
import { RiskBadge, StatusBadge } from '../../components/common/badges';
import { DPIA } from '../../types';

export const DpiaCenterView: React.FC = () => {
  const { dpias, currentLanguage, navigateTo, updateDpia } = useApp();
  const [activeDpiaId, setActiveDpiaId] = useState<string | null>(null);

  const activeDpia = dpias.find(d => d.id === activeDpiaId);

  // Risk Score Calculator Color Code
  const getMatrixColor = (score: number) => {
    if (score >= 15) return 'text-red-700 bg-red-100 border-red-200';
    if (score >= 8) return 'text-amber-700 bg-amber-100 border-amber-200';
    return 'text-emerald-700 bg-emerald-100 border-emerald-200';
  };

  const handleSignOff = (dpia: DPIA, role: string) => {
    const updatedApprovals = dpia.approvals.map(app => {
      if (app.role === role) {
        return { ...app, status: 'approved' as const, date: new Date().toISOString().split('T')[0], comment: 'Reviewed and formally signed off.' };
      }
      return app;
    });

    const isAllApproved = updatedApprovals.every(a => a.status === 'approved');
    const newStatus = isAllApproved ? ('approved' as const) : dpia.status;

    updateDpia({
      ...dpia,
      approvals: updatedApprovals,
      status: newStatus,
      timeline: [
        ...dpia.timeline,
        {
          id: Math.random().toString(),
          actor: role === 'DPO' ? 'Janusz Nowak (IOD)' : 'Tomasz Wiśniewski',
          action: 'Formally approved risk profile',
          date: new Date().toISOString().split('T')[0]
        }
      ]
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Overview Dashboard Cards */}
      {!activeDpiaId ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {currentLanguage === 'pl' ? 'Centrum Ocen Skutków (DPIA)' : 'DPIA & Threshold Center'}
              </h1>
              <p className="text-xs text-slate-500">
                {currentLanguage === 'pl' 
                  ? 'Ocena Skutków dla Ochrony Danych (DPIA) wymagana przy wysokim ryzyku naruszenia praw.' 
                  : 'Article 35 GDPR assessments, thresholds, and independent supervisory sign-offs.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 p-5 rounded-lg text-xs space-y-1">
              <p className="text-slate-400 font-bold uppercase tracking-wider">Completed Analyses</p>
              <p className="text-2xl font-extrabold text-slate-900">{dpias.filter(d => d.status === 'approved').length}</p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-lg text-xs space-y-1">
              <p className="text-slate-400 font-bold uppercase tracking-wider">Advice Requested</p>
              <p className="text-2xl font-extrabold text-amber-600">{dpias.filter(d => d.status === 'advice_pending').length}</p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-lg text-xs space-y-1">
              <p className="text-slate-400 font-bold uppercase tracking-wider">Article 36 consultation packs</p>
              <p className="text-2xl font-extrabold text-blue-600">{dpias.filter(d => d.status === 'prior_consultation').length}</p>
            </div>
          </div>

          {/* DPIAs list */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active DPIA Portfolios</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {dpias.map((d) => (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 rounded uppercase font-bold">{d.id}</span>
                      <p className="text-xs font-bold text-slate-900">{d.activityName}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {d.criteriaMatched.map((crit, idx) => (
                        <span key={idx} className="bg-slate-100 text-[9px] px-1.5 py-0.5 rounded font-mono">
                          {crit}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getMatrixColor(d.riskScore)}`}>
                      Score: {d.riskScore}/25
                    </span>
                    <StatusBadge status={d.status} />
                    <button
                      onClick={() => setActiveDpiaId(d.id)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Open Workspace
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ACTIVE DPIA WORKSPACE DETAILED
        <div className="space-y-6">
          
          {/* Header row */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <button
                onClick={() => setActiveDpiaId(null)}
                className="text-slate-400 hover:text-slate-900 text-xs font-semibold flex items-center gap-1 cursor-pointer mb-2"
              >
                <ComplianceIcon name="ArrowLeft" size={14} /> Back to center
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 rounded font-bold uppercase">{activeDpia?.id}</span>
                <h2 className="text-sm font-bold text-slate-950">{activeDpia?.activityName} DPIA Risk Analysis</h2>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="text-slate-400 font-medium">Portfolio Status:</span>
              <StatusBadge status={activeDpia?.status || 'draft'} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Risk identification and safeguards */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Detailed Context */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Processing Description & Proportionality</h3>
                <p className="text-xs text-slate-600 leading-normal">{activeDpia?.processingDescription}</p>
                <div className="p-3 bg-slate-50 rounded border border-slate-100 text-xs text-slate-500 leading-normal">
                  <strong>Assessment of Necessity:</strong> {activeDpia?.necessityDetails}
                </div>
              </div>

              {/* Identified hazards & mitigation 5x5 Matrix table */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">5x5 Risk Matrix & Mitigating Safeguards</h3>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">Likelihood × Severity</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {activeDpia?.risksIdentified.map((r) => (
                    <div key={r.id} className="p-3.5 border border-slate-150 rounded bg-slate-50/50 space-y-2.5">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{r.risk}</span>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${getMatrixColor(r.score)}`}>
                          Initial Score: {r.score}
                        </span>
                      </div>
                      
                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-100">
                        <p className="font-semibold text-blue-800">Mitigation Control:</p>
                        <p className="mt-0.5 italic">{r.mitigation}</p>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-mono">
                        <span>Residual Likelihood: {r.likelihood - 1 || 1} — Residual Severity: {r.severity - 1 || 1}</span>
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                          Residual Score: {r.residualScore} (Low Risk)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* DPO review / Approvals side block */}
            <div className="space-y-6">
              
              {/* Advice Note */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">DPO / IOD Legal Advice (Article 35)</h3>
                <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-3.5 rounded border border-slate-150">
                  "{activeDpia?.dpoAdvice}"
                </p>
                <div className="flex gap-2 text-[10px] text-slate-400 font-semibold font-mono">
                  <ComplianceIcon name="Shield" size={12} className="text-blue-600" />
                  <span>Article 35(2) consultation advice logged</span>
                </div>
              </div>

              {/* Approval signoffs list */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs flex flex-col justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Formal Sign-offs & Approval Gate</h3>
                <div className="space-y-3 text-xs">
                  {activeDpia?.approvals.map((app, i) => (
                    <div key={i} className="p-3 border border-slate-100 bg-slate-50 rounded space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">{app.role} — {app.approver}</span>
                        {app.status === 'approved' ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Signed</span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">Pending</span>
                        )}
                      </div>
                      
                      {app.status === 'approved' ? (
                        <p className="text-[10px] text-slate-500 leading-tight italic">"{app.comment}"</p>
                      ) : (
                        <button
                          onClick={() => handleSignOff(activeDpia, app.role)}
                          className="w-full text-center py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer mt-2"
                        >
                          Sign Risk Profile
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
