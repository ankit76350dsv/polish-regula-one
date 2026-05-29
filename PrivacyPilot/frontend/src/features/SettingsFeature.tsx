/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Building2,
  ShieldCheck,
  Clock,
  Link,
  Palette,
  BellRing,
  Save,
  CheckCircle,
  Info,
} from 'lucide-react';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppDropdown } from '../components/AppDropdown';

interface SettingsFeatureProps {
  id: string;
  activeCompanyName: string;
  onUpdateCompanyName: (name: string) => void;
}

type TabKey = 'company' | 'gdpr' | 'retention' | 'integrations' | 'branding' | 'notifications';

export const SettingsFeature: React.FC<SettingsFeatureProps> = ({
  id,
  activeCompanyName,
  onUpdateCompanyName,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('company');
  const [showToast, setShowToast] = useState(false);

  // Form states
  const [coName, setCoName] = useState(activeCompanyName);
  const [coAddress, setCoAddress] = useState('Aleje Jerozolimskie 12, Varsovia, Poland');
  const [coReg, setCoReg] = useState('KRS 0000921402 / NIP 5240019241');

  // GDPR state
  const [dpoName, setDpoName] = useState('Liam Sterling, Esq.');
  const [dpoEmail, setDpoEmail] = useState('dpo@privacy-pilot.io');
  const [superAuthority, setSuperAuthority] = useState('PUODO (UODO Poland)');

  // Retention Rules
  const [financeRetention, setFinanceRetention] = useState('5 Years');
  const [hrRetention, setHrRetention] = useState('10 Years');
  const [logsRetention, setLogsRetention] = useState('1 Year');

  // Integrations state
  const [syncRegula, setSyncRegula] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(true);

  // Notification triggers
  const [notifyExpiries, setNotifyExpiries] = useState(true);
  const [notifyDPIAs, setNotifyDPIAs] = useState(true);

  const tabs = [
    { key: 'company' as const, label: 'Company Info', icon: Building2 },
    { key: 'gdpr' as const, label: 'GDPR Settings', icon: ShieldCheck },
    { key: 'retention' as const, label: 'Retention Rules', icon: Clock },
    { key: 'integrations' as const, label: 'Integrations', icon: Link },
    { key: 'branding' as const, label: 'Branding', icon: Palette },
    { key: 'notifications' as const, label: 'Notifications', icon: BellRing },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'company') {
      onUpdateCompanyName(coName);
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2400);
  };

  return (
    <div id={id} className="space-y-6">
      {/* Toast Alert Popups */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-white px-5 py-3.5 rounded-xl shadow-lg text-xs font-bold animate-bounce flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          ✓ Compliance settings successfully updated and replicated!
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col md:flex-row min-h-[500px]">
        {/* Left Side Navigation Tabs */}
        <div className="w-full md:w-64 bg-slate-50/70 dark:bg-slate-950/20 border-r border-slate-200/80 dark:border-slate-805 p-4 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2.5 px-3.5 py-3 rounded-lg text-xs font-bold leading-normal select-none transition-all cursor-pointer whitespace-nowrap min-w-[140px] md:min-w-0 ${
                  isSelected
                    ? 'bg-indigo-600/10 text-indigo-405 border-l-[3px] border-indigo-550 font-black'
                    : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Active Tab Settings Pane */}
        <div className="flex-1 p-6">
          <form onSubmit={handleSave} className="space-y-6 h-full flex flex-col justify-between">
            <div>
              {/* TAB 1: Company Info */}
              {activeTab === 'company' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                    <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200">
                      Company Legal Coordinates
                    </h3>
                    <p className="text-xs text-slate-450 mt-1">
                      Provide formal organizational metadata logged on ROPA PDF documents headers.
                    </p>
                  </div>

                  <AppTextField
                    id="set-co-name"
                    label="Formal Corporate Name / Entity Name"
                    value={coName}
                    onChange={(e) => setCoName(e.target.value)}
                    required
                  />

                  <AppTextField
                    id="set-co-reg"
                    label="Registry Identifier / KRS / VAT ID"
                    value={coReg}
                    onChange={(e) => setCoReg(e.target.value)}
                    placeholder="e.g. VAT EU-120392 / National Register No."
                  />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-750 dark:text-slate-300">
                      Company Headquarters Postal coordinates
                    </label>
                    <textarea
                      id="set-co-address"
                      rows={3}
                      className="w-full text-sm rounded-lg border border-slate-205 dark:border-slate-800 p-3 outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-slate-900 text-slate-800 dark:text-slate-150"
                      value={coAddress}
                      onChange={(e) => setCoAddress(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: GDPR Settings */}
              {activeTab === 'gdpr' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                    <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200">
                      GDPR Compliance Officers Assignments
                    </h3>
                    <p className="text-xs text-slate-450 mt-1">
                      Identify lead supervising DPA authorities and assigned officers signatures.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AppTextField
                      id="set-dpo-name"
                      label="Data Protection Officer (DPO)"
                      value={dpoName}
                      onChange={(e) => setDpoName(e.target.value)}
                    />

                    <AppTextField
                      id="set-dpo-email"
                      label="DPO Contacts Endpoint"
                      type="email"
                      value={dpoEmail}
                      onChange={(e) => setDpoEmail(e.target.value)}
                    />
                  </div>

                  <AppDropdown
                    id="set-dpo-authority"
                    label="Lead Supervising Member State Authority"
                    items={[
                      { value: 'PUODO (UODO Poland)', label: 'PUODO - Urząd Ochrony Danych Osobowych (Poland)' },
                      { value: 'BfDI (Germany)', label: 'BfDI - Bundesbeauftragte für den Datenschutz (Germany)' },
                      { value: 'CNIL (France)', label: 'CNIL - Commission Nationale de l\'Informatique (France)' },
                      { value: 'DPC (Ireland)', label: 'DPC - Data Protection Commission (Ireland)' },
                    ]}
                    value={superAuthority}
                    onChange={(e) => setSuperAuthority(e.target.value)}
                  />
                </div>
              )}

              {/* TAB 3: Retention Rules */}
              {activeTab === 'retention' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                    <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-205">
                      Storage Limitation Threshold Rules (Art. 5(1)(e))
                    </h3>
                    <p className="text-xs text-slate-450 mt-1">
                      Define automated corporate retention timers. System activities outside limits will flag warnings.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <AppDropdown
                      id="set-ret-finance"
                      label="Financial & Payments records"
                      items={[
                        { value: '3 Years', label: '3 Years' },
                        { value: '5 Years', label: '5 Years (Standard Tax rule)' },
                        { value: '10 Years', label: '10 Years' },
                      ]}
                      value={financeRetention}
                      onChange={(e) => setFinanceRetention(e.target.value)}
                    />

                    <AppDropdown
                      id="set-ret-hr"
                      label="Human Wellness / HR medical data"
                      items={[
                        { value: '5 Years', label: '5 Years' },
                        { value: '10 Years', label: '10 Years (Polish standard)' },
                        { value: '50 Years', label: '50 Years (Retirement logs)' },
                      ]}
                      value={hrRetention}
                      onChange={(e) => setHrRetention(e.target.value)}
                    />

                    <AppDropdown
                      id="set-ret-logs"
                      label="System activity tracks / Logs"
                      items={[
                        { value: '6 Months', label: '6 Months' },
                        { value: '1 Year', label: '1 Year' },
                        { value: '2 Years', label: '2 Years' },
                      ]}
                      value={logsRetention}
                      onChange={(e) => setLogsRetention(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: Integrations */}
              {activeTab === 'integrations' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                    <h3 className="text-sm font-extrabold text-slate-855 dark:text-slate-205">
                      RegulaOne SuperApp Core Bindings
                    </h3>
                    <p className="text-xs text-slate-450 mt-1">
                      Toggle communication layers linking PrivacyPilot to external enterprise networks.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="pr-4">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-250">
                          Automated RegulaOne Database Sync
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          Continuously index database tables to identify new columns mappings and automatically calculate DPIA triggers.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={syncRegula}
                        onChange={(e) => setSyncRegula(e.target.checked)}
                        className="rounded-sm text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="pr-4">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-250">
                          Dispatched Webhooks for Slack Core alerts
                        </h4>
                        <p className="text-[11px] text-slate-505 mt-0.5 leading-snug">
                          Transmit instantaneous warnings on `#compliance-warnings` channels on high-risk Art 9 modifications.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={slackAlerts}
                        onChange={(e) => setSlackAlerts(e.target.checked)}
                        className="rounded-sm text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Branding */}
              {activeTab === 'branding' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                    <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200">
                      Branding & Console Presets
                    </h3>
                    <p className="text-xs text-slate-450 mt-1">
                      Choose custom design styles, headers, and UI parameters for exported documents.
                    </p>
                  </div>

                  <div className="p-3.5 bg-indigo-50/10 dark:bg-indigo-950/20 border border-indigo-200/40 rounded-xl flex gap-3 text-xs text-indigo-850 dark:text-indigo-400">
                    <Info className="h-4.5 w-4.5 text-indigo-505 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>RegulaOne Standard Layout Active:</strong> Visual design settings are unified under the Legal-Tech Slate Indigo color scheme. PDF statement headers carry the standard company logo asset.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: Notifications */}
              {activeTab === 'notifications' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                    <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200">
                      E-Mail Alert Subscriptions Rules
                    </h3>
                    <p className="text-xs text-slate-450 mt-1">
                      Determine when the RODO engine dispatches corporate warnings to administrators mailboxes.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3.5 border border-slate-201 dark:border-slate-800 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyExpiries}
                        onChange={(e) => setNotifyExpiries(e.target.checked)}
                        className="mt-0.5 rounded-sm text-indigo-650"
                      />
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-250">
                          Data Expiry Warnings emails
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Dispatch warnings 30 days prior to standard ROPA storage retention checks expiration.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3.5 border border-slate-201 dark:border-slate-800 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyDPIAs}
                        onChange={(e) => setNotifyDPIAs(e.target.checked)}
                        className="mt-0.5 rounded-sm text-indigo-650"
                      />
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-250">
                          DPIA High-Risk scan notification
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Notify DPO immediately if a newly mapped registry includes biometric, medical, or surveillance variables.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Form Action Buttons */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 flex justify-end gap-3">
              <AppButton id="btn-save-settings" type="submit" variant="primary" size="sm" className="cursor-pointer">
                <Save className="h-4 w-4 mr-1.5" /> Save Configuration
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
