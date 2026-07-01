/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';
import { RiskBadge, StatusBadge } from '../../components/common/badges';
import { POLISH_DPIA_CRITERIA, TECHNICAL_ORGANIZATIONAL_MEASURES } from '../../lib/compliance-rules';
import { Activity } from '../../types';

// ROPA Register Main View
export const ActivitiesRegisterView: React.FC = () => {
  const {
    activities,
    currentLanguage,
    deleteActivity,
    navigateTo,
    showToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'controller' | 'processor' | 'drafts' | 'review'>('all');
  const [search, setSearch] = useState('');
  const [density, setDensity] = useState<'normal' | 'compact'>('normal');

  const filtered = activities.filter((act) => {
    const matchesSearch = act.name.toLowerCase().includes(search.toLowerCase()) ||
                          act.department.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeTab === 'controller') return act.role === 'controller';
    if (activeTab === 'processor') return act.role === 'processor';
    if (activeTab === 'drafts') return act.status === 'draft';
    if (activeTab === 'review') return act.status === 'in_review';
    return true;
  });

  const triggerMockExport = () => {
    showToast(currentLanguage === 'pl' ? 'Generowanie rejestru RCP...' : 'Assembling Rejestr Czynności PDF/DOCX mock package...', 'info');
    setTimeout(() => {
      showToast(currentLanguage === 'pl' ? 'Pomyślnie wyeksportowano plik RCP.zip' : 'Export completed successfully. PP_ROPA_Art30.zip dispatched.', 'success');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {currentLanguage === 'pl' ? 'Rejestr Czynności Przetwarzania (ROPA)' : 'Records of Processing Activities'}
          </h1>
          <p className="text-xs text-slate-500">
            {currentLanguage === 'pl' 
              ? 'Wymagany przez Art. 30 RODO rejestr administratora oraz procesora.' 
              : 'Official Article 30 GDPR audit logs coordinating internal registers and subprocessors.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerMockExport}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded flex items-center gap-1.5 cursor-pointer bg-white"
          >
            <ComplianceIcon name="FileText" size={14} /> Export XML/PDF
          </button>
          <button
            onClick={() => navigateTo('#/app/activities/new')}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <ComplianceIcon name="Plus" size={14} /> {currentLanguage === 'pl' ? 'Nowa Czynność' : 'Add Activity'}
          </button>
        </div>
      </div>

      {/* Registers Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3.5 justify-between bg-white border border-slate-200 p-3 rounded-lg">
        
        {/* Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'all', pl: 'Wszystkie', en: 'All' },
            { id: 'controller', pl: 'Administrator (Art. 30 ust. 1)', en: 'Controller' },
            { id: 'processor', pl: 'Procesor (Art. 30 ust. 2)', en: 'Processor' },
            { id: 'drafts', pl: 'Szkice', en: 'Drafts' },
            { id: 'review', pl: 'W toku', en: 'In Review' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {currentLanguage === 'pl' ? tab.pl : tab.en}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <ComplianceIcon name="Search" className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder={currentLanguage === 'pl' ? 'Szukaj czynności...' : 'Search activity...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {/* Density button */}
          <button
            onClick={() => setDensity(density === 'normal' ? 'compact' : 'normal')}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded text-slate-500"
            title="Toggle Density"
          >
            <ComplianceIcon name="Menu" size={14} />
          </button>
        </div>
      </div>

      {/* ROPA Data Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <ComplianceIcon name="FolderKanban" className="text-slate-300 mx-auto" size={44} />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">{currentLanguage === 'pl' ? 'Brak czynności' : 'No processing activities found'}</p>
              <p className="text-xs text-slate-500">
                {currentLanguage === 'pl' ? 'Uruchom kreator, aby dodać swoją pierwszą czynność RODO.' : 'Start the multi-step compliance wizard to log your first active record.'}
              </p>
            </div>
            <button
              onClick={() => navigateTo('#/app/activities/new')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded cursor-pointer"
            >
              {currentLanguage === 'pl' ? 'Uruchom Kreator' : 'Launch Wizard Stepper'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Nazwa / Activity</th>
                  <th className="px-5 py-3">Dział / Dept</th>
                  <th className="px-5 py-3">Rola RODO / Role</th>
                  <th className="px-5 py-3">Czas Przechowywania / Retention</th>
                  <th className="px-5 py-3">Completeness</th>
                  <th className="px-5 py-3">DPIA</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Akcje / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className={`px-5 font-semibold text-slate-900 ${density === 'compact' ? 'py-2' : 'py-3.5'}`}>
                      <button
                        onClick={() => navigateTo(`#/app/activities/${act.id}`)}
                        className="hover:underline hover:text-blue-600 text-left cursor-pointer"
                      >
                        {act.name}
                      </button>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">{act.systemUsed}</p>
                    </td>
                    <td className="px-5 font-medium">{act.department}</td>
                    <td className="px-5">
                      <span className="capitalize font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                        {act.role === 'controller' ? 'ADO / Controller' : 'Procesor / Processor'}
                      </span>
                    </td>
                    <td className="px-5 font-mono font-medium">{act.retentionPeriod}</td>
                    <td className="px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${act.completenessScore}%` }} />
                        </div>
                        <span className="font-mono text-[10px] text-slate-500">{act.completenessScore}%</span>
                      </div>
                    </td>
                    <td className="px-5">
                      {act.dpiaRequired === 'required' ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">DPIA Req</span>
                      ) : act.dpiaRequired === 'optional' ? (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Optional</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-5">
                      <StatusBadge status={act.status} />
                    </td>
                    <td className="px-5 py-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => navigateTo(`#/app/activities/${act.id}`)}
                        className="p-1.5 border border-slate-200 hover:border-slate-300 rounded text-slate-500 hover:text-blue-600 inline-flex items-center justify-center cursor-pointer"
                        title="View Details"
                      >
                        <ComplianceIcon name="Eye" size={14} />
                      </button>
                      <button
                        onClick={() => deleteActivity(act.id)}
                        className="p-1.5 border border-slate-200 hover:border-red-300 rounded text-slate-400 hover:text-red-600 inline-flex items-center justify-center cursor-pointer"
                        title="Delete"
                      >
                        <ComplianceIcon name="Trash2" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------
// MULTI-STEP CREATION WIZARD
// ----------------------------------------------------
export const ActivityWizardView: React.FC = () => {
  const { addActivity, currentLanguage, navigateTo } = useApp();
  const [wizardStep, setWizardStep] = useState(1);

  // Form parameters state
  const [form, setForm] = useState({
    name: '',
    department: 'Human Resources',
    ownerName: 'Marek Mazur',
    role: 'controller' as 'controller' | 'processor',
    status: 'draft' as any,
    purpose: '',
    description: '',
    systemUsed: '',
    lawfulBasis: 'Art. 6(1)(b) - Contractual obligation',
    specialCategoryCondition: '',
    criminalCategory: '',
    dataSubjects: [] as string[],
    dataCategories: [] as string[],
    dataSources: [] as string[],
    recipients: [] as string[],
    vendors: [] as string[],
    transfers: false,
    retentionPeriod: '5 years',
    retentionBasis: 'Polish Accounting Law standards',
    securityMeasures: [] as string[],
    dpiaRequired: 'not_indicated' as 'required' | 'optional' | 'not_indicated',
    criteriaMatched: [] as string[],
    privacyNoticeCovered: 'website_privacy_notice'
  });

  const subjectsList = ['Employees', 'Job Candidates', 'Active Customers', 'Website Visitors', 'Former Staff', 'Whistleblowers', 'Patients'];
  const dataCategoriesList = ['Identification Info (Name/Surname)', 'Contact Info (Email/Phone)', 'Financial & Banking Logs', 'Employment History', 'National Tax Identifiers (PESEL/NIP)', 'CCTV Surveillance footage', 'Medical Health details (Art 9)', 'Genetic/Biometric signatures'];
  const sourcesList = ['Directly from Data Subjects', 'Linked Employer portals', 'Public Government registries', 'Referral vendors'];
  const recipientsList = ['Internal Operations Crew', 'Corporate Tax offices (US)', 'Social Security Board (ZUS)', 'External cloud host processor'];

  // Handle Polish threshold criteria clicks (12 criteria)
  const handleCriteriaToggle = (criteriaId: string) => {
    let copy = [...form.criteriaMatched];
    if (copy.includes(criteriaId)) {
      copy = copy.filter(c => c !== criteriaId);
    } else {
      copy.push(criteriaId);
    }
    
    // Auto calculate if DPIA is required (Rule of thumb: 2 or more criteria matched = REQUIRED)
    let dReq: 'required' | 'optional' | 'not_indicated' = 'not_indicated';
    if (copy.length >= 2) {
      dReq = 'required';
    } else if (copy.length === 1) {
      dReq = 'optional';
    }

    setForm({ ...form, criteriaMatched: copy, dpiaRequired: dReq });
  };

  const handleCheckboxGroup = (groupKey: 'dataSubjects' | 'dataCategories' | 'dataSources' | 'recipients' | 'securityMeasures', val: string) => {
    let copy = [...form[groupKey]];
    if (copy.includes(val)) {
      copy = copy.filter(v => v !== val);
    } else {
      copy.push(val);
    }
    setForm({ ...form, [groupKey]: copy });
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const actId = addActivity({
      name: form.name || 'Untitled Activity',
      department: form.department,
      ownerId: 'user-manager',
      ownerName: form.ownerName,
      role: form.role as any,
      status: form.status,
      reviewDate: new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      purpose: form.purpose,
      description: form.description,
      systemUsed: form.systemUsed,
      lawfulBasis: form.lawfulBasis,
      specialCategoryCondition: form.specialCategoryCondition || undefined,
      criminalCategory: form.criminalCategory || undefined,
      dataSubjects: form.dataSubjects,
      dataCategories: form.dataCategories,
      dataSources: form.dataSources,
      recipients: form.recipients,
      vendors: form.vendors,
      transfers: form.transfers,
      retentionPeriod: form.retentionPeriod,
      retentionBasis: form.retentionBasis,
      securityMeasures: form.securityMeasures,
      dpiaRequired: form.dpiaRequired
    });
    navigateTo(`#/app/activities/${actId}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Step Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {currentLanguage === 'pl' ? 'Kreator Czynności RCP RODO' : 'ROPA Compliance Compiler'}
          </h2>
          <p className="text-[11px] text-slate-500">Step {wizardStep} of 6 — Fill details step-by-step</p>
        </div>
        <button onClick={() => navigateTo('#/app/activities')} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer">
          <ComplianceIcon name="X" size={14} /> Close
        </button>
      </div>

      <form onSubmit={handleSaveSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-xs">
        
        {/* STEP 1: BASICS */}
        {wizardStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">1. Basics & Corporate Owners</h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Activity Name / Nazwa Czynności *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Employee Payroll Accounting"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Department / Dział</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none"
                  >
                    <option value="Human Resources">Human Resources (HR)</option>
                    <option value="Marketing & PR">Marketing & Sales</option>
                    <option value="Medical Services">Medical Department</option>
                    <option value="Operations & Security">Operations & Logistics</option>
                    <option value="Legal & Compliance">Legal / Whistleblowing</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Role / Rola RODO</label>
                  <div className="flex gap-4 pt-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="act_role"
                        checked={form.role === 'controller'}
                        onChange={() => setForm({ ...form, role: 'controller' })}
                      />
                      <span>Controller (ADO)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="act_role"
                        checked={form.role === 'processor'}
                        onChange={() => setForm({ ...form, role: 'processor' })}
                      />
                      <span>Processor (Podmiot Przetwarzający)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Database or IT System Used / Nazwa Systemu</label>
                <input
                  type="text"
                  placeholder="e.g. SAP ERP Core, Salesforce, Hikvision NVR"
                  value={form.systemUsed}
                  onChange={(e) => setForm({ ...form, systemUsed: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PURPOSE & LEGAL BASIS */}
        {wizardStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">2. Purposes & Legal Foundations</h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Purpose description / Cel i Opis Przetwarzania *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe why this processing is done and who has access."
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Lawful Basis (GDPR Article 6(1)) *</label>
                <select
                  value={form.lawfulBasis}
                  onChange={(e) => setForm({ ...form, lawfulBasis: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                >
                  <option value="Art. 6(1)(a) - Consent of Data Subject">Art. 6(1)(a) - Consent of Data Subject</option>
                  <option value="Art. 6(1)(b) - Execution of a contract">Art. 6(1)(b) - Execution of a contract / prior steps</option>
                  <option value="Art. 6(1)(c) - Legal obligation of Controller">Art. 6(1)(c) - Legal obligation of Controller (statutory laws)</option>
                  <option value="Art. 6(1)(f) - Legitimate interests of Controller">Art. 6(1)(f) - Legitimate interests of Controller / third parties</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Condition for Special Categories (GDPR Article 9(2)) — Optional</label>
                <input
                  type="text"
                  placeholder="e.g. Art. 9(2)(h) - Provision of health diagnostics or healthcare treatments"
                  value={form.specialCategoryCondition}
                  onChange={(e) => setForm({ ...form, specialCategoryCondition: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DATA SUBJECTS & CATEGORIES */}
        {wizardStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">3. Data Subjects & Category Selections</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2 border border-slate-100 p-3 rounded bg-slate-50/50">
                <label className="font-bold text-slate-700 block mb-1">Data Subjects / Osoby</label>
                {subjectsList.map((subj) => (
                  <label key={subj} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.dataSubjects.includes(subj)}
                      onChange={() => handleCheckboxGroup('dataSubjects', subj)}
                    />
                    <span>{subj}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2 border border-slate-100 p-3 rounded bg-slate-50/50">
                <label className="font-bold text-slate-700 block mb-1">Data Categories / Kategorie danych</label>
                {dataCategoriesList.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.dataCategories.includes(cat)}
                      onChange={() => handleCheckboxGroup('dataCategories', cat)}
                    />
                    <span>{cat}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: RETENTION & TOM EVIDENCE */}
        {wizardStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">4. Retention Calendars & TOM Measures</h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Retention Period / Okres przechowywania</label>
                  <input
                    type="text"
                    placeholder="e.g. 10 years, 30 days"
                    value={form.retentionPeriod}
                    onChange={(e) => setForm({ ...form, retentionPeriod: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 focus:outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Legal Retention Basis / Podstawa okresu</label>
                  <input
                    type="text"
                    placeholder="e.g. Polish Labor Code Art. 94"
                    value={form.retentionBasis}
                    onChange={(e) => setForm({ ...form, retentionBasis: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Technical & Organizational Measures (TOMs)</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-150 rounded">
                  {TECHNICAL_ORGANIZATIONAL_MEASURES.map((tom) => (
                    <label key={tom.id} className="flex items-start gap-2 py-1 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={form.securityMeasures.includes(tom.name)}
                        onChange={() => handleCheckboxGroup('securityMeasures', tom.name)}
                        className="mt-0.5"
                      />
                      <span className="text-[10px] leading-tight text-slate-600"><strong>{tom.id}:</strong> {tom.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: POLISH DPIA THRESHOLD SCREENING */}
        {wizardStep === 5 && (
          <div className="space-y-4">
            <div className="space-y-1 border-b border-slate-100 pb-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">5. Polish DPIA Threshold Analysis (Monitor Polski 2019 poz. 666)</h3>
              <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 font-bold uppercase px-2 py-0.5 rounded">Official Checklist</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal mb-3">
              GDPR Article 35 requires a DPIA for processing likely to result in high risk. Under official Polish guidance, match <strong>2 or more criteria</strong> below to declare a mandatory DPIA.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 border border-slate-100 rounded p-2 bg-slate-50/50">
              {POLISH_DPIA_CRITERIA.map((crit) => {
                const checked = form.criteriaMatched.includes(crit.id);
                return (
                  <label
                    key={crit.id}
                    className={`flex items-start gap-3 p-2.5 rounded border transition-colors cursor-pointer ${
                      checked
                        ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                        : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleCriteriaToggle(crit.id)}
                      className="mt-0.5 text-blue-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-bold flex items-center gap-1.5">
                        <span className="text-[10px] bg-slate-200 text-slate-800 px-1 rounded font-mono font-semibold">{crit.code}</span>
                        {currentLanguage === 'pl' ? crit.labelPl : crit.labelEn}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{currentLanguage === 'pl' ? crit.descriptionPl : crit.descriptionEn}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Auto-Calculated Assessment */}
            <div className={`p-4 rounded-lg border text-xs flex justify-between items-center ${
              form.dpiaRequired === 'required'
                ? 'bg-red-50 border-red-200 text-red-900'
                : form.dpiaRequired === 'optional'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="space-y-0.5">
                <p className="font-bold">
                  {form.dpiaRequired === 'required' 
                    ? '⚠️ LEGALLY REQUIRED: DPIA is Mandatory' 
                    : form.dpiaRequired === 'optional' 
                    ? '💡 OPTIONAL: Single Criteria Matched' 
                    : '✓ DPIA is Not Legally Indicated'}
                </p>
                <p className="text-[10px] text-slate-500">
                  Matched criteria count: {form.criteriaMatched.length} of 12 (Minimum 2 required under Polish law).
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase font-bold bg-white px-2 py-1 rounded shadow-xs">
                {form.dpiaRequired === 'required' ? 'High Risk' : 'Low/Med Risk'}
              </span>
            </div>
          </div>
        )}

        {/* STEP 6: SUMMARY REVIEW */}
        {wizardStep === 6 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">6. Compliance Summary & Submit</h3>
            
            <div className="bg-slate-50 border border-slate-200 rounded p-4 text-xs font-mono text-slate-700 space-y-3">
              <div className="flex justify-between border-b border-slate-150 pb-1.5">
                <span>ROPA Record Name:</span>
                <span className="font-bold text-slate-900">{form.name || 'Untitled Activity'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1.5">
                <span>Regulatory Role:</span>
                <span className="capitalize font-bold text-slate-900">{form.role}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1.5">
                <span>Article 6 Basis:</span>
                <span className="text-slate-900">{form.lawfulBasis}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1.5">
                <span>DPIA Legally Indicated:</span>
                <span className={form.dpiaRequired === 'required' ? 'text-red-600 font-bold' : 'text-slate-900'}>
                  {form.dpiaRequired.toUpperCase()} ({form.criteriaMatched.length} triggers)
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1.5">
                <span>Data Subjects:</span>
                <span>{form.dataSubjects.length} groups checked</span>
              </div>
              <div className="flex justify-between">
                <span>Security Measures (TOMs):</span>
                <span>{form.securityMeasures.length} rules checked</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Initial record status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs"
              >
                <option value="draft">Draft / Szkic</option>
                <option value="in_review">Send for DPO / Legal review (W toku)</option>
              </select>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex justify-between pt-4 border-t border-slate-100">
          {wizardStep > 1 ? (
            <button
              type="button"
              onClick={() => setWizardStep(wizardStep - 1)}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-800 rounded cursor-pointer"
            >
              Previous
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigateTo('#/app/activities')}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-800 rounded cursor-pointer"
            >
              Cancel
            </button>
          )}

          {wizardStep < 6 ? (
            <button
              type="button"
              onClick={() => setWizardStep(wizardStep + 1)}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded cursor-pointer"
            >
              Next Step
            </button>
          ) : (
            <button
              type="submit"
              className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              Compile & Save ROPA <ComplianceIcon name="ChevronRight" size={14} />
            </button>
          )}
        </div>

      </form>
    </div>
  );
};

// ----------------------------------------------------
// ACTIVITY DETAILED VIEW (TABS PANEL)
// ----------------------------------------------------
export const ActivityDetailView: React.FC<{ id: string }> = ({ id }) => {
  const { activities, currentLanguage, navigateTo, updateActivity } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'art30' | 'lawful' | 'vendors' | 'security' | 'dpia'>('overview');

  const act = activities.find((a) => a.id === id);

  if (!act) {
    return (
      <div className="p-8 text-center border border-slate-200 rounded-lg bg-white space-y-4">
        <ComplianceIcon name="AlertTriangle" className="text-red-500 mx-auto" size={32} />
        <h2 className="text-sm font-bold text-slate-900">Activity Not Found</h2>
        <button onClick={() => navigateTo('#/app/activities')} className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-bold cursor-pointer">Return</button>
      </div>
    );
  }

  const handleStatusChange = (status: any) => {
    updateActivity({ ...act, status });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button onClick={() => navigateTo('#/app/activities')} className="text-slate-400 hover:text-slate-900 cursor-pointer">
              <ComplianceIcon name="ArrowLeft" size={16} />
            </button>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 rounded uppercase font-bold">{act.id}</span>
            <span className="text-xs text-slate-400 font-medium">/ ROPA Workspace</span>
          </div>
          <h1 className="text-lg font-bold text-slate-950">{act.name}</h1>
          <p className="text-[11px] text-slate-400">Owner: <strong>{act.ownerName}</strong> — Last updated by {act.lastModifiedBy} at {new Date(act.lastModifiedAt).toLocaleString()}</p>
        </div>
        
        {/* Status controls */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-bold uppercase">{currentLanguage === 'pl' ? 'Zmień Status:' : 'Set Status:'}</span>
          <select
            value={act.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-bold rounded px-2 py-1 cursor-pointer"
          >
            <option value="draft">Szkic / Draft</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="action_required">Action Required</option>
          </select>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
        {[
          { id: 'overview', pl: 'Podsumowanie', en: 'Overview' },
          { id: 'art30', pl: 'Art. 30 RODO', en: 'Article 30 Fields' },
          { id: 'lawful', pl: 'Podstawa Prawna', en: 'Lawful Basis' },
          { id: 'vendors', pl: 'Odbiorcy i Dostawcy', en: 'Vendors & Transfers' },
          { id: 'security', pl: 'Środki Bezpieczeństwa', en: 'Retention & Security' },
          { id: 'dpia', pl: 'Analiza DPIA', en: 'DPIA Threshold' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-950 hover:border-slate-300'
            }`}
          >
            {currentLanguage === 'pl' ? t.pl : t.en}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Description & Context</h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-100">{act.description || 'No detailed descriptive log recorded.'}</p>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-slate-400 font-medium">Department</p>
                <p className="font-bold text-slate-800">{act.department}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 font-medium">Primary Application/System</p>
                <p className="font-mono font-bold text-slate-800">{act.systemUsed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completeness Meter</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500 flex items-center justify-center font-bold text-sm text-slate-800">
                  {act.completenessScore}%
                </div>
                <div className="text-xs">
                  <p className="font-bold">Record Completeness</p>
                  <p className="text-slate-400">All audit fields mapped properly.</p>
                </div>
              </div>
            </div>
            
            {act.dpiaRequired === 'required' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs mt-4">
                <p className="font-bold text-red-900 flex items-center gap-1">⚠️ DPIA Required</p>
                <p className="text-red-700 mt-1">High risk processing elements identified. Initiate DPIA Screening.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ARTICLE 30 COLUMNS */}
      {activeTab === 'art30' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Official Article 30 Disclosure Fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-slate-700">
            <div className="p-3 border border-slate-100 bg-slate-50 rounded">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">Controller / ADO Identity</span>
              <p className="font-bold text-slate-900">ABC Logistics Poland Sp. z o.o.</p>
              <p className="text-slate-400 mt-1">NIP: PL5252839201 — ul. Towarowa 22, Warsaw</p>
            </div>
            <div className="p-3 border border-slate-100 bg-slate-50 rounded">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">DPO / IOD Contact</span>
              <p className="font-bold text-slate-900">Janusz Nowak</p>
              <p className="text-slate-400 mt-1">dpo@abclogistics.pl</p>
            </div>
            <div className="p-3 border border-slate-100 bg-slate-50 rounded">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">Data Subjects Scope (Art. 30(1)(c))</span>
              <p className="text-slate-900">{act.dataSubjects.join(', ')}</p>
            </div>
            <div className="p-3 border border-slate-100 bg-slate-50 rounded">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">Data Categories Scope (Art. 30(1)(c))</span>
              <p className="text-slate-900">{act.dataCategories.join(', ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LAWFUL BASIS */}
      {activeTab === 'lawful' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lawful Foundations & Conditions</h3>
          <div className="space-y-4 text-xs">
            <div className="p-4 border-l-4 border-blue-600 bg-blue-50/50 rounded-r">
              <h4 className="font-bold text-blue-900">Primary Foundation — Article 6(1)</h4>
              <p className="text-slate-700 mt-1">{act.lawfulBasis}</p>
            </div>

            {act.specialCategoryCondition && (
              <div className="p-4 border-l-4 border-amber-500 bg-amber-50/50 rounded-r">
                <h4 className="font-bold text-amber-900">Sensitive Category Foundation — Article 9(2)</h4>
                <p className="text-slate-700 mt-1">{act.specialCategoryCondition}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VENDORS & TRANSFERS */}
      {activeTab === 'vendors' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Linked Processors & International Transfers (Chapter V)</h3>
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border border-slate-150 rounded">
                <h4 className="font-bold text-slate-800 mb-2">Processors & Vendors</h4>
                {act.vendors.length === 0 ? (
                  <p className="text-slate-400 italic">No external processors linked to this processing.</p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 font-medium">
                    {act.vendors.map((v, i) => (
                      <li key={i}>{v} (DPA: Signed)</li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="p-3 border border-slate-150 rounded">
                <h4 className="font-bold text-slate-800 mb-2">International Data Transfers</h4>
                {act.transfers ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Non-EEA Transfers Active</span>
                    <p className="text-[11px] text-slate-500 mt-1">SCC (Standard Contractual Clauses) mapped under Art. 46(2)(c).</p>
                  </div>
                ) : (
                  <p className="text-emerald-700 font-semibold">✓ Sovereign EU/EEA-only processing. No external transfers.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RETENTION & SECURITY */}
      {activeTab === 'security' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Technical & Organizational Safeguards (Art. 32)</h3>
          <div className="space-y-4 text-xs">
            <div className="p-3 border border-slate-100 bg-slate-50 rounded">
              <p className="font-bold text-slate-800">Retention Limit</p>
              <p className="text-slate-900 mt-1 font-mono font-bold">{act.retentionPeriod}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Basis: {act.retentionBasis}</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-800">Active Security Controls (TOMs)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {act.securityMeasures.map((measure, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 border border-slate-100 rounded text-slate-600">
                    <ComplianceIcon name="Check" className="text-emerald-500 shrink-0" size={14} />
                    <span>{measure}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DPIA SCREENING */}
      {activeTab === 'dpia' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Polish DPIA Criteria Screening</h3>
          <div className="space-y-3 text-xs text-slate-600">
            <div className={`p-4 rounded-lg border flex justify-between items-center ${
              act.dpiaRequired === 'required'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="space-y-0.5">
                <p className="font-bold">{act.dpiaRequired === 'required' ? 'DPIA Triggered' : 'No DPIA Triggers Identified'}</p>
                <p className="text-[10px] text-slate-500">Based on core high-risk criteria evaluation.</p>
              </div>
              {act.dpiaRequired === 'required' && (
                <button
                  onClick={() => navigateTo('#/app/dpia')}
                  className="px-3 py-1.5 bg-red-600 text-white rounded font-bold uppercase tracking-wider text-[10px]"
                >
                  Configure DPIA Risk Analysis
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
