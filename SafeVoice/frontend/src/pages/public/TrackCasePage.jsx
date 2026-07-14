import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Eye, FileText, Lock, Send, ShieldCheck } from "lucide-react";
import {
  AppButton,
  AttachmentPreviewModal,
  MessageAttachmentList,
  MessageComposerAttachments,
  SecureCard,
  Spinner,
  TextInput,
} from "../../components/ui";
import {
  selectTracked,
  selectTrackError,
  selectTrackSending,
  selectTrackStatus,
  sendTrackedMessage,
  trackedMessageReceived,
  caseStatusUpdated,
  trackReport,
} from "../../slices/reportsSlice";
import { addToast } from "../../slices/uiSlice";
import { socketService } from "../../services/socketService";
import { normalizeMessage } from "../../services/caseNormalizer";
import { reportService } from "../../services/reportService";
import { cryptoService } from "../../services/cryptoService";

// Anonymous status lookup using ONLY the access key, then a secure two-way thread.
export default function TrackCasePage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const tracked = useSelector(selectTracked);
  const trackStatus = useSelector(selectTrackStatus);
  const trackError = useSelector(selectTrackError);
  const sending = useSelector(selectTrackSending);

  const [accessKey, setAccessKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState([]); // raw File[] attached to the next message
  const [preview, setPreview] = useState(null); // { messageId, attachment } being previewed

  const looking = trackStatus === "loading";

  // Once a case is found, open the reporter's realtime connection (authenticated by the
  // access key and pinned to this one case) and subscribe to its channel, so any reply from
  // staff appears instantly. Closes on leave.
  useEffect(() => {
    const caseId = tracked?.report?.id;
    if (!caseId || !accessKey.trim()) return undefined;
    const key = accessKey.trim();
    socketService.connectReporter(key);
    const unsubscribe = socketService.subscribe(`/topic/case.${caseId}`, (frame) => {
      try {
        const raw = JSON.parse(frame.body);
        // A status change arrives as a CASE_UPDATE frame (not a message) — apply it live so the
        // status badge and the post-close reply window update instantly, no refresh needed.
        if (raw?.type === "CASE_UPDATE") {
          dispatch(caseStatusUpdated(raw));
          return;
        }
        // A live message arrives LOCKED. Unlock it in the browser (using our access key) before
        // it goes into the thread, so the reporter sees readable text. Files-only/plain messages
        // pass through unchanged.
        cryptoService
          .decryptIncomingReporterMessage(raw, key)
          .then((decrypted) => dispatch(trackedMessageReceived(normalizeMessage(decrypted))))
          .catch(() => {
            /* ignore a message we cannot decrypt rather than break the thread */
          });
      } catch {
        /* ignore malformed frame */
      }
    });
    return () => {
      unsubscribe();
      socketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked?.report?.id]);

  function lookup(e) {
    e.preventDefault();
    if (!accessKey.trim()) {
      setKeyError(t("validation.required"));
      return;
    }
    setKeyError("");
    dispatch(trackReport({ accessKey }));
  }

  async function send(e) {
    e.preventDefault();
    if (!replyWindowOpen) return; // closed and past the grace window
    if ((!draft.trim() && files.length === 0) || !tracked) return;
    try {
      // The reducer appends the saved message to the thread on success, so the
      // reporter sees it immediately without us re-fetching the whole case.
      await dispatch(
        sendTrackedMessage({
          caseId: tracked.report.id,
          text: draft,
          files,
          accessKey: accessKey.trim(), // proves ownership of this case
          tenantId: tracked.report.tenantId, // lets the browser fetch a key to lock the text
        }),
      ).unwrap();
      setDraft("");
      setFiles([]);
      dispatch(addToast({ type: "success", message: t("toast.messageSent") }));
    } catch {
      dispatch(addToast({ type: "error", message: t("track.sendError") }));
    }
  }

  const report = tracked?.report;
  const thread = tracked?.messages || [];

  // After a case is CLOSED the reporter may still send a final message for a limited
  // grace window (48h, matching the backend default). Reading stays open forever; only
  // sending is time-boxed. The backend enforces this too — this is the UX layer.
  const REPORTER_GRACE_HOURS = 48;
  const caseClosed = report?.status === "Closed";
  const graceEndsMs = report?.closedAt
    ? new Date(report.closedAt).getTime() + REPORTER_GRACE_HOURS * 60 * 60 * 1000
    : null;
  // Window is open while the case is active, or while still inside the post-close grace.
  const replyWindowOpen = !caseClosed || (graceEndsMs != null && Date.now() < graceEndsMs);
  const graceEndsLabel = graceEndsMs ? new Date(graceEndsMs).toLocaleString() : "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start leading-relaxed">
      <div className="lg:col-span-1 space-y-6">
        <SecureCard title={t("track.title")} subtitle={t("track.subtitle")}>
          <form className="space-y-4" onSubmit={lookup} noValidate>
            <TextInput
              label={t("track.keyLabel")}
              required
              placeholder={t("track.keyPlaceholder")}
              hint={t("track.keyHint")}
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              error={keyError}
              autoComplete="off"
              spellCheck={false}
              className="[&_input]:font-mono"
            />
            <AppButton type="submit" variant="primary" disabled={looking} icon={looking ? null : <ShieldCheck className="w-4 h-4" />}>
              {looking ? <Spinner size={16} label={t("track.lookingUp")} /> : t("track.lookup")}
            </AppButton>
            {trackStatus === "failed" && (
              <p role="alert" className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
                {trackError === "notFound" ? t("track.notFound") : t("common.error")}
              </p>
            )}
          </form>
        </SecureCard>

        {report && (
          <SecureCard title={t("track.statusTitle")} subtitle={report.id}>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>{t("common.status")}</span>
                <span className="font-semibold text-cyan-700">{t(`status.${report.status}`, report.status)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>{t("track.ackDue")}</span>
                <span className="font-mono text-slate-600">{report.acknowledgementDue}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>{t("track.feedbackDue")}</span>
                <span className="font-mono text-slate-600">{report.feedbackDue}</span>
              </div>
            </div>
          </SecureCard>
        )}

        {report && (
          <SecureCard isEncrypted title={t("track.detailsTitle")} subtitle={t("track.detailsSub")}>
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("track.narrative")}</div>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {report.description || "—"}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs">
                {[
                  [t("track.category"), t(`categories.${report.category}`, report.category)],
                  [t("track.incidentDate"), report.incidentDate],
                  [t("track.department"), report.department],
                  [t("track.disclosureMode"), report.disclosureMode],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-800 text-right break-words">{value || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </SecureCard>
        )}

        {report && (
          <SecureCard title={t("track.evidenceTitle")} subtitle={t("track.evidenceSub")}>
            {report.attachments && report.attachments.length > 0 ? (
              <ul className="space-y-2">
                {report.attachments.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">{file.displayName}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] font-mono text-slate-500">
                        {file.sizeLabel} · {t("track.metadataStripped")}
                      </div>
                    </div>
                    {file.storageVaultRef && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreview({
                            attachment: file,
                            fetch: () =>
                              reportService.fetchPublicCaseAttachment({
                                accessKey: accessKey.trim(),
                                attachmentId: file.id,
                              }),
                          })
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded px-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        {t("evidence.view")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">{t("track.noEvidence")}</p>
            )}
          </SecureCard>
        )}
      </div>

      <div className="lg:col-span-2">
        <SecureCard isEncrypted title={t("track.threadTitle")} subtitle={t("track.threadSubtitle")}>
          {!report ? (
            <p className="text-xs text-slate-500">{t("track.emptyThread")}</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs flex items-start gap-2">
                <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                {t("track.threadSubtitle")}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 max-h-[32rem] overflow-y-auto">
                {thread.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">{t("track.emptyThread")}</p>
                ) : (
                  thread.map((message) => {
                    const isReporter = message.sender === "Anonymous Whistleblower";
                    return (
                      <div key={message.id} className={`flex ${isReporter ? "justify-end" : "justify-start"} mb-4`}>
                        <div
                          className={`max-w-[82%] rounded-lg p-3.5 text-xs shadow-sm border ${
                            isReporter ? "bg-cyan-600 text-white border-cyan-500" : "bg-white text-slate-800 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-5 mb-1.5 border-b border-white/20 pb-1">
                            <span className="font-semibold">{isReporter ? t("track.you") : message.sender}</span>
                            <span className="text-[9px] font-mono opacity-80">{message.timestamp}</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
                          <MessageAttachmentList
                            attachments={message.attachments}
                            dark={isReporter}
                            onOpen={(a) =>
                              setPreview({
                                attachment: a,
                                fetch: () =>
                                  reportService.fetchPublicAttachment({
                                    accessKey: accessKey.trim(),
                                    messageId: message.id,
                                    attachmentId: a.id,
                                  }),
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {caseClosed && (
                <p className={`text-xs rounded-lg px-3 py-2 border ${
                  replyWindowOpen
                    ? "text-amber-800 bg-amber-50 border-amber-200"
                    : "text-slate-600 bg-slate-50 border-slate-200"
                }`}>
                  {replyWindowOpen
                    ? t("track.closedGraceInfo", { time: graceEndsLabel })
                    : t("track.closedEnded")}
                </p>
              )}

              <form className="flex flex-col gap-2 border-t border-slate-200 pt-4" onSubmit={send}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <label htmlFor="track-msg" className="sr-only">{t("track.messagePlaceholder")}</label>
                  <input
                    id="track-msg"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("track.messagePlaceholder")}
                    disabled={sending || !replyWindowOpen}
                    aria-disabled={!replyWindowOpen}
                    className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <AppButton type="submit" variant="primary" disabled={sending || !replyWindowOpen || (!draft.trim() && files.length === 0)} icon={sending ? null : <Send className="w-4 h-4" />}>
                    {sending ? <Spinner size={16} /> : t("common.send")}
                  </AppButton>
                </div>
                {replyWindowOpen && <MessageComposerAttachments files={files} onFilesChanged={setFiles} disabled={sending} />}
              </form>
            </div>
          )}
        </SecureCard>
      </div>

      <AttachmentPreviewModal
        open={Boolean(preview)}
        attachment={preview?.attachment}
        onClose={() => setPreview(null)}
        fetchBlob={preview?.fetch}
      />
    </div>
  );
}
