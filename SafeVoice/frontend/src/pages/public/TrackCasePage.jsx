import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Lock, Send, ShieldCheck } from "lucide-react";
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
  trackReport,
} from "../../slices/reportsSlice";
import { addToast } from "../../slices/uiSlice";
import { socketService } from "../../services/socketService";
import { normalizeMessage } from "../../services/caseNormalizer";
import { reportService } from "../../services/reportService";

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
    socketService.connectReporter(accessKey.trim());
    const unsubscribe = socketService.subscribe(`/topic/case.${caseId}`, (frame) => {
      try {
        const message = normalizeMessage(JSON.parse(frame.body));
        dispatch(trackedMessageReceived(message));
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
    if ((!draft.trim() && files.length === 0) || !tracked) return;
    try {
      // The reducer appends the saved message to the thread on success, so the
      // reporter sees it immediately without us re-fetching the whole case.
      await dispatch(
        sendTrackedMessage({
          caseId: tracked.report.id,
          sender: "Anonymous Whistleblower",
          text: draft,
          files,
        }),
      ).unwrap();
      setDraft("");
      setFiles([]);
      dispatch(addToast({ type: "success", message: t("toast.messageSent") }));
    } catch {
      dispatch(addToast({ type: "error", message: t("track.sendError") }));
    }
  }

  // Fetch a file from the reporter's own thread for the preview modal; the access key
  // (baked into this closure) proves ownership.
  const fetchPreview = () =>
    reportService.fetchPublicAttachment({
      accessKey: accessKey.trim(),
      messageId: preview.messageId,
      attachmentId: preview.attachment.id,
    });

  const report = tracked?.report;
  const thread = tracked?.messages || [];

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
                            onOpen={(a) => setPreview({ messageId: message.id, attachment: a })}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form className="flex flex-col gap-2 border-t border-slate-200 pt-4" onSubmit={send}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <label htmlFor="track-msg" className="sr-only">{t("track.messagePlaceholder")}</label>
                  <input
                    id="track-msg"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("track.messagePlaceholder")}
                    className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                  <AppButton type="submit" variant="primary" disabled={sending || (!draft.trim() && files.length === 0)} icon={sending ? null : <Send className="w-4 h-4" />}>
                    {sending ? <Spinner size={16} /> : t("common.send")}
                  </AppButton>
                </div>
                <MessageComposerAttachments files={files} onFilesChanged={setFiles} disabled={sending} />
              </form>
            </div>
          )}
        </SecureCard>
      </div>

      <AttachmentPreviewModal
        open={Boolean(preview)}
        attachment={preview?.attachment}
        onClose={() => setPreview(null)}
        fetchBlob={preview ? fetchPreview : undefined}
      />
    </div>
  );
}
