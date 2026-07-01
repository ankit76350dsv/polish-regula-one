/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';

export const OnboardingView: React.FC = () => {
  const { navigateTo, currentLanguage, showToast } = useApp();
  const [step, setStep] = useState(1);

  // Form State
  const [profile, setProfile] = useState({
    legalName: 'Mazovia Express Logistics Sp. z o.o.',
    nip: 'PL5259403219',
    address: 'ul. Grzybowska 4, 00-132 Warszawa, Poland',
    industry: 'Logistics',
    employees: '120',
    lang: 'pl'
  });

  const [scope, setScope] = useState({
    isController: true,
    isProcessor: false,
    hasSpecialCategory: true,
    hasPublicAuthority: false,
    dpoAppointed: 'needs_assessment'
  });

  const [residency, setResidency] = useState({
    euOnlyPolicy: true,
    preferredRegion: 'AWS EU Frankfurt (eu-central-1)',
    transparencyAccepted: true
  });

  const [usersToInvite, setUsersToInvite] = useState([
    { email: 'dpo.internal@mazovia.pl', role: 'DPO' },
    { email: 'hr.head@mazovia.pl', role: 'MANAGER' }
  ]);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<'Starter' | 'Growth' | 'Enterprise'>('Growth');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setCsvFile(e.dataTransfer.files[0]);
      showToast('Mock CSV uploaded successfully for mapping', 'success');
    }
  };

  const executeCompleteOnboarding = () => {
    showToast('Onboarding completed! Workspace initialized.', 'success');
    navigateTo('#/app/dashboard');
  };

  const stepsList = [
    { num: 1, title: 'Company Profile', titlePl: 'Profil Spółki' },
    { num: 2, title: 'Compliance Scope', titlePl: 'Zakres RODO' },
    { num: 3, title: 'Data Residency', titlePl: 'Lokalizacja Danych' },
    { num: 4, title: 'Team Invites', titlePl: 'Zatrudnieni / Zespół' },
    { num: 5, title: 'Excel Import', titlePl: 'Import Excel / CSV' },
    { num: 6, title: 'SaaS Plan', titlePl: 'Plan Subskrypcji' },
    { num: 7, title: 'Final Review', titlePl: 'Podsumowanie' }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      
      {/* Header */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1 bg-blue-600 rounded text-white flex items-center justify-center">
            <ComplianceIcon name="Shield" size={16} />
          </div>
          <span className="font-bold text-sm tracking-tight">PrivacyPilot Onboarding</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Step {step} of 7</span>
        </div>
      </header>

      {/* Steps horizontal bar */}
      <div className="bg-slate-950 border-b border-slate-800/60 py-3.5 px-6 hidden md:block shrink-0">
        <div className="max-w-4xl mx-auto flex justify-between">
          {stepsList.map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === s.num
                  ? 'bg-blue-600 text-white font-semibold'
                  : step > s.num
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-500'
              }`}>
                {step > s.num ? '✓' : s.num}
              </span>
              <span className={`text-[11px] font-medium ${step === s.num ? 'text-white' : 'text-slate-500'}`}>
                {currentLanguage === 'pl' ? s.titlePl : s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main stepper workspace */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950/40">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800/80 rounded-xl p-6 sm:p-8 space-y-6 shadow-2xl">
          
          {/* STEP 1: COMPANY PROFILE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  {currentLanguage === 'pl' ? 'Podaj dane rejestrowe spółki' : 'Register Corporate Profile'}
                </h2>
                <p className="text-xs text-slate-400">
                  {currentLanguage === 'pl' ? 'Te informacje zostaną umieszczone w nagłówkach generowanych rejestrów RODO i DPIA.' : 'These details will populate generated ROPA reports and audit logs.'}
                </p>
              </div>
              
              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Legal Company Name / Nazwa Spółki</label>
                  <input
                    type="text"
                    value={profile.legalName}
                    onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">NIP (Tax Identification)</label>
                    <input
                      type="text"
                      value={profile.nip}
                      onChange={(e) => setProfile({ ...profile, nip: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Industry / Branża</label>
                    <select
                      value={profile.industry}
                      onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 focus:outline-none"
                    >
                      <option value="Logistics">Logistics & Supply Chain</option>
                      <option value="Retail">Retail & Commerce</option>
                      <option value="Healthcare">Healthcare & Medicine</option>
                      <option value="Technology">Technology & SaaS</option>
                      <option value="Finance">Financial Services</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Corporate Office Address / Siedziba</label>
                  <input
                    type="text"
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COMPLIANCE SCOPE */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  {currentLanguage === 'pl' ? 'Określ rolę i zakres przetwarzania' : 'Define Compliance & Processing Scope'}
                </h2>
                <p className="text-xs text-slate-400">
                  Determine your organization status and flag if you process sensitive/special category details.
                </p>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="space-y-2.5">
                  <label className="font-bold text-slate-400 uppercase tracking-wider block">GDPR / RODO Roles</label>
                  
                  <label className="flex items-start gap-3 p-3 bg-slate-950/50 hover:bg-slate-950 border border-slate-800 rounded cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={scope.isController}
                      onChange={(e) => setScope({ ...scope, isController: e.target.checked })}
                      className="mt-1 rounded border-slate-800 text-blue-600 bg-slate-950 focus:ring-0"
                    />
                    <div>
                      <p className="font-semibold text-slate-200">Data Controller (Administrator Danych - ADO)</p>
                      <p className="text-[10px] text-slate-500">We collect and determine the purposes and means of processing personal data ourselves.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-slate-950/50 hover:bg-slate-950 border border-slate-800 rounded cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={scope.isProcessor}
                      onChange={(e) => setScope({ ...scope, isProcessor: e.target.checked })}
                      className="mt-1 rounded border-slate-800 text-blue-600 bg-slate-950 focus:ring-0"
                    />
                    <div>
                      <p className="font-semibold text-slate-200">Data Processor (Podmiot Przetwarzający)</p>
                      <p className="text-[10px] text-slate-500">We process personal data on behalf of and under instructions from corporate clients.</p>
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-slate-400">Are special category datasets (Art. 9 RODO) in scope?</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="special_cat"
                        checked={scope.hasSpecialCategory === true}
                        onChange={() => setScope({ ...scope, hasSpecialCategory: true })}
                        className="text-blue-600 bg-slate-950 border-slate-800 focus:ring-0"
                      />
                      <span>Yes (Medical, Biometric, Genetic, Trade Union logs)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="special_cat"
                        checked={scope.hasSpecialCategory === false}
                        onChange={() => setScope({ ...scope, hasSpecialCategory: false })}
                        className="text-blue-600 bg-slate-950 border-slate-800 focus:ring-0"
                      />
                      <span>No (Standard identifiers only)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DATA RESIDENCY POLICY */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  {currentLanguage === 'pl' ? 'Suwerenność i lokalizacja danych' : 'Sovereign Data Residency & Cloud Policies'}
                </h2>
                <p className="text-xs text-slate-400">
                  Enforce localized hosting to align with EU regulations and restrict external international transfers.
                </p>
              </div>

              <div className="space-y-4 text-xs text-slate-300">
                <label className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={residency.euOnlyPolicy}
                    onChange={(e) => setResidency({ ...residency, euOnlyPolicy: e.target.checked })}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-semibold text-slate-200">Enforce Strict EU/EEA-Only Product Policy</p>
                    <p className="text-[10px] text-slate-500">By checking this, our systems automatically block any subprocessors located outside the sovereign European Union zone.</p>
                  </div>
                </label>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Primary Cloud Region Location</label>
                  <select
                    value={residency.preferredRegion}
                    onChange={(e) => setResidency({ ...residency, preferredRegion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-300"
                  >
                    <option value="AWS EU Frankfurt (eu-central-1)">AWS EU Frankfurt (eu-central-1) - Highly recommended</option>
                    <option value="AWS EU Ireland (eu-west-1)">AWS EU Ireland (eu-west-1)</option>
                    <option value="Azure Europe West (Netherlands)">Azure Europe West (Netherlands)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: TEAM INVITES */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  {currentLanguage === 'pl' ? 'Zaproś Inspektorów i Właścicieli' : 'Invite Compliance Stakeholders'}
                </h2>
                <p className="text-xs text-slate-400">Assign roles early to coordinate collaborative reviews of activities and incident response drills.</p>
              </div>

              <div className="space-y-3 text-xs">
                {usersToInvite.map((user, idx) => (
                  <div key={idx} className="flex gap-2.5 items-center">
                    <input
                      type="email"
                      value={user.email}
                      onChange={(e) => {
                        const copy = [...usersToInvite];
                        copy[idx].email = e.target.value;
                        setUsersToInvite(copy);
                      }}
                      placeholder="email@company.pl"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2"
                    />
                    <select
                      value={user.role}
                      onChange={(e) => {
                        const copy = [...usersToInvite];
                        copy[idx].role = e.target.value;
                        setUsersToInvite(copy);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-2"
                    >
                      <option value="DPO">IOD / DPO Inspector</option>
                      <option value="MANAGER">Dept Manager</option>
                      <option value="COMPLIANCE_OFFICER">Compliance Officer</option>
                    </select>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => setUsersToInvite([...usersToInvite, { email: '', role: 'MANAGER' }])}
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1.5 mt-2 cursor-pointer"
                >
                  <ComplianceIcon name="Plus" size={12} /> Add Invitation Row
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: MOCK CSV EXCEL IMPORT */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  {currentLanguage === 'pl' ? 'Zaimportuj istniejący arkusz RCP' : 'Import Existing ROPA Spreadsheets'}
                </h2>
                <p className="text-xs text-slate-400">Have an existing Excel or CSV compliance table? Drag it here to simulate automatic mapping to Polish UODO-compliant fields.</p>
              </div>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                  dragActive ? 'border-blue-500 bg-blue-950/20' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <ComplianceIcon name="FileStack" className="text-slate-500 mb-3" size={32} />
                <p className="text-xs text-slate-300 font-semibold">
                  {csvFile ? `Selected: ${csvFile.name}` : 'Drag & drop Excel, CSV, or XML document'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Accepts CSV template mappings or legacy compliance matrices</p>
                
                <input
                  type="file"
                  id="csv-file-onboard"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCsvFile(e.target.files[0]);
                      showToast('Mock CSV file selected', 'success');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('csv-file-onboard')?.click()}
                  className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold tracking-wide uppercase cursor-pointer"
                >
                  Browse Files
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: PLAN SELECTOR */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  {currentLanguage === 'pl' ? 'Wybierz plan abonamentowy' : 'Select Enterprise Subscription Plan'}
                </h2>
                <p className="text-xs text-slate-400">Select simulated scale plan. Trial accounts receive 100% discount on initial mock runs.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Starter', price: '299 PLN', limit: 'Up to 50 employees' },
                  { id: 'Growth', price: '799 PLN', limit: 'Up to 500 employees' },
                  { id: 'Enterprise', price: '1999 PLN', limit: 'Unlimited scale & priority audits' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id as any)}
                    className={`p-4 border text-left rounded-lg transition-all flex flex-col justify-between h-32 cursor-pointer ${
                      selectedPlan === p.id
                        ? 'bg-blue-950/40 border-blue-500 text-white'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{p.id}</p>
                      <p className="text-[10px] text-slate-500">{p.limit}</p>
                    </div>
                    <p className="text-xs font-mono font-bold text-blue-400">{p.price}/mo</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: FINAL REVIEW */}
          {step === 7 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  {currentLanguage === 'pl' ? 'Przejrzyj konfigurację i utwórz panel' : 'Review Configuration & Launch Workspace'}
                </h2>
                <p className="text-xs text-slate-400">Verify company settings. Completing the stepper will launch the RODO Compliance Control board.</p>
              </div>

              <div className="bg-slate-950/75 border border-slate-800 rounded p-4 text-xs space-y-3 font-mono text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-500">Legal Entity:</span>
                  <span>{profile.legalName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-500">NIP Polish Tax:</span>
                  <span>{profile.nip}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-500">Region Region:</span>
                  <span>{residency.preferredRegion}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-500">Invitations:</span>
                  <span>{usersToInvite.filter(u => u.email !== '').length} invitations mapped</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SaaS Plan selected:</span>
                  <span className="text-blue-400 font-bold">{selectedPlan} Plan (Trial Activated)</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer controls */}
          <div className="flex justify-between border-t border-slate-800/80 pt-4 mt-6 shrink-0">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo('#/login')}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step < 7 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold rounded cursor-pointer"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={executeCompleteOnboarding}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer"
              >
                Launch Workspace <ComplianceIcon name="ChevronRight" size={14} />
              </button>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
