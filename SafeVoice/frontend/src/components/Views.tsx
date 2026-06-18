import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  Check,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Filter,
  Inbox,
  Lock,
  MessageSquare,
  Plus,
  Scale,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users
} from "lucide-react";
import { motion } from "motion/react";
import {
  AppRole,
  AuditLog,
  CaseMessage,
  CaseReport,
  CaseSeverity,
  CaseStatus,
  EvidenceAttachment,
  ReportCategory,
  ReportSubmission,
  SaaSUser
} from "../types";
import { complianceReview, rolePermissions, SafeVoiceDb } from "../data/mockData";
import {
  AppButton,
  AppModal,
  AppTable,
  AttachmentUploader,
  CaseSeverityBadge,
  CaseStatusBadge,
  ChatBubble,
  SecureCard,
  SecureTextField,
  TimelineWidget
} from "./UI";

const statuses: CaseStatus[] = [
  "Received",
  "Acknowledged",
  "Triage",
  "Investigating",
  "Awaiting Reporter",
  "Remediation",
  "Closed"
];

const severities: CaseSeverity[] = ["Low", "Medium", "High", "Critical"];

export function AccessDeniedView({ onGoReport }: { onGoReport: () => void }) {
  return (
    <div className="max-w-xl mx-auto py-16">
      <SecureCard title="Access denied" subtitle="Reporter sessions cannot view staff workspaces.">
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            This boundary is intentional. In production, staff access requires OIDC login, MFA, short sessions, role
            authorization, and audit logging. Reporter sessions stay isolated from case-management data.
          </p>
          <AppButton variant="secure" onClick={onGoReport} icon={<Shield className="w-4 h-4" />}>
            Return to reporter portal
          </AppButton>
        </div>
      </SecureCard>
    </div>
  );
}

export function PublicReportPortal({
  onSubmitReport
}: {
  onSubmitReport: (report: ReportSubmission) => void;
}) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ReportCategory>(ReportCategory.Corruption);
  const [description, setDescription] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [department, setDepartment] = useState("");
  const [attachments, setAttachments] = useState<EvidenceAttachment[]>([]);
  const [wantsRelay, setWantsRelay] = useState(false);
  const [relayContact, setRelayContact] = useState("");

  const isHrHandoff = category === ReportCategory.LabourDispute;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      setStep(2);
      return;
    }

    onSubmitReport({
      category,
      description: description.trim(),
      incidentDate: incidentDate || new Date().toISOString().split("T")[0],
      department: department.trim() || "Not specified",
      attachments,
      disclosureMode: isHrHandoff ? "HR Handoff" : wantsRelay ? "Confidential Named" : "Anonymous",
      contactVaultRef: wantsRelay && relayContact.trim() ? `vault://safevoice/contact/${Date.now()}` : undefined
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start leading-relaxed">
      <div className="lg:col-span-2">
        <SecureCard
          isEncrypted={!isHrHandoff}
          title={isHrHandoff ? "HR grievance handoff" : "Anonymous whistleblower report"}
          subtitle={`Privacy-preserving intake, step ${step} of 2`}
        >
          <div className="flex items-center gap-3 mb-6 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${step === 1 ? "bg-cyan-500 text-slate-950" : "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"}`}>1</span>
            <span className="text-xs text-slate-300 font-semibold">Minimum facts</span>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${step === 2 ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-500"}`}>2</span>
            <span className="text-xs text-slate-400 font-semibold">Protection choices</span>
          </div>

          <form onSubmit={submit} className="space-y-6">
            {step === 1 ? (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase font-mono block mb-1.5">
                    Report category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ReportCategory)}
                    className="block w-full rounded-lg bg-slate-950 border border-slate-700 text-slate-100 px-3.5 py-2.5 text-sm cursor-pointer outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  >
                    {Object.values(ReportCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {isHrHandoff && (
                    <div className="mt-3 bg-amber-950/30 border border-amber-800/50 rounded-lg p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-1">Separated from anonymous whistleblower tracking</span>
                        Individual employment grievances are routed to HR in this mock. No tracking code is issued, and no
                        reporter telemetry is collected here.
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SecureTextField
                    type="date"
                    id="incident_date"
                    label="Incident date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    required
                  />
                  <SecureTextField
                    type="text"
                    id="incident_dept"
                    label="Area involved"
                    placeholder="e.g. Procurement, IT Security"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    helperText="Use the broadest useful area to reduce re-identification risk."
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="incident_desc" className="text-xs font-bold text-slate-300 uppercase font-mono">
                    Facts needed for follow-up
                  </label>
                  <textarea
                    id="incident_desc"
                    required
                    minLength={40}
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what happened, when, and what evidence exists. Avoid details that identify you unless they are necessary."
                    className="block w-full rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm p-3.5 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                  <span className="text-[11px] text-slate-500">
                    Do not include personal data that is not needed to assess the report.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase font-mono block mb-2">
                    Evidence attachments
                  </label>
                  <AttachmentUploader files={attachments} onFilesChanged={setAttachments} />
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                {!isHrHandoff && (
                  <div className="space-y-4">
                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-4 text-xs text-emerald-200 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold block mb-1">Anonymous mode is default</span>
                        SafeVoice does not collect reporter IP address, device fingerprint, browser fingerprint, user-agent,
                        or geolocation for report handling.
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-200">Use optional secure relay?</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            The mock stores only a vault reference. Investigators never see the contact value.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWantsRelay(!wantsRelay)}
                          className={`w-12 h-6 rounded-full p-0.5 transition-colors flex ${wantsRelay ? "bg-cyan-500 justify-end" : "bg-slate-700 justify-start"}`}
                        >
                          <span className="w-5 h-5 bg-slate-950 rounded-full shadow-md" />
                        </button>
                      </div>
                      {wantsRelay && (
                        <div className="mt-4">
                          <SecureTextField
                            type="text"
                            id="relay_contact"
                            label="Vaulted relay contact"
                            placeholder="secure mailbox or phone relay"
                            value={relayContact}
                            onChange={(e) => setRelayContact(e.target.value)}
                            helperText="For the mock, the actual value is discarded and represented as a vault reference."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-slate-300 space-y-2">
                  <p className="font-semibold text-slate-100">Privacy notice summary</p>
                  <p>
                    Controller: RegulaOne Poland S.A. Purpose: receive, assess, follow up, and document reports. Personal
                    data not relevant to the report must not be collected or must be deleted promptly.
                  </p>
                  <p>
                    You may also report externally to the Polish Ombudsman or competent authority where applicable. Case
                    feedback is due within three months after acknowledgement.
                  </p>
                </div>
              </motion.div>
            )}

            <div className="flex justify-between items-center border-t border-slate-800 pt-4">
              {step === 2 ? (
                <AppButton type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </AppButton>
              ) : (
                <span />
              )}
              <AppButton type="submit" variant={step === 2 ? "secure" : "primary"} icon={step === 2 ? <Shield className="w-4 h-4" /> : undefined}>
                {step === 1 ? "Continue" : isHrHandoff ? "Route to HR" : "Submit anonymous report"}
              </AppButton>
            </div>
          </form>
        </SecureCard>
      </div>

      <div className="space-y-6">
        <SecureCard title="Poland and EU safeguards" subtitle="Controls shown in this mock">
          <ul className="space-y-3 text-xs text-slate-300">
            {[
              "7-day acknowledgement and 3-month feedback deadlines",
              "No reporter IP, user-agent, fingerprint, or geolocation collection",
              "Evidence metadata stripping and malware scanning before vault storage",
              "Irrelevant personal data deletion review within 14 days",
              "External reporting information available before submission"
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SecureCard>

        <SecureCard title="Data minimisation" subtitle="What this frontend avoids">
          <div className="grid gap-2 text-xs text-slate-300">
            {["Analytics", "Marketing pixels", "Device fingerprints", "Browser fingerprints", "Geolocation", "Reporter IP display"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2">
                <span>{item}</span>
                <span className="text-emerald-300 font-mono text-[10px] uppercase">not collected</span>
              </div>
            ))}
          </div>
        </SecureCard>
      </div>
    </div>
  );
}

export function ReportSuccessView({
  generatedCode,
  category
}: {
  generatedCode?: string;
  category: ReportCategory;
}) {
  const [copied, setCopied] = useState(false);
  const isHrHandoff = category === ReportCategory.LabourDispute;

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto text-center py-6 leading-relaxed">
      <div className="inline-flex items-center justify-center h-16 w-16 bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 rounded-full mb-6">
        <ShieldCheck className="w-8 h-8" />
      </div>

      <h1 className="text-xl font-bold text-slate-100 tracking-tight">
        {isHrHandoff ? "Grievance routed" : "Report submitted"}
      </h1>
      <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
        {isHrHandoff
          ? "This item was separated from anonymous whistleblower tracking and routed to HR handling."
          : "Your report is stored as a minimized case record. Keep the tracking code offline."}
      </p>

      {isHrHandoff ? (
        <div className="bg-amber-950/20 border border-amber-900/60 rounded-lg p-6 mt-8 text-left text-xs text-slate-300 space-y-3">
          <p className="font-bold text-amber-200">No anonymous tracking code was issued.</p>
          <p>
            The mock avoids collecting reporter telemetry here as well, but an HR grievance process may require different
            notices, confidentiality terms, and contact procedures.
          </p>
        </div>
      ) : (
        <div className="space-y-6 mt-8">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 relative overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-[2px] bg-emerald-400/70" />
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300 uppercase tracking-widest font-mono mb-3">
              <Lock className="w-3.5 h-3.5" /> anonymous tracking code
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 relative flex items-center justify-between max-w-sm mx-auto">
              <span className="text-md font-mono text-slate-100 font-bold select-all tracking-wider">{generatedCode}</span>
              <button onClick={handleCopy} className="text-slate-400 hover:text-cyan-300 hover:bg-slate-900 p-2 rounded transition-colors cursor-pointer">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-rose-950/20 border border-rose-900/50 text-rose-200 text-xs rounded-lg p-4 text-left leading-normal">
            SafeVoice cannot identify you from the tracking code. Losing it may prevent anonymous follow-up.
          </div>
        </div>
      )}
    </div>
  );
}

export function TrackCaseView({
  reports,
  messages,
  onAddMessage,
  onAddEvidence
}: {
  reports: CaseReport[];
  messages: CaseMessage[];
  onAddMessage: (caseId: string, text: string) => void;
  onAddEvidence: (caseId: string, attachments: EvidenceAttachment[]) => void;
}) {
  const [codeInput, setCodeInput] = useState("");
  const [trackedCase, setTrackedCase] = useState<CaseReport | null>(null);
  const [errorText, setErrorText] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceAttachment[]>([]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = reports.find((report) => report.trackingCode === codeInput.trim());
    if (matched) {
      setTrackedCase(matched);
      setErrorText("");
    } else {
      setTrackedCase(null);
      setErrorText("Tracking code not found. HR handoff items do not receive tracking codes.");
    }
  };

  const currentCaseMessages = trackedCase ? messages.filter((msg) => msg.caseId === trackedCase.id) : [];

  if (!trackedCase) {
    return (
      <div className="max-w-md mx-auto py-10">
        <SecureCard title="Track anonymous report" subtitle="Use only the code issued after submission" isEncrypted>
          <form onSubmit={handleTrackSubmit} className="space-y-4">
            <SecureTextField
              label="Tracking code"
              id="pin_tracker_field"
              placeholder="SV-XXXX-XXXX"
              required
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              helperText="No account, email address, IP address, or device identifier is required."
            />
            {errorText && <div className="text-xs text-rose-300 bg-rose-950/20 p-2.5 rounded border border-rose-900/40">{errorText}</div>}
            <AppButton type="submit" variant="primary" className="w-full">
              Open secure case channel
            </AppButton>
          </form>
        </SecureCard>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start max-w-6xl mx-auto leading-relaxed">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Anonymous case</span>
            <h1 className="text-md font-mono text-slate-200 font-bold">{trackedCase.id}</h1>
          </div>
          <div className="flex gap-2 items-center">
            <CaseStatusBadge status={trackedCase.status} />
            <AppButton size="sm" variant="outline" onClick={() => setTrackedCase(null)}>
              Exit
            </AppButton>
          </div>
        </div>

        <SecureCard title="Case progress" subtitle={`Acknowledgement due ${trackedCase.acknowledgementDue}; feedback due ${trackedCase.feedbackDue}`}>
          <TimelineWidget events={trackedCase.timeline} />
        </SecureCard>

        <SecureCard title="Add supplementary evidence" subtitle="Original filenames are replaced with generic evidence references">
          <AttachmentUploader files={evidenceFiles} onFilesChanged={setEvidenceFiles} />
          <div className="flex justify-end mt-4">
            <AppButton
              variant="secure"
              disabled={evidenceFiles.length === 0}
              onClick={() => {
                onAddEvidence(trackedCase.id, evidenceFiles);
                setEvidenceFiles([]);
              }}
            >
              Submit evidence refs
            </AppButton>
          </div>
        </SecureCard>
      </div>

      <div className="space-y-6">
        <SecureCard title="Secure conversation" subtitle="Two-way anonymous follow-up" isEncrypted>
          <div className="max-h-80 overflow-y-auto space-y-3 min-h-48">
            {currentCaseMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs italic">No messages yet.</div>
            ) : (
              currentCaseMessages.map((msg) => (
                <ChatBubble key={msg.id} sender={msg.sender === "Reporter" ? "Reporter" : msg.sender} text={msg.text} timestamp={msg.timestamp} attachments={msg.attachments} />
              ))
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!typedMessage.trim()) return;
              onAddMessage(trackedCase.id, typedMessage.trim());
              setTypedMessage("");
            }}
            className="mt-4 pt-4 border-t border-slate-800 flex gap-2"
          >
            <input
              type="text"
              required
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              placeholder="Send follow-up without identifying yourself"
              className="bg-slate-950 text-xs text-slate-100 rounded-lg p-2 flex-grow outline-none border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 p-2 rounded-lg transition-colors cursor-pointer">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </SecureCard>

        <SecureCard title="Technical metadata policy">
          <div className="grid gap-2 text-xs">
            {Object.entries(trackedCase.technicalMetadataPolicy).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded bg-slate-950 border border-slate-800 px-3 py-2">
                <span className="text-slate-300">{key.replace(/([A-Z])/g, " $1")}</span>
                <span className="text-emerald-300 font-mono uppercase">{value ? "stored" : "not stored"}</span>
              </div>
            ))}
          </div>
        </SecureCard>
      </div>
    </div>
  );
}

export function AdminDashboard({
  reports,
  activeRole,
  onNavigateToCases
}: {
  reports: CaseReport[];
  activeRole: AppRole;
  onNavigateToCases: () => void;
}) {
  const total = reports.length;
  const openCount = reports.filter((report) => report.status !== "Closed").length;
  const ackDue = reports.filter((report) => report.status === "Received").length;
  const legalHolds = reports.filter((report) => report.retention.state === "Legal Hold").length;
  const anonymousCount = reports.filter((report) => report.disclosureMode === "Anonymous").length;
  const deletionScheduled = reports.filter((report) => report.retention.state === "Deletion Scheduled").length;

  return (
    <div className="space-y-8 leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Case operations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Operational queue focused on acknowledgement, follow-up, retention, and authorized access.
          </p>
        </div>
        <div className="mt-4 md:mt-0 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
          Active role: <strong className="text-cyan-300 font-bold">{activeRole}</strong>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total cases", val: total, icon: FileText },
          { label: "Open", val: openCount, icon: Clock },
          { label: "Needs ack", val: ackDue, icon: AlertCircle },
          { label: "Anonymous", val: anonymousCount, icon: Shield },
          { label: "Deletion scheduled", val: deletionScheduled + legalHolds, icon: Archive }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10px] font-mono tracking-wider uppercase font-semibold">{item.label}</span>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-xl font-bold tracking-tight text-slate-100">{item.val}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SecureCard title="Workflow controls" subtitle="Production controls represented in the mock">
          <ul className="space-y-3 text-xs text-slate-300">
            {[
              "Acknowledge reports within 7 days",
              "Provide feedback within 3 months",
              "Keep reporter metadata unavailable to administrators",
              "Review irrelevant personal data for deletion within 14 days",
              "Apply legal hold only with documented reason"
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </SecureCard>

        <SecureCard title="Small-cell analytics removed" subtitle="Privacy by design">
          <p className="text-xs text-slate-300">
            The previous trend charts and department heatmaps were removed from this mock because low-volume reporting
            analytics can reveal who reported or when a team reported.
          </p>
        </SecureCard>

        <SecureCard title="Next queue action">
          <p className="text-xs text-slate-300 mb-4">
            Open the case register to triage, assign, message, close, or apply retention holds.
          </p>
          <AppButton variant="primary" onClick={onNavigateToCases} icon={<Filter className="w-4 h-4" />}>
            Open register
          </AppButton>
        </SecureCard>
      </div>
    </div>
  );
}

export function CaseManagementGrid({
  reports,
  activeRole,
  onSelectCase
}: {
  reports: CaseReport[];
  activeRole: AppRole;
  onSelectCase: (caseId: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = reports.filter((report) => {
    const searchable = `${report.id} ${report.category} ${report.department} ${report.status}`.toLowerCase();
    const matchesSearch = searchable.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 leading-relaxed">
      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800">
        <div className="relative w-full md:flex-1">
          <input
            type="text"
            placeholder="Search by case, category, status, or broad area"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold text-slate-200 outline-none placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 text-xs font-semibold border border-slate-700 text-slate-300 rounded-lg px-3.5 py-2 cursor-pointer outline-none w-full md:w-auto focus:border-cyan-500"
        >
          <option value="ALL">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <AppTable headers={["Case ID", "Category", "Status", "Deadlines", "Retention", "Assigned", "Disclosure", "Action"]}>
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={8} className="text-center py-10 text-slate-500 italic">
              No cases match the filters.
            </td>
          </tr>
        ) : (
          filtered.map((caseItem) => (
            <tr key={caseItem.id} className="hover:bg-slate-800/50 transition-colors border-b border-slate-800">
              <td className="px-4 py-3 font-mono text-xs font-bold text-slate-200">{caseItem.id}</td>
              <td className="px-4 py-3 text-xs">
                <div className="font-semibold text-slate-100">{caseItem.category}</div>
                <div className="text-[11px] text-slate-500 mt-1">{caseItem.department}</div>
              </td>
              <td className="px-4 py-3">
                <CaseStatusBadge status={caseItem.status} />
              </td>
              <td className="px-4 py-3 text-[11px] text-slate-400 font-mono">
                <div>Ack: {caseItem.acknowledgementDue}</div>
                <div>Feedback: {caseItem.feedbackDue}</div>
              </td>
              <td className="px-4 py-3 text-xs">
                <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">{caseItem.retention.state}</span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-300">{caseItem.assignedInvestigator || "Unassigned"}</td>
              <td className="px-4 py-3 text-xs text-cyan-300">{caseItem.disclosureMode}</td>
              <td className="px-4 py-3">
                <AppButton size="sm" variant="outline" onClick={() => onSelectCase(caseItem.id)}>
                  Open
                </AppButton>
              </td>
            </tr>
          ))
        )}
      </AppTable>

      <div className="text-[11px] text-slate-500">
        Active role: {activeRole}. Table intentionally omits narrative text and reporter contact data.
      </div>
    </div>
  );
}

export function CaseDetailsView({
  caseItem,
  messages,
  users,
  activeRole,
  onUpdateStatus,
  onUpdateSeverity,
  onAssignInvestigator,
  onAddInternalNote,
  onAddAdminMessage,
  onRetentionUpdate
}: {
  caseItem: CaseReport;
  messages: CaseMessage[];
  users: SaaSUser[];
  activeRole: AppRole;
  onUpdateStatus: (caseId: string, status: CaseStatus) => void;
  onUpdateSeverity: (caseId: string, severity: CaseSeverity) => void;
  onAssignInvestigator: (caseId: string, name: string) => void;
  onAddInternalNote: (caseId: string, text: string) => void;
  onAddAdminMessage: (caseId: string, text: string) => void;
  onRetentionUpdate: (caseId: string, legalHold: boolean, reason?: string) => void;
}) {
  const [stateStatus, setStateStatus] = useState<CaseStatus>(caseItem.status);
  const [stateSeverity, setStateSeverity] = useState<CaseSeverity>(caseItem.severity);
  const [stateInv, setStateInv] = useState(caseItem.assignedInvestigator || "");
  const [noteText, setNoteText] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
  const [holdReason, setHoldReason] = useState(caseItem.retention.legalHoldReason || "");

  const canAssign = SafeVoiceDb.can(activeRole, "assignCases");
  const canClose = SafeVoiceDb.can(activeRole, "closeCases");
  const canRetention = SafeVoiceDb.can(activeRole, "manageRetention");
  const currentCaseMessages = messages.filter((msg) => msg.caseId === caseItem.id);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start leading-relaxed text-slate-300">
      <div className="xl:col-span-2 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono select-all bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{caseItem.id}</span>
              <CaseStatusBadge status={caseItem.status} />
              <CaseSeverityBadge severity={caseItem.severity} />
            </div>
            <h1 className="text-md font-bold text-slate-100 mt-2">{caseItem.category}</h1>
          </div>
          <div className="text-xs bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
            <span className="text-slate-500 font-mono">Feedback due: </span>
            <span className="font-mono text-emerald-300 font-bold">{caseItem.feedbackDue}</span>
          </div>
        </div>

        <SecureCard title="Action center" subtitle="Least-privilege state changes">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Status</label>
              <select
                value={stateStatus}
                onChange={(e) => setStateStatus(e.target.value as CaseStatus)}
                disabled={!canClose && stateStatus === "Closed"}
                className="bg-slate-950 w-full text-xs font-semibold text-slate-200 border border-slate-700 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-cyan-500"
              >
                {statuses.map((status) => (
                  <option key={status} value={status} disabled={status === "Closed" && !canClose}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Severity</label>
              <select
                value={stateSeverity}
                onChange={(e) => setStateSeverity(e.target.value as CaseSeverity)}
                className="bg-slate-950 w-full text-xs font-semibold text-slate-200 border border-slate-700 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-cyan-500"
              >
                {severities.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Investigator</label>
              <select
                value={stateInv}
                onChange={(e) => setStateInv(e.target.value)}
                disabled={!canAssign}
                className="bg-slate-950 w-full text-xs font-semibold text-slate-200 border border-slate-700 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-cyan-500 disabled:opacity-60"
              >
                <option value="">Unassigned</option>
                {users
                  .filter((user) => user.status === "Active")
                  .map((user) => (
                    <option key={user.id} value={user.name}>
                      {user.name} ({user.role})
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t border-slate-800">
            <AppButton
              variant="primary"
              onClick={() => {
                onUpdateStatus(caseItem.id, stateStatus);
                onUpdateSeverity(caseItem.id, stateSeverity);
                if (canAssign) onAssignInvestigator(caseItem.id, stateInv);
              }}
            >
              Commit and audit
            </AppButton>
          </div>
        </SecureCard>

        <SecureCard title="Report synopsis" subtitle="Restricted case content">
          <p className="text-xs text-slate-300 leading-relaxed">{caseItem.description}</p>
          {caseItem.attachments.length > 0 && (
            <div className="pt-4 mt-4 border-t border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase block mb-2">
                Evidence references ({caseItem.attachments.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {caseItem.attachments.map((file) => (
                  <div key={file.id} className="bg-slate-950 px-3 py-2.5 rounded-lg border border-slate-800 text-xs font-mono">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate flex items-center gap-2 text-slate-300">
                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" /> {file.displayName}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-500/20">
                        {file.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{file.storageVaultRef}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SecureCard>

        <SecureCard title="Investigation timeline" subtitle="Case events without reporter telemetry">
          <TimelineWidget events={caseItem.timeline} />
        </SecureCard>
      </div>

      <div className="space-y-6">
        <SecureCard title="Retention and legal hold" subtitle={`Delete after ${caseItem.retention.deleteAfter}`}>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded bg-slate-950 border border-slate-800 px-3 py-2">
              <span>State</span>
              <span className="text-cyan-300">{caseItem.retention.state}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-slate-950 border border-slate-800 px-3 py-2">
              <span>Irrelevant data deletion due</span>
              <span className="text-slate-300">{caseItem.retention.irrelevantPersonalDataDeletionDue}</span>
            </div>
            <SecureTextField
              label="Legal hold reason"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              disabled={!canRetention}
            />
            <div className="flex gap-2">
              <AppButton size="sm" variant="secure" disabled={!canRetention} onClick={() => onRetentionUpdate(caseItem.id, true, holdReason)}>
                Apply hold
              </AppButton>
              <AppButton size="sm" variant="outline" disabled={!canRetention} onClick={() => onRetentionUpdate(caseItem.id, false)}>
                Remove hold
              </AppButton>
            </div>
          </div>
        </SecureCard>

        <SecureCard title="Anonymous messages" isEncrypted>
          <div className="max-h-72 overflow-y-auto min-h-48 space-y-3">
            {currentCaseMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs italic">No messages yet.</div>
            ) : (
              currentCaseMessages.map((msg) => (
                <ChatBubble key={msg.id} sender={msg.sender} text={msg.text} timestamp={msg.timestamp} attachments={msg.attachments} />
              ))
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!adminMsg.trim()) return;
              onAddAdminMessage(caseItem.id, adminMsg.trim());
              setAdminMsg("");
            }}
            className="mt-4 pt-4 border-t border-slate-800 flex gap-2"
          >
            <input
              type="text"
              required
              value={adminMsg}
              onChange={(e) => setAdminMsg(e.target.value)}
              placeholder="Reply without asking for identity unless necessary"
              className="bg-slate-950 text-xs border border-slate-700 rounded-lg p-2.5 flex-grow outline-none focus:border-cyan-500"
            />
            <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 p-2.5 rounded-lg shrink-0 transition-colors cursor-pointer">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </SecureCard>

        <SecureCard title="Restricted note">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!noteText.trim()) return;
              onAddInternalNote(caseItem.id, noteText.trim());
              setNoteText("");
            }}
            className="space-y-3"
          >
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Internal note. Avoid unnecessary personal data."
              className="w-full bg-slate-950 text-xs border border-slate-700 rounded-lg p-3 outline-none focus:border-cyan-500"
            />
            <AppButton type="submit" variant="outline" size="sm">
              Add note
            </AppButton>
          </form>
        </SecureCard>
      </div>
    </div>
  );
}

export function CentralEncryptedInbox({
  reports,
  messages,
  activeRole,
  onAddAdminMessage
}: {
  reports: CaseReport[];
  messages: CaseMessage[];
  activeRole: AppRole;
  onAddAdminMessage: (caseId: string, text: string) => void;
}) {
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  const [typedSend, setTypedSend] = useState("");
  const trackableCases = reports.filter((report) => Boolean(report.trackingCode));
  const selectedCase = trackableCases[activeCaseIdx] || trackableCases[0];
  const selectedCaseMessages = selectedCase ? messages.filter((msg) => msg.caseId === selectedCase.id) : [];
  const canReply = activeRole !== "Auditor";

  if (!selectedCase) {
    return <div className="text-center py-20 text-slate-500 italic max-w-lg mx-auto">No anonymous communication channels are active.</div>;
  }

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900 grid grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto h-[550px] leading-relaxed shadow-2xl">
      <div className="border-r border-slate-800 bg-slate-950 overflow-y-auto divide-y divide-slate-800 h-full">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-300">Channels</span>
          <span className="text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-mono font-bold">{trackableCases.length}</span>
        </div>
        {trackableCases.map((report, idx) => (
          <button
            key={report.id}
            onClick={() => setActiveCaseIdx(idx)}
            className={`w-full text-left p-4 hover:bg-slate-900 transition-colors cursor-pointer flex flex-col gap-1.5 ${
              activeCaseIdx === idx ? "bg-slate-900 border-l-4 border-cyan-500" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-200 font-bold">{report.id}</span>
              <span className="text-[9px] uppercase font-mono text-slate-500">{report.submissionDate.split(" ")[0]}</span>
            </div>
            <div className="text-xs font-bold text-slate-400">{report.category}</div>
          </button>
        ))}
      </div>

      <div className="md:col-span-2 flex flex-col justify-between h-full">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-slate-200">{selectedCase.id}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">{selectedCase.category}</span>
          </div>
          <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">
            anonymous channel
          </span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3.5 bg-slate-950/30 h-72">
          {selectedCaseMessages.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-xs italic">No communications posted.</div>
          ) : (
            selectedCaseMessages.map((msg) => (
              <ChatBubble key={msg.id} sender={msg.sender === "Reporter" ? "Anonymous Whistleblower" : msg.sender} text={msg.text} timestamp={msg.timestamp} attachments={msg.attachments} />
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!typedSend.trim() || !canReply) return;
            onAddAdminMessage(selectedCase.id, typedSend.trim());
            setTypedSend("");
          }}
          className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2.5"
        >
          <input
            type="text"
            required
            disabled={!canReply}
            value={typedSend}
            onChange={(e) => setTypedSend(e.target.value)}
            placeholder={canReply ? `Reply to ${selectedCase.id}` : "Auditor role is read-only"}
            className="flex-grow bg-slate-900 text-xs rounded-lg p-2.5 outline-none border border-slate-700 text-slate-200 focus:border-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canReply}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-slate-950 px-4 rounded-lg font-semibold text-xs py-2 h-10 transition-colors flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function SecurityAuditTrailLogs({ logs, activeRole }: { logs: AuditLog[]; activeRole: AppRole }) {
  const [auditSearch, setAuditSearch] = useState("");
  const canAudit = SafeVoiceDb.can(activeRole, "accessAudits");

  const filteredLogs = logs.filter((log) => {
    const text = `${log.actorRole} ${log.actorRef} ${log.actionType} ${log.subjectId || ""} ${log.metadataNotice}`.toLowerCase();
    return text.includes(auditSearch.toLowerCase());
  });

  if (!canAudit) {
    return <AccessDeniedView onGoReport={() => undefined} />;
  }

  return (
    <div className="space-y-6 leading-relaxed max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">Immutable audit trail</h1>
          <p className="text-xs text-slate-400 mt-1">
            Admin-visible log excludes reporter IP, user-agent, fingerprints, geolocation, and message bodies.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800 justify-between">
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Search audit events"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-300 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 p-2 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span className="font-mono text-[10px] text-slate-300">Hash-chain demo only; production requires WORM storage.</span>
        </div>
      </div>

      <AppTable headers={["Timestamp", "Actor", "Action", "Subject", "Outcome", "Metadata policy", "Seal"]}>
        {filteredLogs.map((log) => (
          <tr key={log.id} className="hover:bg-slate-800/50 border-b border-slate-800 transition-colors">
            <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">{log.timestamp}</td>
            <td className="px-4 py-3 text-xs text-slate-200">
              <div className="font-bold">{log.actorRole}</div>
              <div className="text-[10px] text-slate-500 font-mono">{log.actorRef}</div>
            </td>
            <td className="px-4 py-3 text-xs text-slate-300">{log.actionType}</td>
            <td className="px-4 py-3 text-xs font-mono text-slate-400">{log.subjectId || "N/A"}</td>
            <td className="px-4 py-3 text-xs text-emerald-300">{log.outcome}</td>
            <td className="px-4 py-3 text-xs text-slate-400 max-w-sm">
              {log.metadataNotice}
              {log.oldValue && log.newValue && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                  <span>{log.oldValue}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-cyan-300">{log.newValue}</span>
                </div>
              )}
            </td>
            <td className="px-4 py-3 text-xs font-mono text-slate-500">{log.hashChain}</td>
          </tr>
        ))}
      </AppTable>
    </div>
  );
}

export function UsersPermissionsMatrix({
  users,
  activeRole,
  onInviteUser
}: {
  users: SaaSUser[];
  activeRole: AppRole;
  onInviteUser: (name: string, email: string, role: AppRole) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("Investigator");
  const canManageUsers = SafeVoiceDb.can(activeRole, "manageUsers");

  return (
    <div className="space-y-8 max-w-5xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">Access controls</h1>
          <p className="text-xs text-slate-400 mt-1">Least-privilege roles with MFA and authorization status.</p>
        </div>
        <AppButton variant="primary" icon={<Plus className="w-4 h-4" />} disabled={!canManageUsers} onClick={() => setModalOpen(true)}>
          Invite officer
        </AppButton>
      </div>

      <SecureCard title="Authorized personnel">
        <AppTable headers={["Officer", "Role", "Status", "MFA", "Last login review"]}>
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-800/50 border-b border-slate-800 text-xs">
              <td className="px-4 py-3 font-bold text-slate-200">
                {user.name}
                <span className="block font-normal text-[10px] text-slate-500 mt-0.5">{user.email}</span>
              </td>
              <td className="px-4 py-3">
                <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-cyan-300 font-semibold uppercase tracking-wider">{user.role}</span>
              </td>
              <td className="px-4 py-3">{user.status}</td>
              <td className="px-4 py-3 text-emerald-300">{user.mfaRequired ? "Required" : "Missing"}</td>
              <td className="px-4 py-3 text-slate-500 font-mono">{user.lastLoginReview}</td>
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      <SecureCard title="Permission matrix" subtitle="Exports and user administration are intentionally narrow">
        <AppTable headers={["Role", "View", "Assign", "Close", "Export", "Audits", "Users", "Retention"]}>
          {rolePermissions.map((rule) => (
            <tr key={rule.role} className="hover:bg-slate-800/50 border-b border-slate-800">
              <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-300 uppercase">{rule.role}</td>
              {(["viewReports", "assignCases", "closeCases", "exportData", "accessAudits", "manageUsers", "manageRetention"] as const).map((key) => (
                <td key={key} className="px-4 py-3 text-center text-xs">
                  <span className={rule[key] ? "text-emerald-300 font-semibold" : "text-slate-600 font-semibold"}>{rule[key] ? "Allowed" : "Blocked"}</span>
                </td>
              ))}
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      <AppModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Invite authorized officer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!inviteName.trim() || !inviteEmail.trim()) return;
            onInviteUser(inviteName.trim(), inviteEmail.trim(), inviteRole);
            setInviteName("");
            setInviteEmail("");
            setModalOpen(false);
          }}
          className="space-y-4"
        >
          <SecureTextField label="Officer name" required value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          <SecureTextField label="Business email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase font-mono block mb-1.5">Role</label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AppRole)} className="bg-slate-950 w-full text-xs font-semibold text-slate-200 border border-slate-700 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-cyan-500">
              {rolePermissions.map((role) => (
                <option key={role.role} value={role.role}>
                  {role.role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
            <AppButton type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary">
              Invite with MFA
            </AppButton>
          </div>
        </form>
      </AppModal>
    </div>
  );
}

export function BrandedSettingsView() {
  const [activeSettingsTab, setActiveSettingsTab] = useState("security");

  const tabs = [
    { key: "security", label: "Admin Security", icon: Lock },
    { key: "retention", label: "Retention", icon: Clock },
    { key: "legal", label: "Legal Basis", icon: Scale },
    { key: "review", label: "Review Matrix", icon: FileText }
  ];

  const reviewGroups = useMemo(() => complianceReview, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-6xl mx-auto items-start leading-relaxed">
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSettingsTab(tab.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeSettingsTab === tab.key ? "bg-slate-900 border border-slate-700 text-cyan-300" : "hover:bg-slate-900 text-slate-400 hover:text-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-3">
        {activeSettingsTab === "security" && (
          <SecureCard title="Administrative security controls" subtitle="Required before production use">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {[
                ["MFA", "Required for all staff roles; no bypass role"],
                ["Session expiry", "15 minute idle timeout; 8 hour absolute maximum"],
                ["Session revocation", "Immediate revocation for role change, departure, or suspected compromise"],
                ["Password policy", "OIDC preferred; local fallback requires strong password and breach checks"],
                ["Login monitoring", "Security team only; do not expose source IP to case investigators"],
                ["Account lockout", "Progressive lockout and alerting after repeated failures"],
                ["Rate limiting", "Public tracking and intake endpoints must be rate-limited without fingerprinting"],
                ["No telemetry", "No analytics, marketing pixels, or device/browser fingerprinting"]
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="font-bold text-slate-100">{label}</div>
                  <div className="text-slate-400 mt-1">{value}</div>
                </div>
              ))}
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "retention" && (
          <SecureCard title="Retention and deletion policy" subtitle="Configurable but legally bounded">
            <div className="space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="font-bold text-slate-100">Default retention</div>
                  <div className="text-slate-400 mt-1">3 years after the calendar year in which follow-up ends or related proceedings end.</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="font-bold text-slate-100">Irrelevant data</div>
                  <div className="text-slate-400 mt-1">Delete within 14 days after determining it is not relevant to the report.</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="font-bold text-slate-100">Legal hold</div>
                  <div className="text-slate-400 mt-1">Suspends deletion only with reason, approver, timestamp, and periodic review.</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="font-bold text-slate-100">Secure destruction</div>
                  <div className="text-slate-400 mt-1">Delete DB rows, KMS data keys, object versions, quarantine copies, and search indexes.</div>
                </div>
              </div>
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "legal" && (
          <SecureCard title="Controller, processor, and lawful basis" subtitle="Policy text for the mock frontend">
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg">
                <div className="flex items-center gap-1.5 font-bold text-slate-100 mb-2">
                  <Scale className="w-4 h-4 text-cyan-300" /> Processing basis
                </div>
                <p>
                  Reports are processed to receive, verify, follow up, communicate with the reporter, document actions, and
                  protect against retaliation. Production deployments need a tenant-specific privacy notice and DPA.
                </p>
              </div>
              <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg">
                <div className="flex items-center gap-1.5 font-bold text-slate-100 mb-2">
                  <UserCheck className="w-4 h-4 text-cyan-300" /> Responsibilities
                </div>
                <p>
                  The customer organization is controller for its report register. SafeVoice acts as processor unless it
                  determines purposes and means for shared operations. Processor contracts must cover sub-processors, EU
                  hosting, audit rights, deletion, and incident response.
                </p>
              </div>
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "review" && (
          <SecureCard title="Feature compliance review" subtitle="Keep, modify, remove, add recommendations">
            <AppTable headers={["Area", "Existing feature", "Decision", "Justification", "Risk"]}>
              {reviewGroups.map((item) => (
                <tr key={`${item.area}-${item.classification}`} className="border-b border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-xs font-bold text-slate-100">{item.area}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{item.currentFeature}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-cyan-300 font-mono">{item.classification}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{item.justification}</td>
                  <td className="px-4 py-3 text-xs text-amber-200">{item.risk}</td>
                </tr>
              ))}
            </AppTable>
          </SecureCard>
        )}
      </div>
    </div>
  );
}
