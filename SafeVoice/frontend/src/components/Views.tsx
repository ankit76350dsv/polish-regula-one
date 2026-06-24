import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Archive,
  Check,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Filter,
  Lock,
  Scale,
  Search,
  Send,
  Shield,
  ShieldCheck,
  UserCheck
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
import { useJurisdiction } from "../config/activeJurisdiction";
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

// Translate a report category, falling back to the raw value if a locale string is missing.
const useCategoryLabel = () => {
  const { t } = useTranslation();
  return (category: ReportCategory) => t(`categories.${category}`, { defaultValue: category });
};

export function AccessDeniedView({ onGoReport }: { onGoReport: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-xl mx-auto py-16">
      <SecureCard title={t("accessDenied.title")} subtitle={t("accessDenied.subtitle")}>
        <div className="space-y-4 text-sm text-slate-700">
          <p>{t("accessDenied.body")}</p>
          <AppButton variant="secure" onClick={onGoReport} icon={<Shield className="w-4 h-4" />}>
            {t("accessDenied.returnToPortal")}
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
  const { t } = useTranslation();
  const jurisdiction = useJurisdiction();
  const categoryLabel = useCategoryLabel();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ReportCategory>(ReportCategory.Corruption);
  const [description, setDescription] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [department, setDepartment] = useState("");
  const [attachments, setAttachments] = useState<EvidenceAttachment[]>([]);
  const [wantsRelay, setWantsRelay] = useState(false);
  const [relayContact, setRelayContact] = useState("");

  const isHrHandoff = category === ReportCategory.LabourDispute;
  const hasExtension = jurisdiction.feedbackExtensionMonths > 0;

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
          title={isHrHandoff ? t("report.titleHr") : t("report.titleAnonymous")}
          subtitle={t("report.subtitle", { step })}
        >
          <ol className="flex items-center gap-3 mb-6 bg-slate-100 p-3 rounded-lg border border-slate-205 list-none">
            <li className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${step === 1 ? "bg-cyan-600 text-white" : "bg-cyan-50 text-cyan-705 border border-cyan-200"}`} aria-current={step === 1 ? "step" : undefined}>1</span>
              <span className="text-xs text-slate-800 font-semibold">{t("report.stepFacts")}</span>
            </li>
            <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <li className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${step === 2 ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-600"}`} aria-current={step === 2 ? "step" : undefined}>2</span>
              <span className="text-xs text-slate-500 font-semibold">{t("report.stepProtection")}</span>
            </li>
          </ol>

          <form onSubmit={submit} className="space-y-6">
            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <label htmlFor="report_category" className="text-xs font-bold text-slate-700 uppercase font-mono block mb-1.5">
                    {t("report.category")}
                  </label>
                  <select
                    id="report_category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ReportCategory)}
                    className="block w-full rounded-lg bg-white border border-slate-300 text-slate-900 px-3.5 py-2.5 text-sm cursor-pointer outline-none focus:border-cyan-550 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  >
                    {Object.values(ReportCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                  {isHrHandoff && (
                    <div className="mt-3 bg-amber-50 border border-amber-250 rounded-lg p-3.5 text-xs text-amber-855 flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-bold block mb-1">{t("report.hrSeparatedTitle")}</span>
                        {t("report.hrSeparatedBody")}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SecureTextField
                    type="date"
                    id="incident_date"
                    label={t("report.incidentDate")}
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    required
                  />
                  <SecureTextField
                    type="text"
                    id="incident_dept"
                    label={t("report.areaInvolved")}
                    placeholder={t("report.areaPlaceholder")}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    helperText={t("report.areaHelper")}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="incident_desc" className="text-xs font-bold text-slate-700 uppercase font-mono">
                    {t("report.factsLabel")}
                  </label>
                  <textarea
                    id="incident_desc"
                    required
                    minLength={40}
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("report.factsPlaceholder")}
                    aria-describedby="incident_desc_helper"
                    className="block w-full rounded-lg bg-white border border-slate-350 text-slate-900 placeholder-slate-400 text-sm p-3.5 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                  <span id="incident_desc_helper" className="text-[11px] text-slate-500">
                    {t("report.factsHelper")}
                  </span>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase font-mono block mb-2">
                    {t("report.evidence")}
                  </span>
                  <AttachmentUploader files={attachments} onFilesChanged={setAttachments} />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {!isHrHandoff && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-805 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" aria-hidden="true" />
                      <div>
                        <span className="font-bold block mb-1">{t("report.anonymousDefaultTitle")}</span>
                        {t("report.anonymousDefaultBody")}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-205 p-4 rounded-lg">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-900" id="relay_label">{t("report.relayTitle")}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{t("report.relayBody")}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wantsRelay}
                          aria-labelledby="relay_label"
                          aria-label={t("report.relayToggleLabel")}
                          onClick={() => setWantsRelay(!wantsRelay)}
                          className={`w-12 h-6 rounded-full p-0.5 transition-colors flex focus:outline-none focus:ring-2 focus:ring-cyan-500 ${wantsRelay ? "bg-cyan-600 justify-end" : "bg-slate-200 justify-start"}`}
                        >
                          <span className="w-5 h-5 bg-white rounded-full shadow-md" />
                        </button>
                      </div>
                      {wantsRelay && (
                        <div className="mt-4">
                          <SecureTextField
                            type="text"
                            id="relay_contact"
                            label={t("report.relayLabel")}
                            placeholder={t("report.relayPlaceholder")}
                            value={relayContact}
                            onChange={(e) => setRelayContact(e.target.value)}
                            helperText={t("report.relayHelper")}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 space-y-2">
                  <p className="font-semibold text-slate-900">{t("report.privacyNoticeTitle")}</p>
                  <p>{t("report.privacyNoticeController", { controller: jurisdiction.controllerName })}</p>
                  <p>
                    {hasExtension
                      ? t("report.privacyNoticeExternal", {
                          authority: jurisdiction.externalAuthority.name,
                          months: jurisdiction.feedbackMonths,
                          extension: jurisdiction.feedbackExtensionMonths
                        })
                      : t("report.privacyNoticeExternalNoExtension", {
                          authority: jurisdiction.externalAuthority.name,
                          months: jurisdiction.feedbackMonths
                        })}{" "}
                    <a href={jurisdiction.externalAuthority.url} target="_blank" rel="noreferrer noopener" className="text-cyan-600 underline">
                      {jurisdiction.externalAuthority.name}
                    </a>
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-t border-slate-200 pt-4">
              {step === 2 ? (
                <AppButton type="button" variant="outline" onClick={() => setStep(1)}>
                  {t("common.back")}
                </AppButton>
              ) : (
                <span />
              )}
              <AppButton type="submit" variant={step === 2 ? "secure" : "primary"} icon={step === 2 ? <Shield className="w-4 h-4" /> : undefined}>
                {step === 1 ? t("common.continue") : isHrHandoff ? t("report.routeToHr") : t("report.submitAnonymous")}
              </AppButton>
            </div>
          </form>
        </SecureCard>
      </div>

      <div className="space-y-6">
        <SecureCard title={t("report.safeguardsTitle")} subtitle={t("report.safeguardsSubtitle")}>
          <ul className="space-y-3 text-xs text-slate-700">
            {[
              t("report.safeguard1", { days: jurisdiction.acknowledgementDays, months: jurisdiction.feedbackMonths }),
              t("report.safeguard2"),
              t("report.safeguard3"),
              t("report.safeguard4", { days: jurisdiction.irrelevantDataDeletionDays }),
              t("report.safeguard5")
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SecureCard>

        <SecureCard title={t("report.minimisationTitle")} subtitle={t("report.minimisationSubtitle")}>
          <div className="grid gap-2 text-xs text-slate-700">
            {["analytics", "marketing", "deviceFp", "browserFp", "geo", "ip"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>{t(`report.minimisation.${item}`)}</span>
                <span className="text-emerald-700 font-mono text-[10px] uppercase">{t("report.notCollected")}</span>
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
  pin,
  category
}: {
  generatedCode?: string;
  pin?: string;
  category: ReportCategory;
}) {
  const { t } = useTranslation();
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
      <div className="inline-flex items-center justify-center h-16 w-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full mb-6">
        <ShieldCheck className="w-8 h-8" aria-hidden="true" />
      </div>

      <h1 className="text-xl font-bold text-slate-900 tracking-tight">
        {isHrHandoff ? t("success.titleHr") : t("success.titleReport")}
      </h1>
      <p className="text-xs text-slate-550 mt-2 max-w-sm mx-auto">
        {isHrHandoff ? t("success.subHr") : t("success.subReport")}
      </p>

      {isHrHandoff ? (
        <div className="bg-amber-50 border border-amber-250 rounded-lg p-6 mt-8 text-left text-xs text-slate-700 space-y-3">
          <p className="font-bold text-amber-855">{t("success.hrNoCodeTitle")}</p>
          <p>{t("success.hrNoCodeBody")}</p>
        </div>
      ) : (
        <div className="space-y-6 mt-8">
          <div className="bg-slate-50 border border-slate-205 rounded-lg p-6 relative overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500/70" />
            <div className="flex flex-col gap-6 max-w-sm mx-auto">
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono mb-2">
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" /> {t("success.trackingCodeLabel")}
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200 relative flex items-center justify-between">
                  <span className="text-md font-mono text-slate-900 font-bold select-all tracking-wider">{generatedCode}</span>
                  <button
                    onClick={handleCopy}
                    aria-label={copied ? t("success.copied") : t("success.copy")}
                    className="text-slate-500 hover:text-cyan-600 hover:bg-slate-100 p-2 rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {pin && (
                <div>
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Access PIN (Shown Once)
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-slate-200 relative flex items-center justify-center">
                    <span className="text-md font-mono text-slate-900 font-bold select-all tracking-wider">{pin}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-4 text-left leading-normal" role="note">
            {t("success.cannotIdentify")}
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
  const { t } = useTranslation();
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
      setErrorText(t("track.notFound"));
    }
  };

  const currentCaseMessages = trackedCase ? messages.filter((msg) => msg.caseId === trackedCase.id) : [];

  if (!trackedCase) {
    return (
      <div className="max-w-md mx-auto py-10">
        <SecureCard title={t("track.title")} subtitle={t("track.subtitle")} isEncrypted>
          <form onSubmit={handleTrackSubmit} className="space-y-4">
            <SecureTextField
              label={t("track.codeLabel")}
              id="pin_tracker_field"
              placeholder={t("track.codePlaceholder")}
              required
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              helperText={t("track.codeHelper")}
            />
            {errorText && <div role="alert" className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded border border-rose-200">{errorText}</div>}
            <AppButton type="submit" variant="primary" className="w-full">
              {t("track.openChannel")}
            </AppButton>
          </form>
        </SecureCard>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start max-w-6xl mx-auto leading-relaxed">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 block">{t("track.anonymousCase")}</span>
            <h1 className="text-md font-mono text-slate-800 font-bold">{trackedCase.id}</h1>
          </div>
          <div className="flex gap-2 items-center">
            <CaseStatusBadge status={trackedCase.status} />
            <AppButton size="sm" variant="outline" onClick={() => setTrackedCase(null)}>
              {t("common.exit")}
            </AppButton>
          </div>
        </div>

        <SecureCard title={t("track.progress")} subtitle={t("track.deadlines", { ack: trackedCase.acknowledgementDue, feedback: trackedCase.feedbackDue })}>
          <TimelineWidget events={trackedCase.timeline} />
        </SecureCard>

        <SecureCard title={t("track.addEvidence")} subtitle={t("track.addEvidenceSub")}>
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
              {t("track.submitEvidence")}
            </AppButton>
          </div>
        </SecureCard>
      </div>

      <div className="space-y-6">
        <SecureCard title={t("track.secureConversation")} subtitle={t("track.secureConversationSub")} isEncrypted>
          <div className="max-h-80 overflow-y-auto space-y-3 min-h-48">
            {currentCaseMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs italic">{t("track.noMessages")}</div>
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
            className="mt-4 pt-4 border-t border-slate-200 flex gap-2"
          >
            <label htmlFor="track_message" className="sr-only">{t("track.messagePlaceholder")}</label>
            <input
              id="track_message"
              type="text"
              required
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              placeholder={t("track.messagePlaceholder")}
              className="bg-white text-xs text-slate-900 rounded-lg p-2 flex-grow outline-none border border-slate-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            <button type="submit" aria-label={t("track.sendMessage")} className="bg-cyan-600 hover:bg-cyan-700 text-white p-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </SecureCard>

        <SecureCard title={t("track.metadataPolicy")}>
          <div className="grid gap-2 text-xs">
            {Object.entries(trackedCase.technicalMetadataPolicy).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="text-slate-700">{key.replace(/([A-Z])/g, " $1")}</span>
                <span className="text-emerald-700 font-mono uppercase">{value ? t("track.stored") : t("track.notStored")}</span>
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
  const { t } = useTranslation();
  const jurisdiction = useJurisdiction();
  const total = reports.length;
  const openCount = reports.filter((report) => report.status !== "Closed").length;
  const ackDue = reports.filter((report) => report.status === "Received").length;
  const legalHolds = reports.filter((report) => report.retention.state === "Legal Hold").length;
  const anonymousCount = reports.filter((report) => report.disclosureMode === "Anonymous").length;
  const deletionScheduled = reports.filter((report) => report.retention.state === "Deletion Scheduled").length;

  return (
    <div className="space-y-8 leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <div className="mt-4 md:mt-0 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-650">
          {t("common.activeRole")}: <strong className="text-cyan-700 font-bold">{t(`roles.${activeRole}`)}</strong>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: t("dashboard.totalCases"), val: total, icon: FileText },
          { label: t("dashboard.open"), val: openCount, icon: Clock },
          { label: t("dashboard.needsAck"), val: ackDue, icon: AlertCircle },
          { label: t("dashboard.anonymous"), val: anonymousCount, icon: Shield },
          { label: t("dashboard.deletionScheduled"), val: deletionScheduled + legalHolds, icon: Archive }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-white border border-slate-205 rounded-lg p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10px] font-mono tracking-wider uppercase font-semibold">{item.label}</span>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="text-xl font-bold tracking-tight text-slate-900">{item.val}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SecureCard title={t("dashboard.workflowTitle")} subtitle={t("dashboard.workflowSubtitle")}>
          <ul className="space-y-3 text-xs text-slate-700">
            {[
              t("dashboard.workflow1", { days: jurisdiction.acknowledgementDays }),
              t("dashboard.workflow2", { months: jurisdiction.feedbackMonths }),
              t("dashboard.workflow3"),
              t("dashboard.workflow4", { days: jurisdiction.irrelevantDataDeletionDays }),
              t("dashboard.workflow5")
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </SecureCard>

        <SecureCard title={t("dashboard.analyticsTitle")} subtitle={t("dashboard.analyticsSubtitle")}>
          <p className="text-xs text-slate-700">{t("dashboard.analyticsBody")}</p>
        </SecureCard>

        <SecureCard title={t("dashboard.nextAction")}>
          <p className="text-xs text-slate-700 mb-4">{t("dashboard.nextActionBody")}</p>
          <AppButton variant="primary" onClick={onNavigateToCases} icon={<Filter className="w-4 h-4" />}>
            {t("dashboard.openRegister")}
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
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
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
      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="relative w-full md:flex-1">
          <label htmlFor="case_search" className="sr-only">{t("cases.searchPlaceholder")}</label>
          <input
            id="case_search"
            type="text"
            placeholder={t("cases.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold text-slate-900 outline-none placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-550 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
        </div>
        <label htmlFor="case_status_filter" className="sr-only">{t("cases.headers.status")}</label>
        <select
          id="case_status_filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white text-xs font-semibold border border-slate-300 text-slate-700 rounded-lg px-3.5 py-2 cursor-pointer outline-none w-full md:w-auto focus:border-cyan-500"
        >
          <option value="ALL">{t("cases.allStatuses")}</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      </div>

      <AppTable headers={[t("cases.headers.caseId"), t("cases.headers.category"), t("cases.headers.status"), t("cases.headers.deadlines"), t("cases.headers.retention"), t("cases.headers.assigned"), t("cases.headers.disclosure"), t("cases.headers.action")]}>
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={8} className="text-center py-10 text-slate-500 italic">
              {t("cases.noMatch")}
            </td>
          </tr>
        ) : (
          filtered.map((caseItem) => (
            <tr key={caseItem.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-200">
              <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{caseItem.id}</td>
              <td className="px-4 py-3 text-xs">
                <div className="font-semibold text-slate-900">{categoryLabel(caseItem.category)}</div>
                <div className="text-[11px] text-slate-500 mt-1">{caseItem.department}</div>
              </td>
              <td className="px-4 py-3">
                <CaseStatusBadge status={caseItem.status} />
              </td>
              <td className="px-4 py-3 text-[11px] text-slate-500 font-mono">
                <div>{t("cases.ack")}: {caseItem.acknowledgementDue}</div>
                <div>{t("cases.feedback")}: {caseItem.feedbackDue}</div>
              </td>
              <td className="px-4 py-3 text-xs">
                <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-slate-700">{caseItem.retention.state}</span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-700">{caseItem.assignedInvestigator || t("cases.unassigned")}</td>
              <td className="px-4 py-3 text-xs text-cyan-700">{caseItem.disclosureMode}</td>
              <td className="px-4 py-3">
                <AppButton size="sm" variant="outline" aria-label={`${t("common.open")} ${caseItem.id}`} onClick={() => onSelectCase(caseItem.id)}>
                  {t("common.open")}
                </AppButton>
              </td>
            </tr>
          ))
        )}
      </AppTable>

      <div className="text-[11px] text-slate-500">
        {t("cases.footer", { role: t(`roles.${activeRole}`) })}
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
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start leading-relaxed text-slate-700">
      <div className="xl:col-span-2 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono select-all bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">{caseItem.id}</span>
              <CaseStatusBadge status={caseItem.status} />
              <CaseSeverityBadge severity={caseItem.severity} />
            </div>
            <h1 className="text-md font-bold text-slate-900 mt-2">{categoryLabel(caseItem.category)}</h1>
          </div>
          <div className="text-xs bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-mono">{t("caseDetails.feedbackDue")} </span>
            <span className="font-mono text-emerald-700 font-bold">{caseItem.feedbackDue}</span>
          </div>
        </div>

        <SecureCard title={t("caseDetails.actionCenter")} subtitle={t("caseDetails.actionCenterSub")}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="case_status" className="text-[11px] font-bold text-slate-650 uppercase font-mono block mb-1">{t("caseDetails.statusLabel")}</label>
              <select
                id="case_status"
                value={stateStatus}
                onChange={(e) => setStateStatus(e.target.value as CaseStatus)}
                disabled={!canClose && stateStatus === "Closed"}
                className="bg-white w-full text-xs font-semibold text-slate-800 border border-slate-300 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-cyan-500"
              >
                {statuses.map((status) => (
                  <option key={status} value={status} disabled={status === "Closed" && !canClose}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="case_severity" className="text-[11px] font-bold text-slate-655 text-slate-650 uppercase font-mono block mb-1">{t("caseDetails.severityLabel")}</label>
              <select
                id="case_severity"
                value={stateSeverity}
                onChange={(e) => setStateSeverity(e.target.value as CaseSeverity)}
                className="bg-white w-full text-xs font-semibold text-slate-800 border border-slate-300 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-cyan-500"
              >
                {severities.map((severity) => (
                  <option key={severity} value={severity}>
                    {t(`severity.${severity}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="case_investigator" className="text-[11px] font-bold text-slate-650 uppercase font-mono block mb-1">{t("caseDetails.investigatorLabel")}</label>
              <select
                id="case_investigator"
                value={stateInv}
                onChange={(e) => setStateInv(e.target.value)}
                disabled={!canAssign}
                className="bg-white w-full text-xs font-semibold text-slate-800 border border-slate-300 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-cyan-500 disabled:opacity-60"
              >
                <option value="">{t("caseDetails.unassigned")}</option>
                {users
                  .filter((user) => user.status === "Active")
                  .map((user) => (
                    <option key={user.id} value={user.name}>
                      {user.name} ({t(`roles.${user.role}`)})
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
            <AppButton
              variant="primary"
              onClick={() => {
                onUpdateStatus(caseItem.id, stateStatus);
                onUpdateSeverity(caseItem.id, stateSeverity);
                if (canAssign) onAssignInvestigator(caseItem.id, stateInv);
              }}
            >
              {t("caseDetails.commit")}
            </AppButton>
          </div>
        </SecureCard>

        <SecureCard title={t("caseDetails.synopsis")} subtitle={t("caseDetails.synopsisSub")}>
          <p className="text-xs text-slate-700 leading-relaxed">{caseItem.description}</p>
          {caseItem.attachments.length > 0 && (
            <div className="pt-4 mt-4 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase block mb-2">
                {t("caseDetails.evidenceRefs", { count: caseItem.attachments.length })}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {caseItem.attachments.map((file) => (
                  <div key={file.id} className="bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-200 text-xs font-mono">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate flex items-center gap-2 text-slate-700">
                        <FileText className="w-4 h-4 text-emerald-605 text-emerald-600 shrink-0" aria-hidden="true" /> {file.displayName}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
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

        <SecureCard title={t("caseDetails.timeline")} subtitle={t("caseDetails.timelineSub")}>
          <TimelineWidget events={caseItem.timeline} />
        </SecureCard>
      </div>

      <div className="space-y-6">
        <SecureCard title={t("caseDetails.retentionTitle")} subtitle={t("caseDetails.retentionSub", { date: caseItem.retention.deleteAfter })}>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded bg-slate-50 border border-slate-200 px-3 py-2">
              <span>{t("caseDetails.state")}</span>
              <span className="text-cyan-705 text-cyan-705 text-cyan-700">{caseItem.retention.state}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-slate-50 border border-slate-200 px-3 py-2">
              <span>{t("caseDetails.irrelevantDue")}</span>
              <span className="text-slate-700">{caseItem.retention.irrelevantPersonalDataDeletionDue}</span>
            </div>
            <SecureTextField
              label={t("caseDetails.legalHoldReason")}
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              disabled={!canRetention}
            />
            <div className="flex gap-2">
              <AppButton size="sm" variant="secure" disabled={!canRetention} onClick={() => onRetentionUpdate(caseItem.id, true, holdReason)}>
                {t("caseDetails.applyHold")}
              </AppButton>
              <AppButton size="sm" variant="outline" disabled={!canRetention} onClick={() => onRetentionUpdate(caseItem.id, false)}>
                {t("caseDetails.removeHold")}
              </AppButton>
            </div>
          </div>
        </SecureCard>

        <SecureCard title={t("caseDetails.anonymousMessages")} isEncrypted>
          <div className="max-h-72 overflow-y-auto min-h-48 space-y-3">
            {currentCaseMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs italic">{t("track.noMessages")}</div>
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
            className="mt-4 pt-4 border-t border-slate-200 flex gap-2"
          >
            <label htmlFor="admin_reply" className="sr-only">{t("caseDetails.replyPlaceholder")}</label>
            <input
              id="admin_reply"
              type="text"
              required
              value={adminMsg}
              onChange={(e) => setAdminMsg(e.target.value)}
              placeholder={t("caseDetails.replyPlaceholder")}
              className="bg-white text-xs border border-slate-300 rounded-lg p-2.5 flex-grow text-slate-900 outline-none focus:border-cyan-500"
            />
            <button type="submit" aria-label={t("track.sendMessage")} className="bg-cyan-600 hover:bg-cyan-700 text-white p-2.5 rounded-lg shrink-0 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </SecureCard>

        <SecureCard title={t("caseDetails.restrictedNote")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!noteText.trim()) return;
              onAddInternalNote(caseItem.id, noteText.trim());
              setNoteText("");
            }}
            className="space-y-3"
          >
            <label htmlFor="restricted_note" className="sr-only">{t("caseDetails.restrictedNote")}</label>
            <textarea
              id="restricted_note"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder={t("caseDetails.notePlaceholder")}
              className="w-full bg-white text-xs border border-slate-350 rounded-lg p-3 outline-none text-slate-900 focus:border-cyan-500"
            />
            <AppButton type="submit" variant="outline" size="sm">
              {t("caseDetails.addNote")}
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
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  const [typedSend, setTypedSend] = useState("");
  const trackableCases = reports.filter((report) => Boolean(report.trackingCode));
  const selectedCase = trackableCases[activeCaseIdx] || trackableCases[0];
  const selectedCaseMessages = selectedCase ? messages.filter((msg) => msg.caseId === selectedCase.id) : [];
  const canReply = activeRole !== "Auditor";

  if (!selectedCase) {
    return <div className="text-center py-20 text-slate-500 italic max-w-lg mx-auto">{t("inbox.noChannels")}</div>;
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white grid grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto h-[550px] leading-relaxed shadow-lg">
      <div className="border-r border-slate-200 bg-slate-50 overflow-y-auto divide-y divide-slate-200 h-full">
        <div className="p-4 border-b border-slate-200 bg-slate-100/50 flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-600">{t("inbox.channels")}</span>
          <span className="text-[10px] text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-mono font-bold">{trackableCases.length}</span>
        </div>
        {trackableCases.map((report, idx) => (
          <button
            key={report.id}
            onClick={() => setActiveCaseIdx(idx)}
            aria-current={activeCaseIdx === idx ? "true" : undefined}
            className={`w-full text-left p-4 hover:bg-slate-100 transition-colors cursor-pointer flex flex-col gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
              activeCaseIdx === idx ? "bg-slate-100 border-l-4 border-cyan-600" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-800 font-bold">{report.id}</span>
              <span className="text-[9px] uppercase font-mono text-slate-500">{report.submissionDate.split(" ")[0]}</span>
            </div>
            <div className="text-xs font-bold text-slate-600">{categoryLabel(report.category)}</div>
          </button>
        ))}
      </div>

      <div className="md:col-span-2 flex flex-col justify-between h-full">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-slate-800">{selectedCase.id}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">{categoryLabel(selectedCase.category)}</span>
          </div>
          <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase font-semibold">
            {t("inbox.anonymousChannel")}
          </span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3.5 bg-slate-50/30 h-72">
          {selectedCaseMessages.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-xs italic">{t("inbox.noComms")}</div>
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
          className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2.5"
        >
          <label htmlFor="inbox_reply" className="sr-only">{t("inbox.replyTo", { id: selectedCase.id })}</label>
          <input
            id="inbox_reply"
            type="text"
            required
            disabled={!canReply}
            value={typedSend}
            onChange={(e) => setTypedSend(e.target.value)}
            placeholder={canReply ? t("inbox.replyTo", { id: selectedCase.id }) : t("inbox.auditorReadonly")}
            className="flex-grow bg-white text-xs rounded-lg p-2.5 outline-none border border-slate-300 text-slate-800 focus:border-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canReply}
            aria-label={t("track.sendMessage")}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-200 text-white px-4 rounded-lg font-semibold text-xs py-2 h-10 transition-colors flex items-center justify-center cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function SecurityAuditTrailLogs({ logs, activeRole }: { logs: AuditLog[]; activeRole: AppRole }) {
  const { t } = useTranslation();
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
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("audits.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("audits.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 justify-between shadow-xs">
        <div className="relative w-full md:max-w-xs">
          <label htmlFor="audit_search" className="sr-only">{t("audits.searchPlaceholder")}</label>
          <input
            id="audit_search"
            type="text"
            placeholder={t("audits.searchPlaceholder")}
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" aria-hidden="true" />
          <span className="font-mono text-[10px] text-slate-700">{t("audits.wormNote")}</span>
        </div>
      </div>

      <AppTable headers={[t("audits.headers.timestamp"), t("audits.headers.actor"), t("audits.headers.action"), t("audits.headers.subject"), t("audits.headers.outcome"), t("audits.headers.metadata"), t("audits.headers.seal")]}>
        {filteredLogs.map((log) => (
          <tr key={log.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
            <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
            <td className="px-4 py-3 text-xs text-slate-800">
              <div className="font-bold">{t(`roles.${log.actorRole}`, { defaultValue: log.actorRole })}</div>
              <div className="text-[10px] text-slate-500 font-mono">{log.actorRef}</div>
            </td>
            <td className="px-4 py-3 text-xs text-slate-700">{log.actionType}</td>
            <td className="px-4 py-3 text-xs font-mono text-slate-500">{log.subjectId || "N/A"}</td>
            <td className="px-4 py-3 text-xs text-emerald-700 font-semibold">{log.outcome}</td>
            <td className="px-4 py-3 text-xs text-slate-500 max-w-sm">
              {log.metadataNotice}
              {log.oldValue && log.newValue && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                  <span>{log.oldValue}</span>
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <span className="text-cyan-700">{log.newValue}</span>
                </div>
              )}
            </td>
            <td className="px-4 py-3 text-xs font-mono text-slate-400">{log.hashChain}</td>
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
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("Investigator");
  const canManageUsers = SafeVoiceDb.can(activeRole, "manageUsers");

  return (
    <div className="space-y-8 max-w-5xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("users.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("users.subtitle")}</p>
        </div>
        <AppButton variant="primary" icon={<UserCheck className="w-4 h-4" />} disabled={!canManageUsers} onClick={() => setModalOpen(true)}>
          {t("users.inviteOfficer")}
        </AppButton>
      </div>

      <SecureCard title={t("users.authorizedPersonnel")}>
        <AppTable headers={[t("users.headers.officer"), t("users.headers.role"), t("users.headers.status"), t("users.headers.mfa"), t("users.headers.lastReview")]}>
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50 border-b border-slate-200 text-xs">
              <td className="px-4 py-3 font-bold text-slate-800">
                {user.name}
                <span className="block font-normal text-[10px] text-slate-500 mt-0.5">{user.email}</span>
              </td>
              <td className="px-4 py-3">
                <span className="bg-cyan-50 px-2.5 py-1 rounded border border-cyan-200 text-cyan-700 font-semibold uppercase tracking-wider">{t(`roles.${user.role}`)}</span>
              </td>
              <td className="px-4 py-3 text-slate-700">{user.status}</td>
              <td className="px-4 py-3 text-emerald-700 font-semibold">{user.mfaRequired ? t("users.mfaRequired") : t("users.mfaMissing")}</td>
              <td className="px-4 py-3 text-slate-500 font-mono">{user.lastLoginReview}</td>
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      <SecureCard title={t("users.permissionMatrix")} subtitle={t("users.permissionMatrixSub")}>
        <AppTable headers={[t("users.headers.role"), t("users.headers.view"), t("users.headers.assign"), t("users.headers.close"), t("users.headers.export"), t("users.headers.audits"), t("users.headers.usersCol"), t("users.headers.retention")]}>
          {rolePermissions.map((rule) => (
            <tr key={rule.role} className="hover:bg-slate-50 border-b border-slate-200">
              <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-700 uppercase">{t(`roles.${rule.role}`)}</td>
              {(["viewReports", "assignCases", "closeCases", "exportData", "accessAudits", "manageUsers", "manageRetention"] as const).map((key) => (
                <td key={key} className="px-4 py-3 text-center text-xs">
                  <span className={rule[key] ? "text-emerald-700 font-semibold" : "text-slate-400 font-normal"}>{rule[key] ? t("users.allowed") : t("users.blocked")}</span>
                </td>
              ))}
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      <AppModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t("users.inviteTitle")}>
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
          <SecureTextField label={t("users.officerName")} required value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          <SecureTextField label={t("users.businessEmail")} type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <div>
            <label htmlFor="invite_role" className="text-xs font-bold text-slate-700 uppercase font-mono block mb-1.5">{t("users.role")}</label>
            <select id="invite_role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AppRole)} className="bg-white w-full text-xs font-semibold text-slate-800 border border-slate-300 rounded px-3.5 py-2.5 outline-none cursor-pointer focus:border-cyan-500">
              {rolePermissions.map((role) => (
                <option key={role.role} value={role.role}>
                  {t(`roles.${role.role}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <AppButton type="button" variant="outline" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </AppButton>
            <AppButton type="submit" variant="primary">
              {t("users.inviteWithMfa")}
            </AppButton>
          </div>
        </form>
      </AppModal>
    </div>
  );
}

export function BrandedSettingsView() {
  const { t } = useTranslation();
  const jurisdiction = useJurisdiction();
  const [activeSettingsTab, setActiveSettingsTab] = useState("security");

  const tabs = [
    { key: "security", label: t("settings.tabSecurity"), icon: Lock },
    { key: "retention", label: t("settings.tabRetention"), icon: Clock },
    { key: "legal", label: t("settings.tabLegal"), icon: Scale },
    { key: "review", label: t("settings.tabReview"), icon: FileText }
  ];

  const reviewGroups = useMemo(() => complianceReview, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-6xl mx-auto items-start leading-relaxed">
      <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-1" role="tablist" aria-label={t("nav.complianceSettings")}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeSettingsTab === tab.key}
              onClick={() => setActiveSettingsTab(tab.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                activeSettingsTab === tab.key ? "bg-slate-50 border border-slate-200 text-cyan-700" : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-3">
        {activeSettingsTab === "security" && (
          <SecureCard title={t("settings.securityTitle")} subtitle={t("settings.securitySub")}>
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
                <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="font-bold text-slate-800">{label}</div>
                  <div className="text-slate-600 mt-1">{value}</div>
                </div>
              ))}
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "retention" && (
          <SecureCard title={t("settings.retentionTitle")} subtitle={t("settings.retentionSub")}>
            <div className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="font-bold text-slate-800">{t("settings.defaultRetention")}</div>
                  <div className="text-slate-600 mt-1">{t("settings.defaultRetentionBody", { years: jurisdiction.retentionYears })}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="font-bold text-slate-800">{t("settings.irrelevantData")}</div>
                  <div className="text-slate-600 mt-1">{t("settings.irrelevantDataBody", { days: jurisdiction.irrelevantDataDeletionDays })}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="font-bold text-slate-800">{t("settings.legalHold")}</div>
                  <div className="text-slate-600 mt-1">{t("settings.legalHoldBody")}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="font-bold text-slate-800">{t("settings.secureDestruction")}</div>
                  <div className="text-slate-600 mt-1">{t("settings.secureDestructionBody")}</div>
                </div>
              </div>
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "legal" && (
          <SecureCard title={t("settings.legalTitle")} subtitle={t("settings.legalSub")}>
            <div className="space-y-4 text-xs text-slate-700">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
                  <Scale className="w-4 h-4 text-cyan-700" aria-hidden="true" /> {t("settings.processingBasis")}
                </div>
                <p className="text-slate-600">{t("settings.processingBasisBody")}</p>
              </div>
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
                  <UserCheck className="w-4 h-4 text-cyan-700" aria-hidden="true" /> {t("settings.responsibilities")}
                </div>
                <p className="text-slate-600">{t("settings.responsibilitiesBody")}</p>
              </div>
            </div>
          </SecureCard>
        )}

        {activeSettingsTab === "review" && (
          <SecureCard title={t("settings.reviewTitle")} subtitle={t("settings.reviewSub")}>
            <AppTable headers={[t("settings.reviewHeaders.area"), t("settings.reviewHeaders.feature"), t("settings.reviewHeaders.decision"), t("settings.reviewHeaders.justification"), t("settings.reviewHeaders.risk")]}>
              {reviewGroups.map((item) => (
                <tr key={`${item.area}-${item.classification}`} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-bold text-slate-800">{item.area}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{item.currentFeature}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="bg-cyan-50 border border-cyan-200 rounded px-2 py-1 text-cyan-700 font-mono">{item.classification}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.justification}</td>
                  <td className="px-4 py-3 text-xs text-amber-800 font-semibold">{item.risk}</td>
                </tr>
              ))}
            </AppTable>
          </SecureCard>
        )}
      </div>
    </div>
  );
}
