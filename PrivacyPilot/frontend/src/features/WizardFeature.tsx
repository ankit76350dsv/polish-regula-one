/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  FileText,
  Info,
} from 'lucide-react';
import { AppStepper } from '../components/AppStepper';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppDropdown } from '../components/AppDropdown';
import { ProcessingActivity, LegalBasis, GDPRWizardState } from '../types';

interface WizardFeatureProps {
  id: string;
  onCancel: () => void;
  onSubmit: (data: Partial<ProcessingActivity>) => void;
  editingActivity?: ProcessingActivity | null;
}

const WIZARD_STEPS = [
  'General Info',
  'Data Categories',
  'Legal Basis',
  'Data Subjects',
  'Processors',
  'Retention Period',
  'Security Measures',
  'Intl Transfers',
  'Risk Assessment',
  'Review & Submit',
];

export const WizardFeature: React.FC<WizardFeatureProps> = ({
  id,
  onCancel,
  onSubmit,
  editingActivity,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Initial State from editing or localStorage
  const [formData, setFormData] = useState<GDPRWizardState>({
    name: '',
    purpose: '',
    department: 'Sales & Finance',
    dataCategory: [],
    legalBasis: 'Consent (Art. 6(1)(a))',
    dataSubjects: [],
    processors: [],
    retentionPeriod: '5 Years',
    securityMeasures: [],
    internationalTransfers: 'None (EU storage only)',
    riskScore: 'Low',
    status: 'Draft',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingActivity) {
      setFormData({
        name: editingActivity.name,
        purpose: editingActivity.purpose,
        department: editingActivity.department,
        dataCategory: editingActivity.dataCategory,
        legalBasis: editingActivity.legalBasis,
        dataSubjects: editingActivity.dataSubjects,
        processors: editingActivity.processors,
        retentionPeriod: editingActivity.retentionPeriod,
        securityMeasures: editingActivity.securityMeasures,
        internationalTransfers: editingActivity.internationalTransfers,
        riskScore: editingActivity.riskScore,
        status: editingActivity.status === 'Active' ? 'Active' : 'Draft',
      });
    }
  }, [editingActivity]);

  // Handle alerts triggered as toast
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2400);
  };

  // Helper arrays for multiple-choice steps
  const DATA_CATEGORIES_PRESETS = [
    { label: 'Contact Details', desc: 'Email, address, phone numbers' },
    { label: 'Financial Data', desc: 'Bank account, credit cards, billing status' },
    { label: 'Purchase History', desc: 'Transactional log data and customer metrics' },
    { label: 'IP Address', desc: 'Web request coordinates, location markers' },
    { label: 'Biometric Data', desc: 'Face recognition, fingerprints (Art 9 Specific Category)', sensitive: true },
    { label: 'Health Data', desc: 'Wellness registers, physical diagnostics (Art 9 Sensitive)', sensitive: true },
    { label: 'Location Tracking', desc: 'Realtime telemetry maps', sensitive: true },
    { label: 'Children Personal Data', desc: 'Coordinates relating to minors under 16yo', sensitive: true },
  ];

  const DATA_SUBJECTS_PRESETS = ['Customers', 'Employees', 'Contractors', 'Prospects', 'Shareholders'];
  const PROCESSORS_PRESETS = ['AWS Ireland', 'Stripe Inc.', 'Mailchimp Corp', 'Google Cloud (Frankfurt)', 'On-Premises'];
  const SECURITY_PRESETS = ['AES-256 Storage Encryption', 'TLS 1.3 in Transit', 'MFA Access Verification', 'Dedicated Database Sandbox', 'Periodic Penetration Audits'];

  // Validations per step
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.name.trim()) newErrors.name = 'ROPA registry title is required';
      if (!formData.purpose.trim() || formData.purpose.trim().length < 15) {
        newErrors.purpose = 'Processing purpose description must have at least 15 characters';
      }
    }
    if (step === 1) {
      if (formData.dataCategory.length === 0) {
        newErrors.dataCategory = 'You must select at least one core taxonomy categories classification';
      }
    }
    if (step === 3) {
      if (formData.dataSubjects.length === 0) {
        newErrors.dataSubjects = 'Choose at least one target individual category (data subject)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < WIZARD_STEPS.length - 1) {
        setCurrentStep((c) => c + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((c) => c - 1);
    }
  };

  const handleSaveDraft = () => {
    const draftKey = editingActivity ? `draft_edit_${editingActivity.id}` : 'draft_new_activity';
    localStorage.setItem(draftKey, JSON.stringify(formData));
    triggerToast('✓ Progress successfully Persisted securely as Local Draft');
  };

  // Automated DPIA Trigger Scanner based on selection
  const isDPIAFlagged = formData.dataCategory.some((cat) => {
    const item = DATA_CATEGORIES_PRESETS.find((p) => p.label === cat);
    return item?.sensitive;
  });

  // Calculate risk level dynamically
  const calculatedRisk = isDPIAFlagged ? 'High' : formData.dataCategory.length > 2 ? 'Medium' : 'Low';

  const handleToggleCategory = (label: string) => {
    setFormData((prev) => {
      const isSelected = prev.dataCategory.includes(label);
      const updated = isSelected ? prev.dataCategory.filter((x) => x !== label) : [...prev.dataCategory, label];

      // Auto update risk index
      const localFlag = updated.some((cat) => {
        const item = DATA_CATEGORIES_PRESETS.find((p) => p.label === cat);
        return item?.sensitive;
      });

      return {
        ...prev,
        dataCategory: updated,
        riskScore: localFlag ? 'High' : updated.length > 2 ? 'Medium' : 'Low',
      };
    });
  };

  const handleSubmitFinal = () => {
    onSubmit({
      ...formData,
      dpiaRequired: isDPIAFlagged,
      riskScore: calculatedRisk as any,
    });
  };

  return (
    <div id={id} className="space-y-6">
      {/* Toast Alert popups */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-white px-5 py-3.5 rounded-xl shadow-lg text-xs font-bold animate-bounce flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          {toastMsg}
        </div>
      )}

      {/* Stepper Wizard Top panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 shadow-xs">
        <AppStepper
          id="registration-stepper"
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={(idx) => {
            // Allow clicking previous completed steps
            if (idx <= currentStep || validateStep(currentStep)) {
              setCurrentStep(idx);
            }
          }}
        />
      </div>

      {/* Main form container with steps rendering */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-xs">
        {/* Step Header */}
        <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-950/20 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2.2 py-0.5 rounded-sm">
              STEP {currentStep + 1} OF 10
            </span>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              {WIZARD_STEPS[currentStep]}
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <AppButton id="btn-save-draft" variant="ghost" size="sm" onClick={handleSaveDraft}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save Draft
            </AppButton>
          </div>
        </div>

        {/* Dynamic Forms Switcher */}
        <div className="p-6">
          {/* STEP 1: General Info */}
          {currentStep === 0 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="p-3.5 bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-200/30 rounded-lg flex gap-3 text-xs text-indigo-850 dark:text-indigo-300">
                <Info className="h-4.5 w-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold mb-0.5">Article 30 Documentation Duty</h4>
                  <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                    GDPR Article 30 (Article 30 GDPR) requires companies to maintain a record of processing activities (ROPA) under their responsibility. Provide precise internal descriptive metadata.
                  </p>
                </div>
              </div>

              <AppTextField
                id="wizard-act-name"
                label="Process Name / Title of registry"
                placeholder="e.g. Employee Healthcare Reimbursement Processing"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={errors.name}
                helperText="Provide a clear, human-readable name describing why the personal data is being analyzed."
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                  Detailed Purpose of Processing Data
                </label>
                <textarea
                  id="wizard-act-purpose"
                  rows={4}
                  className="w-full text-sm rounded-lg border border-slate-205 dark:border-slate-800 p-3 outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. Verifying physical checkouts, running secondary medical insurance subsidies allocations and legal tracking for employees..."
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
                {errors.purpose && <span className="text-xs text-red-500 font-bold">{errors.purpose}</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AppDropdown
                  id="wizard-department"
                  label="Assigned Business Unit / Department"
                  items={[
                    { value: 'Sales & Finance', label: 'Sales & Finance' },
                    { value: 'Human Resources', label: 'Human Resources' },
                    { value: 'Corporate Security', label: 'Corporate Security' },
                    { value: 'Marketing', label: 'Marketing' },
                    { value: 'Talent Acquisition', label: 'Talent Acquisition' },
                    { value: 'Engineering Operations', label: 'Engineering Operations' },
                  ]}
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />

                <AppDropdown
                  id="wizard-status"
                  label="Registry Starting Status"
                  items={[
                    { value: 'Draft', label: 'Draft' },
                    { value: 'Active', label: 'Active Compliance Registry' },
                  ]}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Data Categories */}
          {currentStep === 1 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Personal Data Taxonomies Classification
                </h4>
                <p className="text-xs text-slate-450 mt-1 leading-normal">
                  Mark all kinds of data variables you collect or store. High-risk, sensitive, or Article 9 categorizations will automatically flag security alerts.
                </p>
              </div>

              {errors.dataCategory && (
                <div className="p-3 bg-red-950/20 border border-red-900/40 text-red-400 text-xs rounded-lg font-bold">
                  {errors.dataCategory}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {DATA_CATEGORIES_PRESETS.map((preset) => {
                  const isSelected = formData.dataCategory.includes(preset.label);
                  return (
                    <div
                      key={preset.label}
                      onClick={() => handleToggleCategory(preset.label)}
                      className={`p-3.5 border rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? preset.sensitive
                            ? 'bg-rose-50/20 border-rose-500/80 ring-2 ring-rose-500/5'
                            : 'bg-indigo-50/10 border-indigo-500 ring-2 ring-indigo-5000/5'
                          : 'bg-transparent border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-755'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                          {preset.label}
                        </span>
                        {preset.sensitive && (
                          <span className="text-[9px] uppercase tracking-wider bg-rose-500/10 text-rose-500 dark:text-rose-400 px-1.5 py-0.5 rounded-sm font-black">
                            Art 9 High-Risk
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                        {preset.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {isDPIAFlagged && (
                <div className="p-4 bg-amber-50/40 dark:bg-amber-950/30 border border-amber-300/40 rounded-xl flex gap-3.5 text-xs text-amber-850 dark:text-amber-400">
                  <ShieldAlert className="h-4.5 w-4.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold mb-0.5">Automated Risk Filter: DPIA Recommended</h5>
                    <p className="leading-snug">
                      Biometric, medical, children or location records trigger higher risk thresholds. PrivacyPilot has pre-flagged this activity as requiring a mandatory DPIA analysis.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Legal Basis */}
          {currentStep === 2 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Article 6 Lawful Basis of Processing
                </h4>
                <p className="text-xs text-slate-450 mt-1 leading-normal">
                  All personal data processing must have a designated legal foundation under the GDPR. Select the primary justification.
                </p>
              </div>

              <div className="space-y-2.5">
                {([
                  {
                    value: 'Consent (Art. 6(1)(a))',
                    title: 'Art. 6(1)(a) - Consent',
                    desc: 'The data subject has given clear opt-in consent for one or more specific processing operations (e.g. subscribing to newsletter).',
                  },
                  {
                    value: 'Contract (Art. 6(1)(b))',
                    title: 'Art. 6(1)(b) - Performance of Contract',
                    desc: 'Necessary to fulfill a contract with the user, or prior to entering a contractual arrangement (e.g. payment info for orders).',
                  },
                  {
                    value: 'Legal Obligation (Art. 6(1)(c))',
                    title: 'Art. 6(1)(c) - Compliance with Law',
                    desc: 'Necessary for the controller to comply with European or local Member State legislation (e.g. tax declarations / medical rules).',
                  },
                  {
                    value: 'Legitimate Interests (Art. 6(1)(f))',
                    title: 'Art. 6(1)(f) - Legitimate Interests',
                    desc: 'Processing is necessary for enterprise legitimate commercial purpose, except where overridden by individual privacy rights.',
                  },
                ] as const).map((item) => (
                  <div
                    key={item.value}
                    onClick={() => setFormData({ ...formData, legalBasis: item.value })}
                    className={`p-3.5 border rounded-xl cursor-pointer transition-all flex items-start gap-3 ${
                      formData.legalBasis === item.value
                        ? 'bg-indigo-50/10 border-indigo-500 ring-2 ring-indigo-500/5 font-extrabold'
                        : 'bg-transparent border-slate-205 dark:border-slate-800 hover:bg-slate-50/20'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={formData.legalBasis === item.value}
                      onChange={() => {}}
                      className="mt-1 text-indigo-650"
                    />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 dark:text-slate-250">
                        {item.title}
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Data Subjects */}
          {currentStep === 3 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Target Data Subjects Group
                </h4>
                <p className="text-xs text-slate-550 mt-1">
                  Identify who the individuals are whose data is being stored.
                </p>
              </div>

              {errors.dataSubjects && (
                <div className="p-3 bg-red-950/20 border border-red-900/40 text-red-400 text-xs rounded-lg font-bold">
                  {errors.dataSubjects}
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                {DATA_SUBJECTS_PRESETS.map((sj) => {
                  const isSelected = formData.dataSubjects.includes(sj);
                  return (
                    <button
                      key={sj}
                      type="button"
                      onClick={() => {
                        const updated = isSelected
                          ? formData.dataSubjects.filter((x) => x !== sj)
                          : [...formData.dataSubjects, sj];
                        setFormData({ ...formData, dataSubjects: updated });
                      }}
                      className={`px-4.5 py-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/10 border-indigo-550 text-indigo-600 dark:text-indigo-400'
                          : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {sj}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: Processors */}
          {currentStep === 4 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Subprocessors & External Vendors
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  List standard third-party services that have access to this pipeline data (compliant under Art 28).
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {PROCESSORS_PRESETS.map((pr) => {
                  const isSelected = formData.processors.includes(pr);
                  return (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => {
                        const updated = isSelected
                          ? formData.processors.filter((x) => x !== pr)
                          : [...formData.processors, pr];
                        setFormData({ ...formData, processors: updated });
                      }}
                      className={`px-4.5 py-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                          : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {pr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: Retention Period */}
          {currentStep === 5 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Data Retention Limit & Erasure rules
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  How long can this data be legally cached? Under "Storage Limitation" (Art. 5(1)(e)), records must be purged after purpose fulfillment.
                </p>
              </div>

              <AppDropdown
                id="wizard-retention"
                label="Maximum Legal Storage Duration"
                items={[
                  { value: '6 Months', label: '6 Months (Short recruitment scope)' },
                  { value: '1 Year', label: '1 Year' },
                  { value: '2 Years', label: '2 Years' },
                  { value: '3 Years', label: '3 Years' },
                  { value: '5 Years', label: '5 Years (Standard e-commerce backup)' },
                  { value: '10 Years', label: '10 Years (Corporate tax obligation)' },
                ]}
                value={formData.retentionPeriod}
                onChange={(e) => setFormData({ ...formData, retentionPeriod: e.target.value })}
              />
            </div>
          )}

          {/* STEP 7: Security Measures */}
          {currentStep === 6 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Article 32 Technical & Organizational Safety (TOMs)
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  Specify physical or software safeguard measures preventing breaches.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SECURITY_PRESETS.map((sc) => {
                  const isSelected = formData.securityMeasures.includes(sc);
                  return (
                    <div
                      key={sc}
                      onClick={() => {
                        const updated = isSelected
                          ? formData.securityMeasures.filter((x) => x !== sc)
                          : [...formData.securityMeasures, sc];
                        setFormData({ ...formData, securityMeasures: updated });
                      }}
                      className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-50/10 border-indigo-500 font-extrabold'
                          : 'bg-transparent border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {sc}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded-sm text-indigo-650"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 8: International Transfers */}
          {currentStep === 7 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  International Cross-Border Transfers Scope
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  Are records dispatched outside the EEA? Chapter V GDPR restricts transfer rules.
                </p>
              </div>

              <div className="space-y-2">
                {[
                  { value: 'None (EU storage only)', label: 'None (Data localized entirely inside European Union hosting datacenters)' },
                  { value: 'EU-US Data Privacy Framework', label: 'EU-US Transatlantic Data Privacy Framework mechanism (Art 45)' },
                  { value: 'Standard Contractual Clauses (SCCs)', label: 'Standard Contractual Clauses (SCCs) issued by EU Commission (Art 46)' },
                  { value: 'Bypassed under Binding Corporate Rules', label: 'Binding Corporate Rules authorization (BCR)' },
                ].map((item) => (
                  <div
                    key={item.value}
                    onClick={() => setFormData({ ...formData, internationalTransfers: item.value })}
                    className={`p-3.5 border rounded-xl cursor-pointer transition-all ${
                      formData.internationalTransfers === item.value
                        ? 'bg-indigo-50/10 border-indigo-500 font-extrabold'
                        : 'bg-transparent border-slate-200 dark:border-slate-800 hover:bg-slate-50/10'
                    }`}
                  >
                    <span className="text-xs text-slate-850 dark:text-slate-200 block">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 9: Risk Assessment */}
          {currentStep === 8 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Automatic Smart Risk Severity Calculator
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  PrivacyPilot calculates systemic risk levels based on Article 9 classifications, subprocessing setups, and retention length.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase text-slate-400">
                    Systemic Severity Metric
                  </span>
                  <span
                    className={`px-3 py-1 text-xs font-black rounded-lg ${
                      calculatedRisk === 'High'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : calculatedRisk === 'Medium'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-450'
                    }`}
                  >
                    {calculatedRisk} RISK LEVEL
                  </span>
                </div>

                <div className="h-px bg-slate-800" />

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-black block">
                      Art 9 Trigger
                    </span>
                    <p className="font-bold text-slate-205 mt-0.5">
                      {isDPIAFlagged ? 'Sensitive / Biometric Flagged ✓' : 'Standard identifiers'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-black block">
                      DPIA Required Scope
                    </span>
                    <p className="font-bold text-slate-205 mt-0.5">
                      {isDPIAFlagged ? '⚠ YES (High risk threshold reached)' : 'None (standard catalog)'}
                    </p>
                  </div>
                </div>

                {isDPIAFlagged && (
                  <div className="p-3 bg-rose-950/20 border border-rose-920 rounded-lg text-[11px] text-rose-350 leading-relaxed block">
                    <strong>Notice:</strong> Your data scope involves sensitive biometrics/medical taxonomy. Compliance rules dictate that a Data Protection Impact Assessment (DPIA) MUST be organized prior to rollout.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 10: Review & Submit */}
          {currentStep === 9 && (
            <div className="space-y-4 max-w-2xl animate-fade-in">
              <div className="mb-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  ROPA Record Manifest Proof-Reading
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  Ensure all parameters match legal requirements. Click "Publish Record" to index this activity inside RegulaOne.
                </p>
              </div>

              {/* ROPA proof parameters block */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-950/20 px-4 py-2.5 border-b border-slate-150 dark:border-slate-800 font-extrabold text-slate-400">
                  <span>PARAMETER</span>
                  <span className="col-span-2">DATA VALUE</span>
                </div>

                {[
                  { label: 'Registry Item Title', val: formData.name || 'Untitled Activity' },
                  { label: 'Assigned Business Unit', val: formData.department },
                  { label: 'Art 6 Legal Basis', val: formData.legalBasis },
                  { label: 'Data Taxonomies', val: formData.dataCategory.join(', ') || 'None selected' },
                  { label: 'Storage Retention Limit', val: formData.retentionPeriod },
                  { label: 'Intl Storage transfers', val: formData.internationalTransfers },
                  { label: 'DPIA Risk Watch', val: isDPIAFlagged ? '⚠ High-Risk Flagged' : 'No Risk Required' },
                ].map((item, idx) => (
                  <div key={idx} className="grid grid-cols-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 leading-relaxed">
                    <span className="font-bold text-slate-500">{item.label}</span>
                    <span className="col-span-2 text-slate-800 dark:text-slate-200 font-mono font-medium">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Next/Back Bottom Buttons Row */}
        <div className="px-6 py-4.5 bg-slate-50/70 dark:bg-slate-950/20 border-t border-slate-150 dark:border-slate-850 flex items-center justify-between">
          <AppButton id="btn-wizard-cancel" variant="ghost" size="sm" onClick={onCancel} className="cursor-pointer">
            Cancel
          </AppButton>

          <div className="flex items-center gap-2">
            <AppButton
              id="btn-wizard-back"
              variant="secondary"
              size="sm"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </AppButton>

            {currentStep < WIZARD_STEPS.length - 1 ? (
              <AppButton
                id="btn-wizard-next"
                variant="primary"
                size="sm"
                onClick={handleNext}
                className="cursor-pointer"
              >
                Next <ArrowRight className="h-4 w-4 ml-1.5" />
              </AppButton>
            ) : (
              <AppButton
                id="btn-wizard-submit"
                variant="primary"
                size="sm"
                onClick={handleSubmitFinal}
                className="cursor-pointer"
              >
                Publish Record <CheckCircle className="h-4 w-4 ml-1.5" />
              </AppButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
