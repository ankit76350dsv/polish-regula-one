/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';
import { StatusBadge } from '../../components/common/badges';
import { DSARRequest } from '../../types';

export const RequestsQueueView: React.FC = () => {
  const { requests, currentLanguage, updateRequest, showToast } = useApp();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const activeReq = requests.find(r => r.id === activeRequestId);

  const handleToggleSubtask = (req: DSARRequest, subtaskId: string) => {
    const updatedTasks = req.collectionTasks.map(t => {
      if (t.id === subtaskId) {
        return { ...t, status: (t.status === 'done' ? 'pending' : 'done') as any };
      }
      return t;
    });

    const allDone = updatedTasks.every(t => t.status === 'done');
    const newStatus = allDone ? ('completed' as const) : req.status;

    updateRequest({
      ...req,
      collectionTasks: updatedTasks,
      status: newStatus
    });
    showToast('Internal database collection task toggled', 'success');
  };

  const triggerPackageDownload = () => {
    showToast('Packaging collected dataset folders...', 'info');
    setTimeout(() => {
      showToast('Subject Access Data Archive packaged: PP_SubjectData_PESEL.zip dispatched.', 'success');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {!activeRequestId ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {currentLanguage === 'pl' ? 'Prawa Podmiotów Danych (DSAR)' : 'Subject Access Requests (DSAR)'}
              </h1>
              <p className="text-xs text-slate-500">
                {currentLanguage === 'pl' 
                  ? 'Kolejka wniosków obywatelskich (Art. 15-22 RODO) z kontrolą terminów SLA.' 
                  : 'Article 12-22 GDPR request queue, identity verifications, and data compilation packages.'}
              </p>
            </div>
          </div>

          {/* Requests Grid */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Wnioskodawca / Subject</th>
                  <th className="px-5 py-3">Typ żądania / Type</th>
                  <th className="px-5 py-3">Otrzymano / Received</th>
                  <th className="px-5 py-3">SLA Deadline / Limit</th>
                  <th className="px-5 py-3">Kolekcja / Tasks</th>
                  <th className="px-5 py-3">Status RODO / State</th>
                  <th className="px-5 py-3 text-right">Zarządzaj / Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {requests.map((req) => {
                  const doneCount = req.collectionTasks.filter(t => t.status === 'done').length;
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-slate-900 font-bold block">{req.requesterName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {req.id}</span>
                      </td>
                      <td className="px-5 capitalize font-bold text-slate-700">{req.requestType}</td>
                      <td className="px-5 text-slate-500 font-mono">{req.receivedAt ? req.receivedAt.split('T')[0] : ''}</td>
                      <td className="px-5 text-slate-500 font-mono font-bold text-red-600">{req.deadline ? req.deadline.split('T')[0] : ''}</td>
                      <td className="px-5 font-mono text-[10px]">
                        {doneCount} of {req.collectionTasks.length} done
                      </td>
                      <td className="px-5">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-5 text-right">
                        <button
                          onClick={() => setActiveRequestId(req.id)}
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
      ) : (
        // ACTIVE DSAR REQUEST WORKSPACE
        <div className="space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <button
                onClick={() => setActiveRequestId(null)}
                className="text-slate-400 hover:text-slate-900 text-xs font-semibold flex items-center gap-1 cursor-pointer mb-2"
              >
                <ComplianceIcon name="ArrowLeft" size={14} /> Return to queue
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 rounded uppercase font-bold">{activeReq?.id}</span>
                <h2 className="text-sm font-bold text-slate-950">{activeReq?.requesterName} Right of Access File</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={triggerPackageDownload}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <ComplianceIcon name="FileText" size={12} /> Package & Dispatch Subject Access ZIP
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: ID Verification & Collection checks */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Verification & Legal logs */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs text-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identity Verification Checklist (Article 12(6))</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-2.5 p-2.5 bg-slate-50 border border-slate-150 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeReq?.identityVerified}
                      onChange={(e) => updateRequest({ ...activeReq, identityVerified: e.target.checked })}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-slate-900">PESEL & ID Checked</p>
                      <p className="text-[10px] text-slate-500">Government credential confirmed.</p>
                    </div>
                  </label>

                  <div className="p-2.5 bg-slate-50 rounded border border-slate-150 font-mono text-[10px] text-slate-500">
                    <span className="font-sans font-semibold text-slate-800 block mb-0.5">Authorization Code:</span>
                    {activeReq?.authCode} (MFA Verified)
                  </div>
                </div>
              </div>

              {/* Data compilation tasks */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-xs text-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Internal Database Collection Checkpoints</h3>
                
                <div className="space-y-2.5">
                  {activeReq?.collectionTasks.map((t) => {
                    const done = t.status === 'done';
                    return (
                      <label
                        key={t.id}
                        className={`flex items-start gap-3 p-3 rounded border transition-colors cursor-pointer ${
                          done
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                            : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => handleToggleSubtask(activeReq, t.id)}
                          className="mt-0.5 text-emerald-600 focus:ring-0"
                        />
                        <div className="flex-1">
                          <p className="font-bold">{t.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Department action handler: {t.assignedDept}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Right Column: Templates & Deadlines */}
            <div className="space-y-6 text-xs">
              
              {/* Deadline Indicator */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">SLA Calendar Remaining</h3>
                <div className="p-4 bg-red-50 border border-red-200 rounded text-center">
                  <p className="font-mono text-xl font-extrabold text-red-600 tracking-wider">12 Days Left</p>
                  <p className="text-[10px] text-red-800 font-semibold uppercase tracking-wider">SLA Deadline Alert</p>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Data Subject requests must be completed within 1 month. Under Article 12(3), a 2-month extension is permissible for highly complex scopes.
                </p>
              </div>

              {/* Communication Templates */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bilingual Regulatory Letter Templates</h3>
                
                <div className="space-y-2">
                  <button
                    onClick={() => showToast('Formal extension notice template copied to clipboard', 'success')}
                    className="w-full text-left p-2.5 bg-slate-50 border border-slate-150 rounded hover:bg-slate-100 cursor-pointer"
                  >
                    <p className="font-bold text-slate-800">1-Month Extension Notice</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Formal notification citing Article 12(3) complexity arguments.</p>
                  </button>

                  <button
                    onClick={() => showToast('Dispatched final data archive dispatch letter', 'success')}
                    className="w-full text-left p-2.5 bg-slate-50 border border-slate-150 rounded hover:bg-slate-100 cursor-pointer"
                  >
                    <p className="font-bold text-slate-800">Final Package Dispatch Letter</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Accompanying dispatch letter for secure file transmittal.</p>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
