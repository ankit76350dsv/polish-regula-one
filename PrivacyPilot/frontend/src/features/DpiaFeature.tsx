/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  FileCheck,
  CheckCircle,
  HelpCircle,
  Info,
  Layers,
  ArrowRight,
  UserCheck,
  Zap,
} from 'lucide-react';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';

interface DpiaFeatureProps {
  id: string;
  activitiesCount: number;
}

export const DpiaFeature: React.FC<DpiaFeatureProps> = ({ id, activitiesCount }) => {
  // Configurable switches to test DPIA Triggers dynamically
  const [triggers, setTriggers] = useState({
    healthData: true,
    biometrics: true,
    largeScaleMonitoring: false,
    childrenData: false,
    automatedProfiling: false,
  });

  const [activeTab, setActiveTab] = useState<'triggers' | 'controls' | 'authority'>('triggers');

  const handleToggle = (key: keyof typeof triggers) => {
    setTriggers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Determine standard triggers count
  const activeTriggersCount = Object.values(triggers).filter(Boolean).length;
  const isDpiarNeeded = activeTriggersCount >= 1;
  const threatSeverity = activeTriggersCount >= 3 ? 'Critical' : activeTriggersCount >= 1 ? 'High' : 'Low';

  return (
    <div id={id} className="space-y-6">
      {/* Smart DPIA Shield banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-md p-4.5 border border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 animate-fade-in">
        <div className="space-y-1 flex-1">
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-extrabold uppercase rounded-md border border-indigo-500/25 px-2 py-0.5 tracking-wider inline-flex items-center gap-1">
            <Zap className="h-2.5 w-2.5 animate-pulse" /> Auto DPIA Detection Engine
          </span>
          <h2 className="text-lg font-bold tracking-tight text-white leading-tight">
            Article 35 High-Risk Flagging Radar
          </h2>
          <p className="text-xs text-slate-400 max-w-xl leading-normal">
            PrivacyPilot analyzes database taxonomies dynamically against criteria established under Article 35. Select compliance variables below to audit your risk.
          </p>
        </div>

        <div className="p-3 bg-slate-955/65 border border-slate-800/80 rounded-md text-center min-w-[130px] flex-shrink-0">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">
            DPIA STATUS
          </span>
          <span className={`text-xs font-black mt-1 block uppercase tracking-wide ${isDpiarNeeded ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`}>
            {isDpiarNeeded ? '⚠ DPIA REQUIRED' : 'COMPLIANT'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Interactive Switches Panel (lg:col-span-7) */}
        <div className="col-span-1 lg:col-span-7 space-y-4">
          <AppCard
            id="dpi-switches-card"
            title="Active ROPA Registry Triggers"
            subtitle="Simulate and test Article 35 triggers inside your organization"
          >
            <div className="space-y-3.5">
              {[
                {
                  key: 'healthData' as const,
                  label: 'Special Category: Health and Physical Well-being Data (Art 9)',
                  desc: 'Includes wellness records, medical insurance benefits, clinical assessments, or biometric markers.',
                },
                {
                  key: 'biometrics' as const,
                  label: 'Special Category: Biometric recognition databases',
                  desc: 'Face-ID terminals, fingerprint logs, voice scans used for individual authentication.',
                },
                {
                  key: 'largeScaleMonitoring' as const,
                  label: 'Large Scale Public Space Surveillance & Monitoring',
                  desc: 'CCTV streams covering warehouses, office entries, localized vehicle tracks.',
                },
                {
                  key: 'childrenData' as const,
                  label: 'Vulnerable Subjects: Personal data relating to Children',
                  desc: 'Handling credentials of users under legal compliance target age (Art 8).',
                },
                {
                  key: 'automatedProfiling' as const,
                  label: 'Automated Decision Making and Profiling',
                  desc: 'Applying systemic artificial intelligence loops to catalog or filter candidate CVs.',
                },
              ].map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleToggle(item.key)}
                  className={`p-3 border rounded-md cursor-pointer transition-all flex items-start justify-between gap-4 ${
                    triggers[item.key]
                      ? 'bg-rose-50/15 border-rose-500/50 shadow-2xs'
                      : 'bg-transparent border-slate-200 dark:border-slate-850 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <h5 className={`text-xs font-bold leading-normal ${triggers[item.key] ? 'text-rose-955 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>
                      {item.label}
                    </h5>
                    <p className="text-[11px] text-slate-550 leading-normal">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      checked={triggers[item.key]}
                      onChange={() => {}}
                      className="h-3.5 w-3.5 rounded-xs text-rose-500 focus:ring-0 cursor-pointer pointer-events-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </AppCard>
        </div>

        {/* Right Smart Advice & Checklists (lg:col-span-5) */}
        <div className="col-span-1 lg:col-span-5 space-y-4">
          {/* Severity Widget */}
          <AppCard id="dpia-severity-status" title="DPIA Detection Verdict">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-md ${isDpiarNeeded ? 'bg-amber-100/60 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400' : 'bg-emerald-100/60 dark:bg-emerald-955/40 text-emerald-600 dark:text-emerald-400'}`}>
                  <AlertTriangle className="h-5 w-5 stroke-2" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {isDpiarNeeded
                      ? `Risk Status: ${threatSeverity} Severity Warning`
                      : 'Risk Status: Low / Negligible'}
                  </h4>
                  <p className="text-[11.5px] text-slate-550 mt-0.5 leading-none">
                    {isDpiarNeeded
                      ? `${activeTriggersCount} critical triggers currently flagged.`
                      : 'No sensitive data categories flagged. Standard compliance controls apply.'}
                  </p>
                </div>
              </div>

              {isDpiarNeeded ? (
                <div className="p-3.5 bg-orange-50/60 dark:bg-amber-950/20 border border-orange-200/50 dark:border-amber-900/40 rounded-md space-y-2">
                  <span className="text-[9.5px] font-extrabold text-amber-600 uppercase tracking-widest block">
                    ⚠ RECOMMENDED ACTIONS
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-655 dark:text-slate-350 select-none">
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>Execute a formalized Data Protection Impact Assessment (Art. 35 GDPR).</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>Nominate or consult with a qualified Data Protection Officer (DPO).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>Implement immediate Salted-Hash pseudonymization layers on target tables.</span>
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-900/40 rounded-xl">
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                    ✓ SAFE FOR DEPLOYMENT
                  </span>
                  <p className="text-xs text-slate-550 leading-relaxed">
                    General compliance is safe under Article 30 standards. Maintain active ROPA logging and standard data minimization strategies.
                  </p>
                </div>
              )}
            </div>
          </AppCard>

          {/* Compliance Guidance Tab controls */}
          <AppCard id="dpi-guidance-card" title="GDPR Art 35 Controls Matrix">
            <div className="space-y-4">
              <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs">
                {(['triggers', 'controls'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`pb-2 px-3 font-bold cursor-pointer transition-all ${
                      activeTab === tab
                        ? 'border-b-2 border-indigo-500 text-indigo-500'
                        : 'text-slate-400 hover:text-slate-202'
                    }`}
                  >
                    {tab === 'triggers' ? 'Decision Criteria' : 'Required Steps'}
                  </button>
                ))}
              </div>

              {activeTab === 'triggers' ? (
                <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                  <p className="font-semibold text-slate-700 dark:text-slate-250">
                    A DPIA is legally mandatory if processing leads to:
                  </p>
                  <ul className="list-disc pl-4 space-y-1.5 list-outside">
                    <li>Systematic and extensive evaluation of personal aspects (profiling).</li>
                    <li>Processing special categories of sensitive data on a large scale.</li>
                    <li>Systematic monitoring of a publicly accessible area on a large scale.</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-3.5 text-xs text-slate-650 dark:text-slate-350 leading-relaxed">
                  <p className="font-semibold text-slate-705 dark:text-slate-250">
                    Minimum standard assessment attributes:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Systematic description of operations.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Proportionality & necessity evaluation.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Mitigations for identified risks.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AppCard>
        </div>
      </div>
    </div>
  );
};
