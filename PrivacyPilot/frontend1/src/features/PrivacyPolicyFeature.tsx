/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSignature,
  FileDown,
  Edit2,
  FileText,
  History,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { ProcessingActivity, VersionInfo } from '../types';

interface PrivacyPolicyFeatureProps {
  id: string;
  activities: ProcessingActivity[];
}

export const PrivacyPolicyFeature: React.FC<PrivacyPolicyFeatureProps> = ({ id, activities }) => {
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [activeVersion, setActiveVersion] = useState('v2.0');

  // Multi templates choice
  const [legalTemplate, setLegalTemplate] = useState<'Standard' | 'Strict' | 'Corporate'>('Standard');

  // Trigger default selection of activities
  useEffect(() => {
    if (activities.length > 0) {
      setSelectedActivities(activities.slice(0, 3).map((a) => a.id));
    }
  }, [activities]);

  // Dynamically compile template based on checkboxes and company variables
  useEffect(() => {
    const chosen = activities.filter((a) => selectedActivities.includes(a.id));

    let markdown = `# PRIVACY POLICY STATEMENT\n`;
    markdown += `*Last Updated: 2026-05-29 | Version: ${activeVersion} | Classification: PUBLIC*\n\n`;
    markdown += `We take your data privacy with paramount priority. This Statement outlines the categories of personal data processed, legal justifications behind operations, and individual user legal liberties backing operations under the European General Data Protection Regulation (GDPR) and local Polish RODO compliance directives.\n\n`;

    markdown += `## 1. DATA PROCESSING REGISTER ENTRIES (ARTICLE 30 ROPA)\n`;
    markdown += `We maintain a rigorous registry of activities. Based on current system declarations, active pipelines mapped to core platforms are outlined below:\n\n`;

    if (chosen.length === 0) {
      markdown += `*No activities currently designated inside public statements. Select from left controls to sync.*`;
    } else {
      chosen.forEach((act, idx) => {
        markdown += `### 1.${idx + 1}. ${act.name}\n`;
        markdown += `- **Operation Purpose:** ${act.purpose}\n`;
        markdown += `- **Categories processed:** ${act.dataCategory.join(', ')}\n`;
        markdown += `- **GDPR Article 6 Legal Basis:** ${act.legalBasis}\n`;
        markdown += `- **Storage Expiry retention:** ${act.retentionPeriod}\n`;
        if (act.dpiaRequired) {
          markdown += `- **Special Category (Art 9/35):** Flagged under high-risk parameters. Safe mitigation controls active.\n`;
        }
        markdown += `\n`;
      });
    }

    markdown += `\n## 2. RECIPIENTS & INTERNATIONAL TRANSFERS\n`;
    markdown += `Data may be dispatched to external subprocessors mapped to legal bindings (Article 28 GDPR). Primary infrastructure networks engaged include:\n`;

    const subprocessors = Array.from(new Set(chosen.flatMap((a) => a.processors)));
    if (subprocessors.length > 0) {
      markdown += subprocessors.map((p) => `- **${p}** (Binding Clauses and Safe Storage Standards active)`).join('\n') + '\n\n';
    } else {
      markdown += `- Standard EU localized server instances strictly sealed internally.\n\n`;
    }

    markdown += `## 3. YOUR LEGAL RIGHTS\n`;
    markdown += `Under RODO / Chapter III GDPR regulations, you maintain absolute liberties regarding processing variables:\n`;
    markdown += `- **Art 15:** Right of Access checks.\n`;
    markdown += `- **Art 16:** Right to Rectification of metrics.\n`;
    markdown += `- **Art 17:** Right to erasure ('Right to be forgotten').\n`;
    markdown += `- **Art 21:** Absolute right to revoke Consent authorization anytime.\n\n`;

    markdown += `*For compliance inquiries, dispatches or right revocations, contact the designated lead at dpo@privacy-pilot.io.*`;

    setGeneratedText(markdown);
  }, [selectedActivities, activities, activeVersion, legalTemplate]);

  // Versions history logs
  const MOCK_VERSIONS: VersionInfo[] = [
    { version: 'v2.0', date: '2026-05-29', author: 'Liam Sterling', changes: 'Synced ACT-002 biometric recognition audit updates' },
    { version: 'v1.8', date: '2025-11-12', author: 'Sophia Kowalsky', changes: 'Formatted Stripe Art 46 cross-border transfers details' },
    { version: 'v1.4', date: '2025-02-04', author: 'Liam Sterling', changes: 'Initial GDPR baseline boilerplate publication' },
  ];

  const handleToggleSelectActivity = (id: string) => {
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const downloadPolicy = () => {
    const blob = new Blob([generatedText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PrivacyPilot_Policy_Statement_${activeVersion}.md`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id={id} className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-105">
            Privacy Statement Dynamic Compiler
          </h2>
          <p className="text-xs text-slate-500">
            Select processing activity registers dynamically to render ready-to-publish Legal Statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AppButton
            id="btn-policy-download"
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 dark:border-slate-800 bg-white"
            onClick={downloadPolicy}
          >
            <FileDown className="h-3.5 w-3.5 mr-1.5" /> Export Document (.md)
          </AppButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Configurations Options (lg:col-span-4) */}
        <div className="col-span-1 lg:col-span-4 space-y-4">
          {/* Select activities card */}
          <AppCard id="policy-activities-select" title="Scope of Activities (ROPA)">
            <p className="text-xs text-slate-450 mb-3.5 leading-relaxed">
              Toggle specific registries that are categorized as customer-facing or require public disclosures:
            </p>

            <div className="space-y-2">
              {activities.map((act) => {
                const isChecked = selectedActivities.includes(act.id);
                return (
                  <label
                    key={act.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'bg-indigo-50/10 border-indigo-500 font-extrabold text-indigo-900 dark:text-indigo-305'
                        : 'border-slate-150 dark:border-slate-805 text-slate-600 hover:bg-slate-50/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelectActivity(act.id)}
                      className="mt-1 text-indigo-650"
                    />
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold truncate leading-tight">
                        {act.name}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-mono font-medium block mt-1">
                        Basis: {act.legalBasis.split(' ')[0]}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </AppCard>

          {/* Style Templates choice */}
          <AppCard id="policy-style-theme" title="Legal Wording Tone">
            <div className="space-y-2.5">
              {[
                { key: 'Standard' as const, label: 'Standard Disclosure', desc: 'Symmetrical wording suitable for standard enterprise SaaS setups.' },
                { key: 'Strict' as const, label: 'Strict RODO / Chapter III Focus', desc: 'Accentuates access right revocations and GDPR Article 13 disclosures.' },
                { key: 'Corporate' as const, label: 'Consolidated Holding Group Layout', desc: 'Tailored for multi-entity hierarchies mapped under RegulaOne.' },
              ].map((tpl) => (
                <div
                  key={tpl.key}
                  onClick={() => setLegalTemplate(tpl.key)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all ${
                    legalTemplate === tpl.key
                      ? 'bg-indigo-50/10 border-indigo-550 ring-2 ring-indigo-500/5 font-extrabold'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50/50'
                  }`}
                >
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-205">{tpl.label}</h5>
                  <p className="text-[10px] text-slate-500 mt-1 leading-snug">{tpl.desc}</p>
                </div>
              ))}
            </div>
          </AppCard>

          {/* Versions control */}
          <AppCard id="policy-versions-history" title="Version Revision History">
            <div className="space-y-3">
              {MOCK_VERSIONS.map((v) => (
                <div
                  key={v.version}
                  onClick={() => setActiveVersion(v.version)}
                  className={`p-2.5 border rounded-lg cursor-pointer transition-all ${
                    activeVersion === v.version
                      ? 'bg-slate-950 text-white border-slate-800 shadow-xs'
                      : 'border-slate-150 dark:border-slate-801 text-slate-650 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1">
                      <History className="h-3 w-3" /> {v.version}
                    </span>
                    <span className="font-mono text-[10px] opacity-75">{v.date}</span>
                  </div>
                  <p className="text-[10px] opacity-65 mt-1 truncate">
                    {v.changes}
                  </p>
                </div>
              ))}
            </div>
          </AppCard>
        </div>

        {/* Right Preview Panel / Text Editor (lg:col-span-8) */}
        <div className="col-span-1 lg:col-span-8 space-y-4">
          <AppCard
            id="policy-preview-card"
            title={`Preview Pane - Statement ${activeVersion}`}
            headerAction={
              <AppButton
                id="btn-edit-policy-mode"
                variant={isEditing ? 'primary' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit2 className="h-3 w-3 mr-1" />
                {isEditing ? 'Save Edits' : 'Edit Text'}
              </AppButton>
            }
          >
            {isEditing ? (
              <textarea
                id="policy-markdown-editor"
                rows={22}
                className="w-full text-xs font-mono p-4 border border-indigo-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-550 outline-hidden rounded-xl h-96 dark:text-slate-200"
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
              />
            ) : (
              <div className="prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed max-h-[64vh] overflow-y-auto pr-1">
                {generatedText.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={idx} className="text-base font-extrabold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4 mt-1">{line.replace('# ', '')}</h1>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={idx} className="text-xs uppercase font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400 mt-6 mb-2.5">{line.replace('## ', '')}</h2>;
                  }
                  if (line.startsWith('### ')) {
                    return <h3 key={idx} className="text-md font-extrabold text-slate-805 dark:text-slate-100 mt-4 mb-2">{line.replace('### ', '')}</h3>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={idx} className="ml-4 list-disc pl-1 text-slate-650 dark:text-slate-350">{line.replace('- ', '')}</li>;
                  }
                  return <p key={idx} className="mb-4 text-slate-600 dark:text-slate-350 text-xs">{line}</p>;
                })}
              </div>
            )}
          </AppCard>
        </div>
      </div>
    </div>
  );
};
