/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Shield, Lock, FileText, Check, AlertTriangle, ChevronRight, Upload,
  Trash2, Send, MessageSquare, Copy, HelpCircle, Archive, AlertCircle,
  TrendingUp, Users, Clock, Flame, PieChart, BarChart2, Briefcase, FileSpreadsheet, Plus, Filter, Search, ShieldCheck, CheckSquare, Settings, Scale
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  CaseReport, AuditLog, SaaSUser, CaseMessage, ReportCategory,
  CaseStatus, CaseSeverity, AppRole, NotificationItem
} from "../types";
import {
  AppButton, SecureCard, CaseStatusBadge, CaseSeverityBadge,
  SecureTextField, AppTable, AppModal, TimelineWidget,
  AttachmentUploader, ChatBubble
} from "./UI";

// 1. PUBLIC ANONYMOUS REPORTING PORTAL VIEW
export function PublicReportPortal({
  onSubmitReport,
}: {
  onSubmitReport: (report: Omit<CaseReport, "id" | "status" | "submissionDate" | "timeline" | "severity">) => void;
}) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ReportCategory>(ReportCategory.Corruption);
  const [description, setDescription] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [department, setDepartment] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      setStep(step + 1);
    } else {
      onSubmitReport({
        category,
        description,
        incidentDate: incidentDate || new Date().toISOString().split("T")[0],
        department: department || "General / Undefined",
        attachments,
        isAnonymous,
        reporterName: isAnonymous ? undefined : reporterName,
        reporterEmail: isAnonymous ? undefined : reporterEmail,
        slaHoursRemaining: 2160, // 90 days statutory SLA (2160 hours)
      });
    }
  };

  const isLabourDispute = category === ReportCategory.LabourDispute;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start leading-relaxed">
      {/* Forms Multi-Step Wizard Column */}
      <div className="lg:col-span-2">
        <SecureCard
          isEncrypted={!isLabourDispute}
          title={isLabourDispute ? "Standard Employee Complaint Form" : "Secure Direct Compliance Report"}
          subtitle={`Multi-step confidential filing portal (Step ${step} of 2)`}
        >
          {/* Progress Indicators */}
          <div className="flex items-center gap-3 mb-6 bg-[#0B0C10] p-3 rounded-lg border border-slate-800">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono font-bold ${step === 1 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"}`}>1</span>
            <span className="text-xs text-slate-300 font-semibold">Incident Details</span>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono font-bold ${step === 2 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-slate-800 text-slate-500"}`}>2</span>
            <span className="text-xs text-slate-400 font-semibold">Anonymity & Verification</span>
          </div>

          <form onSubmit={handleNext} className="space-y-6">
            {step === 1 ? (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider block mb-1.5">
                    What Category of Incident occurred?
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const val = e.target.value as ReportCategory;
                      setCategory(val);
                      if (val === ReportCategory.LabourDispute) {
                        setIsAnonymous(false); // Direct forwarding to HR defaults to named/disclosed status
                      }
                    }}
                    className="block w-full rounded-lg bg-[#0F1117] border border-slate-800 text-slate-100 px-3.5 py-2.5 text-sm cursor-pointer outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {Object.values(ReportCategory).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {isLabourDispute && (
                    <div className="mt-3 bg-amber-950/40 border border-amber-800/40 rounded-lg p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-1">Labour Dispute routing (Prawo pracy):</span>
                        Under the Polish Whistleblower Protection Act (Ustawa o ochronie sygnalistów), standard business labour disputes and individual contract grievances are routed straight to HR. Secure anonymous PINs do not apply.
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SecureTextField
                    type="date"
                    id="incident_date"
                    label="Incident Date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    required
                  />
                  <SecureTextField
                    type="text"
                    id="incident_dept"
                    label="Internal Department Involved"
                    placeholder="e.g. Sales, Warsaw Logistics, IT"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="incident_desc" className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
                    Full Description of Evidence
                  </label>
                  <textarea
                    id="incident_desc"
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide sequence of actions, timelines, and names to aid investigators. Ensure you omit any personal information if you prefer to stay anonymous."
                    className="block w-full rounded-lg bg-[#0F1117] border border-slate-800 text-slate-100 placeholder-slate-600 text-sm p-3.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider block mb-2">
                    Upload Supporting Documents, Transcripts or Images
                  </label>
                  <AttachmentUploader
                    files={attachments}
                    onFilesChanged={(newFiles) => setAttachments(newFiles)}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                {!isLabourDispute ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-4 text-xs text-emerald-300 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-bold block mb-1">Encrypted Confidential Tunnel Enabled</span>
                        Your details will be protected by military-grade AES-256 database protection. This submission is fully isolated from employee directory registries. Tracking pins are issued transparently upon submission.
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-200">Submit Anonymously?</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Admins and investigators cannot identify anonymous reporters.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAnonymous(!isAnonymous)}
                        className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex ${
                          isAnonymous ? "bg-emerald-500 justify-end" : "bg-slate-800 justify-start"
                        }`}
                      >
                        <span className="w-5.5 h-5.5 bg-slate-950 rounded-full shadow-md" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-950/20 border border-amber-900/60 rounded-lg p-4 text-xs text-amber-300">
                    <span className="font-bold block mb-1.5">Direct Disclosure Policy:</span>
                    Because this item concerns a Labour Dispute category, we will route it directly to Katarzyna Mazur (HR Manager). Anonymous case pinning is disabled for internal employee relations complaints.
                  </div>
                )}

                {(!isAnonymous || isLabourDispute) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-850 pt-4"
                  >
                    <SecureTextField
                      type="text"
                      id="rep_name"
                      label="Your Legal Name"
                      placeholder="e.g. Adam Nowak"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      required
                    />
                    <SecureTextField
                      type="email"
                      id="rep_email"
                      label="Your Corporate Email Address"
                      placeholder="adam.nowak@company.pl"
                      value={reporterEmail}
                      onChange={(e) => setReporterEmail(e.target.value)}
                      required
                    />
                  </motion.div>
                )}

                <div className="border-t border-slate-850 pt-4 text-[10px] text-slate-500 leading-relaxed font-mono">
                  By clicking Submit, you swear that the facts presented in this communication are accurate to the best of your legal knowledge. Abuse of whistleblower filing represents a punishable regulatory infraction under Poland Directive 2024.
                </div>
              </motion.div>
            )}

            <div className="flex justify-between items-center border-t border-slate-850 pt-4">
              {step === 2 && (
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Back
                </AppButton>
              )}
              <div className="flex-1 text-right">
                <AppButton
                  type="submit"
                  variant={step === 2 ? (isLabourDispute ? "danger" : "secure") : "primary"}
                  icon={step === 2 ? <Shield className="w-4 h-4" /> : undefined}
                >
                  {step === 1 ? "Proceed to Anonymity Rules" : "Transmit Secure Report"}
                </AppButton>
              </div>
            </div>
          </form>
        </SecureCard>
      </div>

      {/* Polish Whistleblower Guidance Info-Panel Column */}
      <div className="space-y-6">
        <div className="bg-[#0F1117] border border-slate-800 rounded-xl p-5 relative">
          <div className="absolute top-0 right-10 bg-indigo-500/10 border-b border-x border-indigo-500/20 px-3 py-1 rounded-b text-[9px] font-mono font-bold text-indigo-400">
            COMPLIANCE: POLAND
          </div>
          <h4 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-widest flex items-center gap-1.5 mb-4">
            <Scale className="w-4 h-4 text-indigo-400" /> Statutory Framework
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            SafeVoice satisfies all requirements of the Polish Directive <strong>Ustawa z dnia 14 czerwca 2024 r. o ochronie sygnalistów</strong>, governing confidential disclosure standards within the EU.
          </p>
          <ul className="space-y-3">
            {[
              {
                title: "Strict Non-Retaliation Policy",
                desc: "Retaliatory corporate actions against verified filers are strictly illegal under criminal prosecution laws."
              },
              {
                title: "The 7-Day SLA Response Directive",
                desc: "Legally, companies must acknowledge submissions with receipt confirmations within seven calendar days."
              },
              {
                title: "3-Month Remediation Schedule",
                desc: "The compliance officer has a maximum SLA of ninety days to report internal findings back to the reporter."
              }
            ].map((rule, idx) => (
              <li key={idx} className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 text-xs">
                <span className="font-bold text-slate-200 block mb-1">{rule.title}</span>
                <span className="text-[11px] text-slate-400 leading-normal block">{rule.desc}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-5 text-center flex flex-col items-center justify-center">
          <Lock className="w-8 h-8 text-emerald-400 mb-2" />
          <h5 className="text-xs font-semibold text-slate-200">Military AES-256 Shield</h5>
          <p className="text-[11px] text-slate-500 mt-1 leading-normal max-w-xs">
            Submissions are fully encrypted. RegulaOne operates zero analytics logging pipelines to protect user privacy.
          </p>
        </div>
      </div>
    </div>
  );
}

// 2. REPORT SUCCESS SCREEN
export function ReportSuccessView({
  generatedPin,
  category,
}: {
  generatedPin?: string;
  category: ReportCategory;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (generatedPin) {
      navigator.clipboard.writeText(generatedPin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLabourDispute = category === ReportCategory.LabourDispute;

  return (
    <div className="max-w-xl mx-auto text-center py-6 leading-relaxed">
      {/* Animated Check */}
      <div className="inline-flex items-center justify-center h-16 w-16 bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 rounded-full mb-6">
        <ShieldCheck className="w-8 h-8" />
      </div>

      <h1 className="text-xl font-bold text-slate-100 tracking-tight">
        Report Transmitted Successfully
      </h1>
      <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
        Your data package has been committed directly to the secure RegulaOne blockchain ledger in compliance with state rules.
      </p>

      {isLabourDispute ? (
        <div className="bg-amber-950/20 border border-amber-900/60 rounded-xl p-6 mt-8 space-y-4">
          <div className="text-center font-bold text-amber-300 text-sm">
            Forwarded Directly to HR Oversight
          </div>
          <p className="text-xs text-slate-400 leading-relaxed text-left">
            Per company protocol and the Polish Whistleblower Code, this labour, grievance, or scheduling conflict does not qualify for anonymous tracker pinning. It has been securely dispatched directly to the Director of HR, Katarzyna Mazur. You will receive progress reports directly to your provided employee email address.
          </p>
        </div>
      ) : (
        <div className="space-y-6 mt-8">
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 relative overflow-hidden">
            <span className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-emerald-500/10 via-emerald-500/80 to-emerald-500/10" />
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono mb-3">
              <Lock className="w-3.5 h-3.5" /> SECURE CASE PIN CODE
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 relative flex items-center justify-between max-w-sm mx-auto">
              <span className="text-md font-mono text-slate-100 font-bold select-all tracking-wider md:tracking-widest">
                {generatedPin}
              </span>
              <button
                onClick={handleCopy}
                className="text-slate-400 hover:text-indigo-400 hover:bg-slate-900 p-2 rounded transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex justify-center mt-4">
              <span className="text-[10px] text-emerald-500 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 uppercase font-mono font-bold">
                AES-256 Decryption Key
              </span>
            </div>
          </div>

          <div className="bg-rose-950/30 border border-rose-900/40 text-rose-300 text-xs rounded-lg p-4 text-left leading-normal flex gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-200 block mb-1">WARNING: CRITICAL COMPLIANCE NOTICE</span>
              Save this PIN securely right now. For security purposes and reporter privacy protection, SafeVoice does not maintain any name backups. If you lose this key, your case cannot be recovered.
            </div>
          </div>

          <div className="bg-[#0F1117] p-5 rounded-xl border border-slate-800 text-left space-y-3.5 text-xs">
            <span className="font-bold text-slate-300 font-mono text-[10px] uppercase tracking-wider block">How to Track Your System Status:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0B0C10] p-3 rounded-lg border border-slate-800">
                <span className="font-semibold text-slate-200 block mb-0.5">1. Tracking portal</span>
                Navigate to the <strong className="text-indigo-400">Track Report</strong> tab globally using your PIN key.
              </div>
              <div className="bg-[#0B0C10] p-3 rounded-lg border border-slate-855">
                <span className="font-semibold text-slate-200 block mb-0.5">2. Secure Conversation</span>
                Send encrypted follow-ups directly to the appointed compliance investigator.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 3. TRACK REPORT PAGE VIEW
export function TrackCaseView({
  reports,
  messages,
  onAddMessage,
  onAddEvidence,
}: {
  reports: CaseReport[];
  messages: CaseMessage[];
  onAddMessage: (caseId: string, text: string) => void;
  onAddEvidence: (caseId: string, fileName: string) => void;
}) {
  const [pinInput, setPinInput] = useState("");
  const [trackedCase, setTrackedCase] = useState<CaseReport | null>(null);
  const [errorText, setErrorText] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<string[]>([]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    const matched = reports.find((r) => r.trackingPin === pinInput.trim());
    if (matched) {
      setTrackedCase(matched);
      setErrorText("");
    } else {
      setTrackedCase(null);
      setErrorText("PIN Code was not found or has been purged. Please double-check formatting.");
    }
  };

  const handleAddMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !trackedCase) return;

    onAddMessage(trackedCase.id, typedMessage);
    setTypedMessage("");
  };

  const currentCaseMessages = trackedCase
    ? messages.filter((m) => m.caseId === trackedCase.id)
    : [];

  return (
    <div className="max-w-5xl mx-auto leading-relaxed">
      {!trackedCase ? (
        <div className="max-w-md mx-auto py-10">
          <SecureCard
            title="Secure Whistleblower Login"
            subtitle="Access case timeline & send follow-up communications"
            isEncrypted
          >
            <form onSubmit={handleTrackSubmit} className="space-y-4">
              <SecureTextField
                label="Confidential Tracking PIN Code"
                id="pin_tracker_field"
                placeholder="SV-XXXX-XXXX"
                required
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                helperText="Enter the random tracker code generated upon submit."
              />
              {errorText && (
                <div className="text-xs text-rose-400 bg-rose-950/10 p-2.5 rounded border border-rose-900/30 font-mono">
                  {errorText}
                </div>
              )}
              <AppButton type="submit" variant="primary" className="w-full">
                Verify AES Keys & Load Case
              </AppButton>
            </form>
          </SecureCard>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Case timeline and indicators */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-850">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Active PIN track:</span>
                <h1 className="text-md font-mono text-slate-200 font-bold">{trackedCase.id}</h1>
              </div>
              <div className="flex gap-2">
                <CaseStatusBadge status={trackedCase.status} />
                <button
                  onClick={() => setTrackedCase(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 hover:underline bg-slate-900 border border-slate-800 px-2 py-1 rounded cursor-pointer"
                >
                  Exit Track
                </button>
              </div>
            </div>

            {/* Case Details Summary */}
            <div className="bg-[#0F1117] p-4 rounded-xl border border-slate-800 text-xs">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider block mb-1">Reporter Synopsis description:</span>
              <p className="text-slate-300 leading-relaxed italic">{trackedCase.description}</p>
            </div>

            {/* Case Timeline Activity Tracker */}
            <div className="bg-[#0F1117] p-5 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold text-slate-250 font-mono uppercase tracking-widest mb-4 flex items-center gap-1.5 border-b border-slate-800/65 pb-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Case Progression Timeline
              </h3>
              <TimelineWidget events={trackedCase.timeline} />
            </div>

            {/* File Additional Evidence Uploader */}
            <div className="bg-[#0F1117] p-5 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold text-slate-250 font-mono uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-emerald-400" /> Add Supplementary Evidence Package
              </h3>
              <p className="text-[11px] text-slate-400 mb-4 leading-normal">
                If you have new details, ledger files, or supporting screenshots, upload them anonymously here. Ensure they contain zero personal EXIF metadata.
              </p>
              <AttachmentUploader
                files={evidenceFiles}
                onFilesChanged={(newFiles) => {
                  const latest = newFiles[newFiles.length - 1];
                  if (latest) {
                    onAddEvidence(trackedCase.id, latest);
                    // Update current UI case timeline dynamically
                    trackedCase.timeline.unshift({
                      id: `ev-${Date.now()}`,
                      title: "Case Evidence Uploaded Completed",
                      description: `Supplemental evidence file received: ${latest}. File tagged with cryptographic signature.`,
                      timestamp: "Just Now",
                      type: "attachment"
                    });
                  }
                  setEvidenceFiles(newFiles);
                }}
              />
            </div>
          </div>

          {/* Secure chat portal with the appointed investigator */}
          <div className="space-y-6">
            <div className="bg-[#0B0C10] border border-emerald-500/20 rounded-xl p-4 relative">
              <span className="absolute top-0 right-4 bg-emerald-950/60 border-b border-x border-emerald-500/30 px-2 py-0.5 rounded-b text-[9px] font-mono text-emerald-400 flex items-center gap-1 uppercase">
                <Lock className="w-2.5 h-2.5" /> End-to-End
              </span>
              <h4 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" /> Secure Message Link
              </h4>
              <p className="text-[11px] text-slate-400 leading-normal mb-1">
                You can exchange confidential messages with the investigator below, with 100% anonymization filters.
              </p>
            </div>

            {/* Chat Box Panel */}
            <div className="bg-[#0F1117] border border-slate-800 rounded-xl overflow-hidden shadow-xl max-h-110 flex flex-col">
              <div className="bg-[#0B0C10] p-3 border-b border-slate-800 text-xs font-mono font-bold text-slate-300">
                SafeVoice Cryptographic Messenger
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-3 min-h-64 max-h-80 bg-slate-900/10">
                {currentCaseMessages.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs italic">
                    Opening chat canal... No messages yet.
                  </div>
                ) : (
                  currentCaseMessages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      sender={msg.sender === "Reporter" ? "Reporter" : `Investigator (${msg.sender})`}
                      text={msg.text}
                      timestamp={msg.timestamp}
                      attachments={msg.attachments}
                    />
                  ))
                )}
              </div>

              {/* Message Reply Form */}
              <form onSubmit={handleAddMessageSubmit} className="p-3 border-t border-slate-800 bg-[#0B0C10]/80 flex gap-2">
                <input
                  type="text"
                  required
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  placeholder="Post secure whistleblower update..."
                  className="bg-[#0F1117] text-xs text-slate-100 rounded-lg p-2 flex-grow outline-none border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg shadow-sm shadow-indigo-600/10 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 4. ADMIN DASHBOARD VIEW
export function AdminDashboard({
  reports,
  activeRole,
  onNavigateToCases,
}: {
  reports: CaseReport[];
  activeRole: AppRole | "Public User";
  onNavigateToCases: () => void;
}) {
  const total = reports.length;
  const openCount = reports.filter((r) => r.status !== "Closed").length;
  const criticalCount = reports.filter((r) => r.severity === "Critical").length;
  const anonymousCount = reports.filter((r) => r.isAnonymous).length;
  const closedCount = total - openCount;
  
  // Custom metrics calculation
  const averageResolutionDays = 12;

  // Custom Category and Department statistics for heatmap metrics
  const categoriesCount = reports.reduce((acc, report) => {
    acc[report.category] = (acc[report.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const departmentCount = reports.reduce((acc, report) => {
    acc[report.department] = (acc[report.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8 leading-relaxed">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            Polish Statutory Compliance Radar
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time analytics monitor mapped to Polish Whistleblower Directive compliance guidelines.
          </p>
        </div>
        <div className="mt-4 md:mt-0 bg-[#0F1117] px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 flex items-center gap-2">
          <span>Active Role: <strong className="text-indigo-400 font-bold">{activeRole}</strong></span>
        </div>
      </div>

      {/* Bento Grid Stats Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Compliance Cases", val: total, color: "text-slate-100 shadow-slate-950/20", icon: FileText },
          { label: "Active Investigations", val: openCount, color: "text-indigo-400", icon: Clock },
          { label: "Critical Severity Events", val: criticalCount, color: "text-rose-400", icon: Flame },
          { label: "Anonymous Reports", val: anonymousCount, color: "text-indigo-400 font-mono", icon: Shield },
          { label: "Est. Avg. Closure SLA", val: `${averageResolutionDays} Days`, color: "text-emerald-400", icon: Scale }
        ].map((block, idx) => {
          const Icon = block.icon;
          return (
            <div key={idx} className="bg-[#0F1117] border border-slate-800 rounded-xl p-4.5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10px] font-mono tracking-wider uppercase font-semibold">{block.label}</span>
                <Icon className="w-4 h-4 text-slate-550 group-hover:text-slate-300 transition-colors" />
              </div>
              <div className={`text-xl font-bold tracking-tight ${block.color} mt-1`}>
                {block.val}
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Charts & Department Heatmap Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Monthly Trend Line Chart */}
        <div className="bg-[#0F1117] border border-slate-800 p-5 rounded-xl lg:col-span-2 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-400" /> Compliance Submissions Trend (H1 2026)
            </h3>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/10 font-mono">
              SLA Compliant
            </span>
          </div>

          {/* SVG Line Graph */}
          <div className="relative h-64 w-full">
            <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="#1e293b" strokeDasharray="3" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#1e293b" strokeDasharray="3" />
              <line x1="0" y1="140" x2="500" y2="140" stroke="#1e293b" strokeDasharray="3" />
              <line x1="0" y1="200" x2="500" y2="200" stroke="#1e293b" />

              {/* Line Paths */}
              <path
                d="M 50 140 Q 150 160 250 80 T 450 30"
                fill="none"
                stroke="url(#indigo-grad)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Data points */}
              <circle cx="50" cy="140" r="4.5" fill="#6366f1" stroke="#0f172a" strokeWidth="2" />
              <circle cx="150" cy="142" r="4.5" fill="#6366f1" stroke="#0f172a" strokeWidth="2" />
              <circle cx="250" cy="80" r="4.5" fill="#6366f1" stroke="#0f172a" strokeWidth="2" />
              <circle cx="350" cy="65" r="4.5" fill="#6366f1" stroke="#0f172a" strokeWidth="2" />
              <circle cx="450" cy="30" r="4.5" fill="#6366f1" stroke="#0f172a" strokeWidth="2" />

              {/* Labels */}
              <text x="50" y="222" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">JAN</text>
              <text x="150" y="222" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">FEB</text>
              <text x="250" y="222" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">MAR</text>
              <text x="350" y="222" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">APR</text>
              <text x="450" y="222" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">MAY (LATEST)</text>

              <text x="15" y="145" fill="#475569" fontSize="8">2</text>
              <text x="15" y="85" fill="#475569" fontSize="8">4</text>
              <text x="15" y="25" fill="#475569" fontSize="8">6</text>

              {/* Define gradients */}
              <defs>
                <linearGradient id="indigo-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Categories breakdown & department weightage */}
        <div className="bg-[#0F1117] border border-slate-800 p-5 rounded-xl shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 mb-3 border-b border-slate-800 pb-2">
              Polish Compliance Categories
            </h3>
            
            <div className="space-y-2.5">
              {Object.keys(categoriesCount).map((category, idx) => {
                const count = categoriesCount[category];
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={idx} className="text-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1 font-mono">
                      <span className="font-semibold text-slate-300">{category}</span>
                      <span>{count} Case ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-[#0B0C10] h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-1.5 border-t border-slate-800 text-center">
            <button
               onClick={onNavigateToCases}
               className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
            >
              Filter Full Case Table
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <SecureCard title="Corporate Department Heatmap Grid" subtitle="Distribution of events by internal business units">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { dept: "Procurement & Logistics", volume: departmentCount["Procurement & Logistics"] || 0, color: "from-rose-950/40 text-rose-300 border-rose-800/40" },
            { dept: "IT Infrastructure Support", volume: departmentCount["IT Infrastructure Support"] || 0, color: "from-amber-950/30 text-amber-300 border-amber-900/30" },
            { dept: "Marketing - Finance Unit", volume: departmentCount["Marketing - Finance Unit"] || 0, color: "from-emerald-950/30 text-emerald-300 border-emerald-900/30" },
            { dept: "Product Engineering", volume: departmentCount["Product Engineering"] || 0, color: "from-indigo-950/30 text-indigo-300 border-indigo-900/30" }
          ].map((heat, idx) => (
            <div key={idx} className={`bg-gradient-to-br ${heat.color} border p-4.5 rounded-xl flex flex-col justify-between`}>
              <span className="text-xs font-semibold">{heat.dept}</span>
              <div className="flex items-center justify-between mt-4">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider opacity-60">Submissions:</span>
                <span className="text-md font-mono font-bold">{heat.volume}</span>
              </div>
            </div>
          ))}
        </div>
      </SecureCard>
    </div>
  );
}

// 5. CASE MANAGEMENT LIST TABLE VIEW
export function CaseManagementGrid({
  reports,
  onSelectCase,
}: {
  reports: CaseReport[];
  onSelectCase: (caseId: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  const filtered = reports.filter((c) => {
    const matchesSearch = c.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesSeverity = severityFilter === "ALL" || c.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div className="space-y-6 leading-relaxed">
      {/* Search and Filters panel */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-[#0F1117] p-4 rounded-xl border border-slate-800">
        <div className="relative w-full md:flex-1">
          <input
            type="text"
            placeholder="Search cases by code, category name, keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0F1117] border border-slate-800 rounded-lg py-2 pl-9.5 pr-4 text-xs font-semibold text-slate-200 outline-none placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0F1117] text-xs font-semibold border border-slate-800 text-slate-300 rounded-lg px-3.5 py-2 cursor-pointer outline-none w-full md:w-auto focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Received">Received</option>
            <option value="Under Review">Under Review</option>
            <option value="Investigating">Investigating</option>
            <option value="Awaiting Information">Awaiting Information</option>
            <option value="Closed">Closed</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 text-xs font-semibold border border-slate-800 text-slate-300 rounded-lg px-3.5 py-2 cursor-pointer outline-none w-full md:w-auto"
          >
            <option value="ALL">All Severities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Grid Table */}
      <div className="bg-slate-900 rounded-xl overflow-hidden shadow-xl border border-slate-850">
        <AppTable headers={["Case ID", "Category / Topic", "Severity", "SLA Deadline", "Assigned", "Classification", "Action"]}>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-10 text-slate-500 italic">
                No whistleblower records match the chosen search parameters.
              </td>
            </tr>
          ) : (
            filtered.map((caseItem) => (
              <tr key={caseItem.id} className="hover:bg-slate-850/65 transition-colors border-b border-slate-850/60">
                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-200">
                  {caseItem.id}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <div className="font-semibold text-slate-100">{caseItem.category}</div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate leading-normal">{caseItem.description}</div>
                </td>
                <td className="px-4 py-3">
                  <CaseSeverityBadge severity={caseItem.severity} />
                </td>
                <td className="px-4 py-3">
                  {caseItem.status === "Closed" ? (
                    <span className="text-[10px] text-slate-500 font-mono font-bold uppercase bg-slate-950 px-1.5 py-0.5 rounded">RESOLVED</span>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-xs font-mono font-semibold text-emerald-400">{caseItem.slaHoursRemaining} hrs</span>
                      <span className="text-[9px] text-slate-500 font-mono">Poland Stat SLA</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">
                  {caseItem.assignedInvestigator || (
                    <span className="font-mono text-rose-400 font-semibold text-[10px] uppercase">UNASSIGNED</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono leading-none ${
                    caseItem.isAnonymous 
                      ? "bg-indigo-950/40 text-indigo-300 border border-indigo-900/30" 
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}>
                    {caseItem.isAnonymous ? "🔒 ANONYMOUS" : "👤 DISCLOSED"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <AppButton
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectCase(caseItem.id)}
                  >
                    Open
                  </AppButton>
                </td>
              </tr>
            ))
          )}
        </AppTable>
      </div>
    </div>
  );
}

// 6. DETAILED CASE VIEW & INVESTIGATION FLOW WORKSPACE
export function CaseDetailsView({
  caseItem,
  messages,
  users,
  onUpdateStatus,
  onUpdateSeverity,
  onAssignInvestigator,
  onAddInternalNote,
  onAddAdminMessage,
}: {
  caseItem: CaseReport;
  messages: CaseMessage[];
  users: SaaSUser[];
  onUpdateStatus: (caseId: string, status: CaseStatus) => void;
  onUpdateSeverity: (caseId: string, severity: CaseSeverity) => void;
  onAssignInvestigator: (caseId: string, name: string) => void;
  onAddInternalNote: (caseId: string, text: string) => void;
  onAddAdminMessage: (caseId: string, text: string) => void;
}) {
  const [stateStatus, setStateStatus] = useState<CaseStatus>(caseItem.status);
  const [stateSeverity, setStateSeverity] = useState<CaseSeverity>(caseItem.severity);
  const [stateInv, setStateInv] = useState(caseItem.assignedInvestigator || "");
  const [noteText, setNoteText] = useState("");
  const [adminMsg, setAdminMsg] = useState("");

  const handleUpdate = () => {
    onUpdateStatus(caseItem.id, stateStatus);
    onUpdateSeverity(caseItem.id, stateSeverity);
    onAssignInvestigator(caseItem.id, stateInv);
  };

  const currentCaseMessages = messages.filter((m) => m.caseId === caseItem.id);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start leading-relaxed text-slate-300">
      <div className="xl:col-span-2 space-y-6">
        {/* Dynamic header and controls */}
        <div className="flex flex-col md:flex-row items-center justify-between pb-5 border-b border-slate-850">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono select-all bg-slate-950 px-2 py-0.5 rounded border border-slate-850">{caseItem.id}</span>
              <CaseStatusBadge status={caseItem.status} />
            </div>
            <h1 className="text-md font-bold text-slate-100 uppercase mt-1">{caseItem.category}</h1>
          </div>

          {/* Quick SLA warning */}
          <div className="mt-4 md:mt-0 flex items-center gap-2 text-xs bg-slate-950 px-4 py-2 rounded-lg border border-slate-850">
            <span className="text-slate-500 font-mono">Polish statutory deadline:</span>
            <span className="font-mono text-emerald-400 font-bold">{caseItem.slaHoursRemaining} Hours remaining</span>
          </div>
        </div>

        {/* Action Controls Card */}
        <SecureCard title="Compliance Action Center" subtitle="Direct state machine update panel" isEncrypted={true}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">State Status</label>
              <select
                value={stateStatus}
                onChange={(e) => setStateStatus(e.target.value as CaseStatus)}
                className="bg-[#0F1117] w-full text-xs font-semibold text-slate-200 border border-slate-800 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Received">Received</option>
                <option value="Under Review">Under Review</option>
                <option value="Investigating">Investigating</option>
                <option value="Awaiting Information">Awaiting Information</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Incident Severity</label>
              <select
                value={stateSeverity}
                onChange={(e) => setStateSeverity(e.target.value as CaseSeverity)}
                className="bg-slate-950 w-full text-xs font-semibold text-slate-200 border border-slate-800 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-rose-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Assigned Investigator</label>
              <select
                value={stateInv}
                onChange={(e) => setStateInv(e.target.value)}
                className="bg-[#0F1117] w-full text-xs font-semibold text-slate-250 border border-slate-800 text-slate-400 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t border-slate-850">
            <AppButton variant="primary" size="md" onClick={handleUpdate}>
              Commit Changes & Log Action
            </AppButton>
          </div>
        </SecureCard>

        {/* Synopsis content */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4">
          <div>
            <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-widest block mb-1">Reporter synopsis content:</span>
            <p className="text-xs text-slate-300 leading-relaxed font-mono">{caseItem.description}</p>
          </div>

          {caseItem.attachments.length > 0 && (
            <div className="pt-4 border-t border-slate-850">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase block mb-2">Submitted evidence packages ({caseItem.attachments.length}):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {caseItem.attachments.map((file, idx) => (
                  <div key={idx} className="bg-slate-900 px-3 py-2.5 rounded-lg border border-slate-800 text-xs font-mono flex items-center justify-between">
                    <span className="gap-2 truncate flex items-center text-slate-300">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" /> {file}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/20 tracking-wider">AES LOCKED</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detailed Timeline list */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-850">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 mb-4 pb-2 border-b border-slate-800">
            Statutory Legal Audit Log Timeline (Europe Directive)
          </h3>
          <TimelineWidget events={caseItem.timeline} />
        </div>
      </div>

      {/* Side segment: messages to anonymous whistleblower */}
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-850 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-850 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Encrypted Whistleblower Messenger
            </h3>
            <span className="text-[9px] font-mono text-emerald-500 bg-emerald-950/40 border border-emerald-500/10 px-1.5 py-0.5 rounded">
              Tunnel Active
            </span>
          </div>

          <div className="p-4 flex-grow overflow-y-auto max-h-80 min-h-64 space-y-3.5 bg-slate-950/10">
            {currentCaseMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs italic">
                Opening tunnel channel... Send the whistleblower an intake warning message.
              </div>
            ) : (
              currentCaseMessages.map((msg, i) => (
                <ChatBubble
                  key={msg.id || i}
                  sender={msg.sender}
                  text={msg.text}
                  timestamp={msg.timestamp}
                  attachments={msg.attachments}
                />
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (adminMsg.trim()) {
                onAddAdminMessage(caseItem.id, adminMsg);
                setAdminMsg("");
              }
            }}
            className="p-3 border-t border-slate-800 bg-[#0B0C10]/60 flex items-center gap-2"
          >
            <input
              type="text"
              required
              value={adminMsg}
              onChange={(e) => setAdminMsg(e.target.value)}
              placeholder="Post secure statement as Investigator..."
              className="bg-[#0F1117] text-xs border border-slate-800 rounded-lg p-2.5 flex-grow outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-lg shrink-0 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>

        {/* Security Disclaimers */}
        <div className="bg-slate-950 p-4 rounded-xl border border-rose-950/20 text-xs space-y-2.5">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block tracking-widest">Administrative Boundaries Rule:</span>
          <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
            <strong>Admins cannot identify anonymous reporters.</strong>
            This configuration executes anonymous encryption logic. All reverse logging is isolated. Metadata is scrubbed at the gateway.
          </p>
        </div>
      </div>
    </div>
  );
}

// 7. INBOX CONVERSATIONS GENERAL VIEW
export function CentralEncryptedInbox({
  reports,
  messages,
  onAddAdminMessage,
}: {
  reports: CaseReport[];
  messages: CaseMessage[];
  onAddAdminMessage: (caseId: string, text: string) => void;
}) {
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  const [typedSend, setTypedSend] = useState("");

  const trackableCases = reports.filter((r) => r.trackingPin !== undefined);

  if (trackableCases.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500 italic max-w-lg mx-auto">
        No active reporting portals matching secure chat tracks.
      </div>
    );
  }

  const selectedCase = trackableCases[activeCaseIdx] || trackableCases[0];
  const selectedCaseMessages = selectedCase
    ? messages.filter((m) => m.caseId === selectedCase.id)
    : [];

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F1117] grid grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto h-[550px] leading-relaxed shadow-2xl">
      {/* Sidebar selection list */}
      <div className="border-r border-slate-800 bg-[#0F1117] overflow-y-auto divide-y divide-slate-800/60 h-full">
        <div className="p-4 border-b border-slate-800 bg-[#0B0C10] flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-300 font-sans">Cases Inbox</span>
          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono font-bold">{trackableCases.length} ACTIVE</span>
        </div>
        {trackableCases.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => {
              setActiveCaseIdx(idx);
            }}
            className={`w-full text-left p-4 hover:bg-slate-900/60 transition-colors cursor-pointer flex flex-col gap-1.5 ${
              activeCaseIdx === idx ? "bg-slate-900/40 border-l-[3px] border-indigo-500" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-200 font-bold">{c.id}</span>
              <span className="text-[9px] uppercase font-mono text-slate-500">{c.submissionDate.split(" ")[0]}</span>
            </div>
            <div className="text-xs font-bold text-slate-400">{c.category}</div>
            <p className="text-[11px] text-slate-500 line-clamp-1 leading-normal italic">{c.description}</p>
          </button>
        ))}
      </div>

      {/* Messaging Panel content */}
      <div className="md:col-span-2 flex flex-col justify-between bg-[#0F1117] h-full relative">
        <div className="p-4 border-b border-slate-800 bg-[#0B0C10] flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-slate-200">{selectedCase.id}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">{selectedCase.category}</span>
          </div>
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase font-black tracking-widest animate-pulse">
            AES SECURE LINK
          </span>
        </div>

        {/* Message Feed list */}
        <div className="p-4 flex-1 overflow-y-auto divide-y divide-slate-800/10 space-y-3.5 bg-slate-950/5 h-72">
          {selectedCaseMessages.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-xs italic">
              Opening channel tunnel... No communications posted.
            </div>
          ) : (
            selectedCaseMessages.map((msg, i) => (
              <ChatBubble
                key={msg.id || i}
                sender={msg.sender === "Reporter" ? "Anonymous Whistleblower" : msg.sender}
                text={msg.text}
                timestamp={msg.timestamp}
                attachments={msg.attachments}
              />
            ))
          )}
        </div>

        {/* Message input action */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typedSend.trim()) {
              onAddAdminMessage(selectedCase.id, typedSend);
              setTypedSend("");
            }
          }}
          className="p-3 bg-[#0B0C10] border-t border-slate-800 flex gap-2.5"
        >
          <input
            type="text"
            required
            value={typedSend}
            onChange={(e) => setTypedSend(e.target.value)}
            placeholder={`Reply securely to Anonymous Whistleblower for ${selectedCase.id}...`}
            className="flex-grow bg-[#0F1117] text-xs rounded-lg p-2.5 outline-none border border-slate-800 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-lg font-semibold text-xs py-2 h-10 transition-all flex items-center justify-center cursor-pointer shadow-md shadow-indigo-600/10"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

// 8. SYSTEM AUDIT TRAIL LOGS VIEW
export function SecurityAuditTrailLogs({
  logs,
}: {
  logs: AuditLog[];
}) {
  const [auditSearch, setAuditSearch] = useState("");

  const filteredLogs = logs.filter((log) => {
    return log.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
           log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
           log.ipAddress.toLowerCase().includes(auditSearch.toLowerCase());
  });

  return (
    <div className="space-y-6 leading-relaxed max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-850 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            Enterprise Cryptographic Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Write-once ledger tracking compliance event actions per Polish and EU law guidelines.
          </p>
        </div>
      </div>

      {/* Filter and verification seal bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-850 justify-between">
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Search audit trail logs..."
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-350 rounded-lg py-2 pl-9.5 pr-4 text-xs font-semibold outline-none focus:border-teal-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-850 p-2 rounded truncate whitespace-nowrap overflow-hidden">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="font-mono text-[10px] text-slate-300">LEDGER HASH SEAL: SHA-256 e8b3df9bb...</span>
        </div>
      </div>

      {/* Audit table logs results */}
      <div className="bg-slate-900 border border-slate-850 rounded-xl overflow-hidden shadow-xl">
        <AppTable headers={["Timestamp", "Actor", "Action event details", "Network IP", "Seal integrity"]}>
          {filteredLogs.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-10 text-slate-500 italic">
                No systemic actions matched the query parameter.
              </td>
            </tr>
          ) : (
            filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-850/60 border-b border-slate-850 border-t border-transparent transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                  {log.timestamp}
                </td>
                <td className="px-4 py-3 text-xs font-bold text-slate-200 whitespace-nowrap">
                  {log.user}
                </td>
                <td className="px-4 py-3 text-xs text-slate-300 max-w-sm">
                  {log.action}
                  {log.oldStatus && log.newStatus && (
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                      <span>{log.oldStatus}</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-teal-400">{log.newStatus}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap select-all">
                  {log.ipAddress}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-500/10 font-bold uppercase select-none">
                    ✔ LOCKED
                  </span>
                </td>
              </tr>
            ))
          )}
        </AppTable>
      </div>
    </div>
  );
}

// 9. ROLES & PERMISSIONS MATRIX CONFIGURATION
export function UsersPermissionsMatrix({
  users,
  onInviteUser,
}: {
  users: SaaSUser[];
  onInviteUser: (name: string, email: string, role: AppRole) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("Investigator");

  const matrixRoles: { role: AppRole; view: boolean; assign: boolean; close: boolean; export: boolean; audits: boolean }[] = [
    { role: "Super Admin", view: true, assign: true, close: true, export: true, audits: true },
    { role: "Compliance Officer", view: true, assign: true, close: true, export: true, audits: true },
    { role: "Investigator", view: true, assign: false, close: true, export: false, audits: false },
    { role: "HR Manager", view: true, assign: false, close: false, export: false, audits: false },
    { role: "Auditor", view: true, assign: false, close: false, export: false, audits: true },
  ];

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    onInviteUser(inviteName, inviteEmail, inviteRole);
    setInviteName("");
    setInviteEmail("");
    setModalOpen(false);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto leading-relaxed">
      {/* Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            Statutory Internal Authorizations & Roles
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure system boundaries according to Poland compliance secrecy regulations.
          </p>
        </div>
        <AppButton variant="primary" icon={<Plus className="w-4 h-4 text-slate-950" />} onClick={() => setModalOpen(true)}>
          Invite Compliance Officer
        </AppButton>
      </div>

      {/* Authorized Users registry */}
      <SecureCard title="Authorized Personnel register" subtitle="Legally authorized internal officers">
        <AppTable headers={["Officer Name", "Role Target", "Authorization Status", "Joined On"]}>
          {users.map((usr) => (
            <tr key={usr.id} className="hover:bg-slate-850/60 border-b border-slate-850/60 font-mono text-xs">
              <td className="px-4 py-3 font-bold text-slate-200">
                {usr.name}
                <span className="block font-normal text-[10px] text-slate-500 font-sans mt-0.5">{usr.email}</span>
              </td>
              <td className="px-4 py-3">
                <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-teal-400 font-semibold uppercase tracking-wider">{usr.role}</span>
              </td>
              <td className="px-4 py-3 text-xs font-semibold">
                {usr.status === "Active" ? (
                  <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/10">ACTIVE AUTHORIZED</span>
                ) : (
                  <span className="text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/10 animate-pulse">PENDING REVIEW</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {usr.joinedDate}
              </td>
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      {/* Permissions Matrix */}
      <SecureCard title="Polish Security Permission Matrix" subtitle="Mandatory legal segregation boundaries on whistleblower records access">
        <AppTable headers={["System Role Type", "Assess Reports", "Assign Investigators", "Purge cases & Close", "Export Audit PDF", "Secrecy Audits"]}>
          {matrixRoles.map((rule, idx) => (
            <tr key={idx} className="hover:bg-slate-850/40 border-b border-slate-850/60">
              <td className="px-4 py-3 font-mono text-xs font-bold text-teal-400 uppercase tracking-wider">
                {rule.role}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={rule.view ? "text-emerald-400 font-semibold" : "text-slate-600 font-semibold text-xs font-mono"}>{rule.view ? "✔ PERMITTED" : "✖ BLOCKED"}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={rule.assign ? "text-emerald-400 font-semibold" : "text-slate-600 font-semibold text-xs font-mono"}>{rule.assign ? "✔ PERMITTED" : "✖ BLOCKED"}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={rule.close ? "text-emerald-400 font-semibold" : "text-slate-600 font-semibold text-xs font-mono"}>{rule.close ? "✔ PERMITTED" : "✖ BLOCKED"}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={rule.export ? "text-emerald-400 font-semibold" : "text-slate-600 font-semibold text-xs font-mono"}>{rule.export ? "✔ PERMITTED" : "✖ BLOCKED"}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={rule.audits ? "text-emerald-400 font-semibold" : "text-slate-600 font-semibold text-xs font-mono"}>{rule.audits ? "✔ PERMITTED" : "✖ BLOCKED"}</span>
              </td>
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      {/* Interactive Modal */}
      <AppModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Authorize Compliance Officer">
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <SecureTextField
            type="text"
            label="Officer Legal Full Name"
            placeholder="e.g. Zofia Kamińska"
            required
            id="inv_name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />
          <SecureTextField
            type="email"
            label="Official Company Email Address"
            placeholder="name@regulaone.pl"
            required
            id="inv_email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider block mb-1.5">Appointed Compliance Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AppRole)}
              className="bg-slate-950 w-full text-xs font-semibold text-slate-200 border border-slate-800 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-teal-500"
            >
              <option value="Super Admin">Super Admin</option>
              <option value="Compliance Officer">Compliance Officer</option>
              <option value="Investigator">Investigator</option>
              <option value="HR Manager">HR Manager</option>
              <option value="Auditor">Auditor</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
            <AppButton type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary">
              Authorize Officer in Registry
            </AppButton>
          </div>
        </form>
      </AppModal>
    </div>
  );
}

// 10. SYSTEM CONFIGURATION & COMPLIANCE RULES SETTINGS
export function BrandedSettingsView() {
  const [activeSettingsTab, setActiveSettingsTab] = useState("company");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-5xl mx-auto items-start leading-relaxed">
      {/* Settings Navigation Tabs Left */}
      <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl space-y-1">
        {[
          { key: "company", label: "Tenant Profile", icon: Users },
          { key: "security", label: "Security Schemes", icon: Lock },
          { key: "retention", label: "Purging & SLA Rules", icon: Clock },
          { key: "legal", label: "Directives & Legal Texts", icon: Scale }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSettingsTab(tab.key)}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeSettingsTab === tab.key
                  ? "bg-slate-900 border border-slate-800 text-teal-400"
                  : "hover:bg-slate-900 text-slate-400 hover:text-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="lg:col-span-3">
        {activeSettingsTab === "company" && (
          <SecureCard title="Enterprise Profile Configuration" subtitle="RegulaOne corporate hierarchy identity integration">
            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SecureTextField label="Tenant Legal Name" defaultValue="RegulaOne Poland S.A." id="tenant_legal_name" />
                <SecureTextField label="Corporate Registration Number (KRS)" defaultValue="KRS 0000984122" id="tenant_krs" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SecureTextField label="Authorized Head of Compliance" defaultValue="Jan Kowalski (General Council)" id="tenant_hc" />
                <SecureTextField label="Supervisory Authority Directives Link" defaultValue="https://sygnalisci.gov.pl" id="tenant_link" />
              </div>
              <div className="pt-4 border-t border-slate-850 text-right">
                <AppButton variant="primary">Commit Company profile Details</AppButton>
              </div>
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "security" && (
          <SecureCard title="Security & Intrusion Configuration" subtitle="Military-grade whistleblower database encryption limits">
            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-350 block uppercase">Cryptographic Cipher Key Type</label>
                  <input type="text" readOnly className="w-full bg-slate-950 border border-slate-850 rounded p-2.5 select-all font-mono" value="AES-GCM-256 (NSA compliant / Direct blockchain commits)" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-350 block uppercase">Maximum tracking code entries PIN lockouts</label>
                  <select className="bg-slate-950 border border-slate-850 rounded p-2.5 w-full">
                    <option>3 Failed pin entries (Locks case access file for 48 hrs)</option>
                    <option>5 Failed pin entries (Permantently destroys local trace keys)</option>
                  </select>
                </div>
              </div>
              <div className="bg-emerald-950/20 rounded-lg p-3.5 border border-emerald-500/20 text-[11px] text-emerald-300">
                ⭐ Encryption algorithms are validated by third party security consultants under ISO 27001 requirements.
              </div>
              <div className="pt-4 border-t border-slate-850 text-right">
                <AppButton variant="primary">Save security Rules</AppButton>
              </div>
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "retention" && (
          <SecureCard title="Case Retention schedule & GDPR Rules" subtitle="Automated purging timers config">
            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-350 block uppercase">Closed case automatic deletion timer</label>
                  <select className="bg-slate-950 border border-slate-150 rounded p-2.5 w-full">
                    <option>1 Year upon formal resolution case closed</option>
                    <option>3 Years (Standard European limitation timelines limit)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-350 block uppercase">SLA Breach escalating trigger</label>
                  <select className="bg-slate-950 border border-slate-150 p-2.5 rounded w-full">
                    <option>72 Hours prior to SLA expiry (Dispatches board warn notices)</option>
                    <option>24 Hours alert (Forcible escalation to External Supervisor audit panel)</option>
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 italic leading-normal">
                Configuring timelines here triggers hard cryptographic tasks. Purged files are scrubbed using deep zeroes (gutmann-pattern wipes) with zero database recovery prospects.
              </div>
              <div className="pt-4 border-t border-slate-850 text-right">
                <AppButton variant="primary">Save Retention schedules</AppButton>
              </div>
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "legal" && (
          <SecureCard title="Statutory Directives Reference Legal Texts" subtitle="SafeVoice compliance alignment rules details">
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Scale className="w-4 h-4 text-teal-400" /> Ustawa o ochronie sygnalistów
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  The primary Polish act implements EU Directive 2019/1937 on legal-entities transparency protection. Effective 2024, corporate organisations hosting standard headcount thresholds above 50 must offer direct local reporting paths ensuring secrecy.
                </p>
              </div>
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Scale className="w-4 h-4 text-teal-400" /> GDPR/RODO Compliance
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  All names, details, file headers, and IP metadata must be decoupled and encrypted. Whistleblower reporting pipelines hold top security privileges, shielding reporting lines from standard server management groups.
                </p>
              </div>
            </div>
          </SecureCard>
        )}
      </div>
    </div>
  );
}
