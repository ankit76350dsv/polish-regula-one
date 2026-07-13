import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Eye, FileText, Lock, MessageSquare, Send, ShieldCheck } from "lucide-react";
import {
  AppButton,
  AppTable,
  AttachmentPreviewModal,
  ConfirmDialog,
  ErrorState,
  MessageAttachmentList,
  MessageComposerAttachments,
  PageSpinner,
  SecureCard,
  SelectField,
  SeverityBadge,
  Spinner,
  StatusBadge,
  TimelineWidget,
} from "../../components/ui";
import { statusValues, severityValues } from "../../constants/caseFields";
import {
  fetchReport,
  fetchReports,
  selectCurrentReport,
  selectCurrentStatus,
  selectUpdating,
  updateReport,
} from "../../slices/reportsSlice";
import { fetchMessages, messageReceived, selectMessagesFor, selectSending, selectThread, sendMessage } from "../../slices/messagesSlice";
import { fetchUsers, selectUsers } from "../../slices/usersSlice";
import { addToast, setActiveCase, clearActiveCase } from "../../slices/uiSlice";
import { selectCurrentUser } from "../../slices/authSlice";
import { can } from "../../utils/permissions";
import { socketService } from "../../services/socketService";
import { normalizeMessage } from "../../services/caseNormalizer";
import { cryptoService } from "../../services/cryptoService";
import { messageService } from "../../services/messageService";
import { reportService } from "../../services/reportService";

export default function CaseDetailsPage({ caseId, navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const report = useSelector(selectCurrentReport);
  const status = useSelector(selectCurrentStatus);
  const updating = useSelector(selectUpdating);
  const messages = useSelector(selectMessagesFor(caseId));
  const sending = useSelector(selectSending);
  const users = useSelector(selectUsers);
  const currentUser = useSelector(selectCurrentUser);

  // Capability-driven controls (mirrors the user's SAFEVOICE_* permissions).
  const canUpdate = can(currentUser, "assignCases") || can(currentUser, "closeCases");
  const canExport = can(currentUser, "exportData");

  const [pending, setPending] = useState(null); // { field, value, toastKey } | { action }
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState([]); // raw File[] attached to the next message
  const [preview, setPreview] = useState(null); // { messageId, attachment } being previewed

  useEffect(() => {
    dispatch(fetchReport(caseId));
    dispatch(fetchMessages(caseId));
    if (users.length === 0) dispatch(fetchUsers());
  }, [caseId, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live chat: while this case is open, listen on its channel and append any new message
  // (reporter's or another staffer's) instantly. The staff socket is already connected by
  // StaffShell; the backend only lets us listen to cases in our own tenant.
  //
  // We also mark this as the "active" case so the app suppresses the "new reply" toast for
  // it (we are already looking at it) — cleared when we leave the page.
  useEffect(() => {
    dispatch(setActiveCase(caseId));
    const unsubscribe = socketService.subscribe(`/topic/case.${caseId}`, (frame) => {
      try {
        const raw = JSON.parse(frame.body);
        // A live message arrives LOCKED. Unlock it in the browser (staff key path) before it
        // goes into the thread. Files-only/plain messages pass through unchanged.
        cryptoService
          .decryptIncomingStaffMessage(raw, caseId)
          .then((decrypted) => dispatch(messageReceived({ caseId, message: normalizeMessage(decrypted) })))
          .catch(() => {
            /* ignore a message we cannot decrypt rather than break the thread */
          });
      } catch {
        /* ignore malformed frame */
      }
    });
    return () => {
      unsubscribe();
      dispatch(clearActiveCase());
    };
  }, [caseId, dispatch]);

  if (status === "loading" || !report) {
    if (status === "failed") return <ErrorState message={t("case.loadError")} onRetry={() => dispatch(fetchReport(caseId))} />;
    return <PageSpinner label={t("common.loading")} />;
  }

  // Lock the reply composer until the case is genuinely being handled: it must be
  // BOTH moved past "Received" AND assigned to an investigator before any reply
  // goes to the reporter. So the box stays disabled if EITHER is still outstanding
  // — the status is "Received" OR the investigator is unassigned. (Changing the
  // status alone must not unlock replies while the case is nobody's responsibility.)
  const investigatorUnassigned = !report.assignedInvestigator || report.assignedInvestigator === "Unassigned";
  const composerLocked = report.status === "Received" || investigatorUnassigned;

  // A field change opens a confirm dialog first (important / audited action).
  const askChange = (field, value, toastKey) => {
    if (value === report[field]) return;
    setPending({ field, value, toastKey });
  };

  async function confirmPending() {
    if (!pending) return;
    try {
      if (pending.field) {
        await dispatch(updateReport({ id: report.id, patch: { [pending.field]: pending.value } })).unwrap();
        dispatch(addToast({ type: "success", message: t(pending.toastKey) }));
      } else if (pending.action === "export") {
        dispatch(addToast({ type: "success", message: t("toast.exported") }));
      } else if (pending.action === "reviewed") {
        dispatch(addToast({ type: "success", message: t("toast.reviewed") }));
      }
    } catch {
      dispatch(addToast({ type: "error", message: t("toast.genericError") }));
    } finally {
      setPending(null);
    }
  }

  async function send(e) {
    e.preventDefault();
    // Blocked while the case is unhandled (Received + unassigned).
    if (composerLocked) return;
    // A message needs either text or at least one file.
    if (!draft.trim() && files.length === 0) return;
    try {
      await dispatch(sendMessage({ caseId: report.id, text: draft, files })).unwrap();
      setDraft("");
      setFiles([]);
      dispatch(addToast({ type: "success", message: t("toast.messageSent") }));
      // Refresh the shared case list so this case is at the top (latest activity) when
      // the user returns to the inbox or register.
      dispatch(fetchReports());
    } catch {
      dispatch(addToast({ type: "error", message: t("toast.genericError") }));
    }
  }

  // Build the confirm-dialog content from whatever is pending.
  const confirmProps = pending
    ? pending.field === "status"
      ? { title: t("case.confirmStatusTitle"), message: t("case.confirmStatusBody", { value: t(`status.${pending.value}`, pending.value) }) }
      : pending.field
        ? { title: t("case.controls"), message: t("case.confirmStatusBody", { value: pending.value }) }
        : pending.action === "export"
          ? { title: t("case.confirmExportTitle"), message: t("case.confirmExportBody") }
          : { title: t("case.confirmReviewedTitle"), message: t("case.confirmReviewedBody") }
    : {};

  return (
    <div className="space-y-6 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => navigate?.("/cases")} className="text-lg font-bold text-slate-900 tracking-tight hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded">
              {report.caseReference || report.id}
            </button>
            <StatusBadge status={report.status} />
            <SeverityBadge severity={report.severity} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t("case.submittedVia", { category: t(`categories.${report.category}`, report.category), channel: report.intakeChannel })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {report.disclosureMode === "Anonymous" && (
            <AppButton
              type="button"
              variant="outline"
              icon={<MessageSquare className="w-4 h-4" />}
              onClick={() => {
                // Tell the inbox which thread to open, then go there.
                dispatch(selectThread(report.id));
                navigate?.("/messages");
              }}
            >
              {t("case.openInbox")}
            </AppButton>
          )}
          {canExport && (
            <AppButton type="button" variant="outline" icon={<FileText className="w-4 h-4" />} onClick={() => setPending({ action: "export" })}>
              {t("case.exportSummary")}
            </AppButton>
          )}
          {canUpdate && (
            <AppButton type="button" variant="secure" icon={<ShieldCheck className="w-4 h-4" />} onClick={() => setPending({ action: "reviewed" })}>
              {t("case.markReviewed")}
            </AppButton>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SecureCard isEncrypted title={t("case.narrative")} subtitle={t("case.narrativeSub")}>
            <p className="text-sm text-slate-700 leading-relaxed">{report.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5 text-xs">
              {[
                [t("case.incidentDate"), report.incidentDate],
                [t("case.department"), report.department],
                [t("case.disclosureMode"), report.disclosureMode],
                [t("case.lawfulBasis"), report.lawfulBasis],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-500">{label}</div>
                  <div className="mt-1 text-slate-800">{value}</div>
                </div>
              ))}
            </div>
          </SecureCard>

          <SecureCard title={t("case.evidence")} subtitle={t("case.evidenceSub")}>
            {report.attachments.length > 0 ? (
              <AppTable headers={[t("case.evidenceRef"), t("case.evidenceSize"), t("case.evidenceNote"), ""]}>
                {report.attachments.map((file) => (
                  <tr key={file.id} className="border-b border-slate-200">
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{file.displayName}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{file.sizeLabel}</td>
                    <td className="px-4 py-3 text-xs text-emerald-700">{t("case.metadataStripped")}</td>
                    <td className="px-4 py-3 text-right">
                      {canExport && file.storageVaultRef && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreview({
                              attachment: file,
                              fetch: () => reportService.fetchCaseAttachment(report.id, file.id),
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded px-1"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          {t("evidence.view")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </AppTable>
            ) : (
              <p className="text-xs text-slate-500">{t("case.noEvidence")}</p>
            )}
          </SecureCard>

          <SecureCard title={t("case.timeline")} subtitle={t("case.timelineSub")}>
            <TimelineWidget events={report.timeline} />
          </SecureCard>

          <SecureCard isEncrypted title={t("case.communication")} subtitle={t("case.communicationSub")}>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">{t("inbox.empty")}</p>
                ) : (
                  messages.map((message) => {
                    const isReporter = message.sender === "Anonymous Whistleblower";
                    return (
                      <div key={message.id} className={`flex ${isReporter ? "justify-start" : "justify-end"} mb-3`}>
                        <div className={`max-w-[82%] rounded-lg p-3 text-xs shadow-sm border ${isReporter ? "bg-white text-slate-800 border-slate-200" : "bg-cyan-600 text-white border-cyan-500"}`}>
                          <div className="flex items-center justify-between gap-4 border-b border-white/20 pb-1 mb-1">
                            <span className="font-bold">{message.sender}</span>
                            <span className="font-mono text-[10px] opacity-80">{message.timestamp}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                          <MessageAttachmentList
                            attachments={message.attachments}
                            dark={!isReporter}
                            onOpen={
                              canExport
                                ? (a) =>
                                    setPreview({
                                      attachment: a,
                                      fetch: () => messageService.fetchAttachment(report.id, message.id, a.id),
                                    })
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form className="flex flex-col gap-2" onSubmit={send}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <label htmlFor="case-msg" className="sr-only">{t("case.messagePlaceholder")}</label>
                  <input
                    id="case-msg"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("case.messagePlaceholder")}
                    disabled={composerLocked || sending}
                    aria-disabled={composerLocked}
                    className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <AppButton type="submit" variant="primary" disabled={composerLocked || sending || (!draft.trim() && files.length === 0)} icon={sending ? null : <Send className="w-4 h-4" />}>
                    {sending ? <Spinner size={16} /> : t("common.send")}
                  </AppButton>
                </div>
                {composerLocked ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {t("case.composerLocked")}
                  </p>
                ) : (
                  <MessageComposerAttachments files={files} onFilesChanged={setFiles} disabled={sending} />
                )}
              </form>
            </div>
          </SecureCard>
        </div>

        <div className="space-y-6">
          <SecureCard title={t("case.controls")} subtitle={t("case.controlsSub")}>
            <div className="space-y-4">
              <SelectField label={t("case.controlStatus")} value={report.status} onChange={(e) => askChange("status", e.target.value, "toast.statusUpdated")} disabled={updating || !canUpdate}>
                {statusValues.map((s) => (
                  <option key={s} value={s}>{t(`status.${s}`, s)}</option>
                ))}
              </SelectField>
              <SelectField label={t("case.controlSeverity")} value={report.severity} onChange={(e) => askChange("severity", e.target.value, "toast.severityUpdated")} disabled={updating || !canUpdate}>
                {severityValues.map((s) => (
                  <option key={s} value={s}>{t(`severity.${s}`, s)}</option>
                ))}
              </SelectField>
              <SelectField label={t("case.controlInvestigator")} value={report.assignedInvestigator} onChange={(e) => askChange("assignedInvestigator", e.target.value, "toast.assigneeUpdated")} disabled={updating || !canUpdate}>
                <option value="Unassigned">{t("cases.unassigned")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </SelectField>
            </div>
          </SecureCard>

          <SecureCard title={t("case.retention")} subtitle={report.retention.state}>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>{t("case.deleteAfter")}</span>
                <span className="font-mono">{report.retention.deleteAfter}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>{t("case.irrelevantDue")}</span>
                <span className="font-mono">{report.retention.irrelevantPersonalDataDeletionDue}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>{t("case.retentionYears")}</span>
                <span className="font-mono">{t("case.years", { count: report.retention.retentionYears })}</span>
              </div>
            </div>
          </SecureCard>

          {report.riskFlags?.length > 0 && (
            <SecureCard title={t("case.riskFlags")}>
              <div className="flex flex-wrap gap-2">
                {report.riskFlags.map((flag) => (
                  <span key={flag} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    {flag}
                  </span>
                ))}
              </div>
            </SecureCard>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pending)}
        title={confirmProps.title}
        message={confirmProps.message}
        loading={updating}
        tone={pending?.action === "export" ? "primary" : "secure"}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />

      <AttachmentPreviewModal
        open={Boolean(preview)}
        attachment={preview?.attachment}
        onClose={() => setPreview(null)}
        fetchBlob={preview?.fetch}
      />
    </div>
  );
}
