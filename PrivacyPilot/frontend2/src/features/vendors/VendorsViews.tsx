/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';
import { RiskBadge, StatusBadge } from '../../components/common/badges';
import { Vendor } from '../../types';

export const VendorsInventoryView: React.FC = () => {
  const { vendors, currentLanguage, navigateTo, addVendor } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: '',
    risk: 'low' as const,
    dpaStatus: 'signed' as const,
    country: 'Poland',
    hostingRegion: 'Warsaw, Poland',
    subprocessors: '',
    tomEvidence: 'ISO 27001 Certificate'
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    addVendor({
      name: newVendor.name,
      risk: newVendor.risk,
      dpaStatus: newVendor.dpaStatus,
      country: newVendor.country,
      hostingRegion: newVendor.hostingRegion,
      subprocessors: newVendor.subprocessors.split(',').map(s => s.trim()),
      tomEvidence: [newVendor.tomEvidence],
      transferStatus: newVendor.hostingRegion.toLowerCase().includes('poland') || newVendor.hostingRegion.toLowerCase().includes('frankfurt') ? 'eea_only' : 'safeguards_active',
      lastReview: new Date().toISOString().split('T')[0],
      owner: 'Karolina Wójcik'
    });
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {currentLanguage === 'pl' ? 'Podmioty Przetwarzające i Dostawcy' : 'Processors & Vendors Inventory'}
          </h1>
          <p className="text-xs text-slate-500">
            {currentLanguage === 'pl' 
              ? 'Nadzór nad umowami powierzenia (DPA) oraz zabezpieczeniami (Art. 28 RODO).' 
              : 'Article 28 GDPR compliance audits, DPA agreements, and subcontractor risk mapping.'}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <ComplianceIcon name="Plus" size={14} /> {currentLanguage === 'pl' ? 'Dodaj Dostawcę' : 'Register Processor'}
        </button>
      </div>

      {/* Vendors Inventory Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Nazwa Dostawcy / Processor</th>
              <th className="px-5 py-3">Lokalizacja / Host Country</th>
              <th className="px-5 py-3">Region Chmury / Cloud region</th>
              <th className="px-5 py-3">Umowa DPA / DPA status</th>
              <th className="px-5 py-3">Ryzyko / Risk</th>
              <th className="px-5 py-3">Ostatni Przegląd / Audit</th>
              <th className="px-5 py-3 text-right">Zaproś / Portal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {vendors.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="text-slate-900 font-bold block">{v.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {v.id}</span>
                </td>
                <td className="px-5">{v.country}</td>
                <td className="px-5 font-mono">{v.hostingRegion}</td>
                <td className="px-5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                    v.dpaStatus === 'signed'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : v.dpaStatus === 'in_negotiation'
                      ? 'bg-amber-50 text-amber-700 border border-amber-100'
                      : 'bg-red-50 text-red-700 border border-red-100 animate-pulse'
                  }`}>
                    {v.dpaStatus.toUpperCase()}
                  </span>
                </td>
                <td className="px-5">
                  <RiskBadge level={v.risk} />
                </td>
                <td className="px-5 text-slate-500 font-mono">{v.lastReview}</td>
                <td className="px-5 text-right whitespace-nowrap space-x-1">
                  <button
                    onClick={() => navigateTo('#/external/vendor/token-abc')}
                    className="p-1 border border-slate-200 hover:bg-slate-50 rounded text-blue-600 inline-flex items-center justify-center cursor-pointer font-mono text-[9px] px-2 font-bold uppercase"
                    title="Simulate Invited Vendor Portal"
                  >
                    Open Portal
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Register Processor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowAddModal(false)} />
          <form onSubmit={handleCreate} className="relative mx-auto max-w-lg bg-white rounded-lg shadow-2xl border border-slate-200 p-6 space-y-4 z-50">
            <h3 className="font-bold text-slate-950 text-sm border-b pb-2">Add New Processor & DPA Scope</h3>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Processor Name / Nazwa Dostawcy</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MailerLite EU Solutions"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Hosting Country</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lithuania / EU"
                    value={newVendor.country}
                    onChange={(e) => setNewVendor({ ...newVendor, country: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Hosting Region / Cloud Region</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GCP Lithuania (europe-north1)"
                    value={newVendor.hostingRegion}
                    onChange={(e) => setNewVendor({ ...newVendor, hostingRegion: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Assessed Risk</label>
                  <select
                    value={newVendor.risk}
                    onChange={(e: any) => setNewVendor({ ...newVendor, risk: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                    <option value="critical">Critical Risk</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">DPA Contract Status</label>
                  <select
                    value={newVendor.dpaStatus}
                    onChange={(e: any) => setNewVendor({ ...newVendor, dpaStatus: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                  >
                    <option value="signed">Signed & Archived</option>
                    <option value="in_negotiation">In Negotiation</option>
                    <option value="missing">Missing / Warning</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Subprocessors (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Cloudflare Inc, Stripe S.A."
                  value={newVendor.subprocessors}
                  onChange={(e) => setNewVendor({ ...newVendor, subprocessors: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-1.5 bg-slate-100 rounded">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded">Save Processor</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

// ----------------------------------------------------
// EXTERNAL INVITED VENDOR PORTAL VIEW
// ----------------------------------------------------
export const ExternalVendorPortalView: React.FC = () => {
  const { currentLanguage, showToast } = useApp();
  const [vendorAnswers, setVendorAnswers] = useState({
    dpaAgreed: true,
    dataSovereigntyEnforced: true,
    subprocessorList: 'Equinix Frankfurt Datacenter, Cloudflare EU-Edge Networks',
    encryptionAtRest: true,
    intrusionPrevention: true,
    restorationTesting: true
  });

  const handleExternalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Questionnaire response submitted successfully. ABC Logistics notified.', 'success');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Portal Branding Banner */}
      <div className="p-6 bg-slate-900 text-white rounded-lg space-y-2">
        <span className="bg-cyan-600 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded">Invited Vendor Security Scope</span>
        <h1 className="text-lg font-bold">Whispli Secure Ethics Portal</h1>
        <p className="text-xs text-slate-400">
          This portal allows invited subcontractors to complete security assessments and TOM evidence checks under GDPR Article 28 guidelines.
        </p>
      </div>

      <form onSubmit={handleExternalSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 shadow-xs text-xs">
        <h3 className="font-bold text-slate-900 border-b pb-1.5">Article 28 RODO & Safeguards Questionnaire</h3>
        
        <div className="space-y-4">
          <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-150 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={vendorAnswers.dpaAgreed}
              onChange={(e) => setVendorAnswers({ ...vendorAnswers, dpaAgreed: e.target.checked })}
              className="mt-0.5"
            />
            <div>
              <p className="font-bold text-slate-900">Sign & Acknowledge ABC Logistics Data Processing Addendum (DPA v2026)</p>
              <p className="text-[10px] text-slate-500">We formally execute the core security obligations defined under GDPR Article 28(3) bilateral rules.</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-150 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={vendorAnswers.dataSovereigntyEnforced}
              onChange={(e) => setVendorAnswers({ ...vendorAnswers, dataSovereigntyEnforced: e.target.checked })}
              className="mt-0.5"
            />
            <div>
              <p className="font-bold text-slate-900">European Sovereignty (EU/EEA Datacenter Locking)</p>
              <p className="text-[10px] text-slate-500">We guarantee all database tables, replication logs, and backup files reside strictly within European boundaries.</p>
            </div>
          </label>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">List of active subprocessors / subcontractors</label>
            <textarea
              rows={2}
              value={vendorAnswers.subprocessorList}
              onChange={(e) => setVendorAnswers({ ...vendorAnswers, subprocessorList: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 font-mono text-[11px]"
            />
          </div>

          <div className="space-y-2.5">
            <p className="font-bold text-slate-800">Verify active Technical & Organizational Measures (TOMs):</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-100 rounded">
                <input
                  type="checkbox"
                  checked={vendorAnswers.encryptionAtRest}
                  onChange={(e) => setVendorAnswers({ ...vendorAnswers, encryptionAtRest: e.target.checked })}
                />
                <span className="text-[10px] font-semibold text-slate-700">AES-256 database encryption at rest</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-100 rounded">
                <input
                  type="checkbox"
                  checked={vendorAnswers.intrusionPrevention}
                  onChange={(e) => setVendorAnswers({ ...vendorAnswers, intrusionPrevention: e.target.checked })}
                />
                <span className="text-[10px] font-semibold text-slate-700">Intrusion Detection (IDPS)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t flex justify-between items-center shrink-0">
          <p className="text-[10px] text-slate-400">Draft generated by Invited Processor</p>
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs cursor-pointer shadow-xs"
          >
            Submit Questionnaire Response
          </button>
        </div>
      </form>

    </div>
  );
};
