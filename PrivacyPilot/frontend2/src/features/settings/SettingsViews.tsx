/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';

export const SettingsViews: React.FC = () => {
  const { currentLanguage, showToast, tenants } = useApp();
  const activeTenant = tenants[0];

  const [companyProfile, setCompanyProfile] = useState({
    legalName: activeTenant?.name || 'ABC Logistics Poland Sp. z o.o.',
    nip: 'PL5252839201',
    address: 'ul. Towarowa 22, 00-001 Warszawa, Poland',
    industry: 'Logistics',
    dpoName: 'Janusz Nowak',
    dpoEmail: 'dpo@abclogistics.pl'
  });

  const [policies, setPolicies] = useState({
    autoDpiaScreening: true,
    strictEeaResidency: true,
    whistleblowerChannelActive: true
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Corporate compliance and residency parameters saved successfully', 'success');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {currentLanguage === 'pl' ? 'Ustawienia Organizacyjne' : 'Enterprise Compliance Settings'}
        </h1>
        <p className="text-xs text-slate-500">Configure corporate credentials, data sovereignty parameters, and bilateral privacy configurations.</p>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 shadow-xs text-xs">
        
        {/* Profile details */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
            <ComplianceIcon name="Users" size={14} className="text-blue-600" />
            <span>Corporate Registrar Profiles</span>
          </h3>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Legal Company Name</label>
              <input
                type="text"
                value={companyProfile.legalName}
                onChange={(e) => setCompanyProfile({ ...companyProfile, legalName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Polish NIP (Tax Identification)</label>
                <input
                  type="text"
                  value={companyProfile.nip}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, nip: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Industry / Branża</label>
                <input
                  type="text"
                  value={companyProfile.industry}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, industry: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Office HQ Address</label>
              <input
                type="text"
                value={companyProfile.address}
                onChange={(e) => setCompanyProfile({ ...companyProfile, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* DPO details */}
        <div className="space-y-4 pt-2">
          <h3 className="font-bold text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
            <ComplianceIcon name="Shield" size={14} className="text-blue-600" />
            <span>Designated Data Protection Officer (DPO / IOD)</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">DPO Full Name / IOD Imię i Nazwisko</label>
              <input
                type="text"
                value={companyProfile.dpoName}
                onChange={(e) => setCompanyProfile({ ...companyProfile, dpoName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">DPO Email</label>
              <input
                type="text"
                value={companyProfile.dpoEmail}
                onChange={(e) => setCompanyProfile({ ...companyProfile, dpoEmail: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Global policies toggles */}
        <div className="space-y-4 pt-2">
          <h3 className="font-bold text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
            <ComplianceIcon name="Scale" size={14} className="text-blue-600" />
            <span>Compliance Automation & Sovereignty Safeguards</span>
          </h3>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-150 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={policies.autoDpiaScreening}
                onChange={(e) => setPolicies({ ...policies, autoDpiaScreening: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <p className="font-bold text-slate-900">Enforce Automated Polish DPIA Screening</p>
                <p className="text-[10px] text-slate-500">Force every new ROPA record to be matched against the 12 threshold criteria from Monitor Polski.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-150 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={policies.strictEeaResidency}
                onChange={(e) => setPolicies({ ...policies, strictEeaResidency: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <p className="font-bold text-slate-900">Enforce Strict Sovereign EU/EEA Residency</p>
                <p className="text-[10px] text-slate-500">Raise real-time warning alerts if any logged processor is hosted outside European cloud regions.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t shrink-0">
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs cursor-pointer shadow-xs"
          >
            Save Organizational Parameters
          </button>
        </div>

      </form>
    </div>
  );
};
