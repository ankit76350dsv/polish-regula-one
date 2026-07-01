import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { FileText, Lock, Send } from "lucide-react";
import {
  AppButton,
  AttachmentPreviewModal,
  EmptyState,
  MessageAttachmentList,
  MessageComposerAttachments,
  PageSpinner,
  SecureCard,
  Spinner,
} from "../../components/ui";
import { fetchReports, selectReports, selectReportsStatus } from "../../slices/reportsSlice";
import {
  clearSelectedThread,
  fetchMessages,
  messageReceived,
  selectMessagesFor,
  selectSelectedThreadId,
  selectSending,
  sendMessage,
} from "../../slices/messagesSlice";
import { addToast, setActiveCase, clearActiveCase } from "../../slices/uiSlice";
import { selectCurrentUser } from "../../slices/authSlice";
import { can } from "../../utils/permissions";
import { socketService } from "../../services/socketService";
import { normalizeMessage } from "../../services/caseNormalizer";
import { messageService } from "../../services/messageService";

export default function CentralEncryptedInboxPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const reports = useSelector(selectReports);
  const status = useSelector(selectReportsStatus);
  const sending = useSelector(selectSending);

  // Only anonymous cases have a two-way reporter thread. The list no longer exposes the
  // access-key hash (a credential — it must never leave the server), so we identify them
  // by their disclosure mode instead.
  const threads = reports.filter((r) => r.disclosureMode === "Anonymous");
  // If we arrived here from a case's detail page ("Open in inbox"), start on that thread.
  // Otherwise NO thread is open until the user clicks one — we do not auto-open the first.
  const preselectId = useSelector(selectSelectedThreadId);
  const [selectedId, setSelectedId] = useState(preselectId);
  const activeId = selectedId || null;
  // The readable reference (e.g. "SV/2026/0629/1408") for the open thread, used in the
  // header instead of the raw database id. Falls back to the id if not loaded yet.
  const activeThread = threads.find((r) => r.id === activeId);
  const activeRef = activeThread?.caseReference || activeId;
  const messages = useSelector(selectMessagesFor(activeId));
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState([]); // raw File[] attached to the next message
  const [preview, setPreview] = useState(null); // { messageId, attachment } being previewed
  const currentUser = useSelector(selectCurrentUser);
  const canExport = can(currentUser, "exportData");

  useEffect(() => {
    if (status === "idle") dispatch(fetchReports());
  }, [status, dispatch]);

  // We have used the "open this thread" hint from the case page — forget it so a later
  // plain visit to the inbox starts on the first thread, not this stale one.
  useEffect(() => {
    if (preselectId) dispatch(clearSelectedThread());
  }, [preselectId, dispatch]);

  useEffect(() => {
    if (activeId) dispatch(fetchMessages(activeId));
  }, [activeId, dispatch]);

  // Live chat for the open thread: subscribe to the active case's channel and append new
  // messages instantly. Re-subscribes whenever the selected thread changes. We also mark
  // the open thread as the "active" case so its "new reply" toast is suppressed.
  useEffect(() => {
    if (!activeId) return undefined;
    dispatch(setActiveCase(activeId));
    const unsubscribe = socketService.subscribe(`/topic/case.${activeId}`, (frame) => {
      try {
        const message = normalizeMessage(JSON.parse(frame.body));
        dispatch(messageReceived({ caseId: activeId, message }));
      } catch {
        /* ignore malformed frame */
      }
    });
    return () => {
      unsubscribe();
      dispatch(clearActiveCase());
    };
  }, [activeId, dispatch]);

  if (status === "loading" && reports.length === 0) return <PageSpinner label={t("common.loading")} />;

  async function send(e) {
    e.preventDefault();
    if ((!draft.trim() && files.length === 0) || !activeId) return;
    try {
      await dispatch(sendMessage({ caseId: activeId, text: draft, files })).unwrap();
      setDraft("");
      setFiles([]);
      dispatch(addToast({ type: "success", message: t("toast.messageSent") }));
      // Refresh the thread list so this case jumps to the top (it now has the latest
      // activity), matching the WhatsApp-style ordering the backend returns.
      dispatch(fetchReports());
    } catch {
      dispatch(addToast({ type: "error", message: t("toast.genericError") }));
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5 leading-relaxed">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("inbox.title")}</h1>
        <p className="text-xs text-slate-500 mt-1">{t("inbox.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]">
        <SecureCard title={t("inbox.threadsTitle")} subtitle={t("inbox.subtitle")} className="min-w-0 self-start">
          {threads.length === 0 ? (
            <EmptyState title={t("inbox.empty")} />
          ) : (
            <div className="max-h-[calc(100vh-17rem)] space-y-2 overflow-y-auto pr-1">
              {threads.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  aria-current={report.id === activeId ? "true" : undefined}
                  onClick={() => setSelectedId(report.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    report.id === activeId ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate">{report.caseReference || report.id}</span>
                      {report.unreadCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-bold shrink-0"
                          title={t("cases.unreadMessages", { count: report.unreadCount })}
                          aria-label={t("cases.unreadMessages", { count: report.unreadCount })}
                        >
                          {report.unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">{t(`status.${report.status}`, report.status)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{t(`categories.${report.category}`, report.category)}</p>
                </button>
              ))}
            </div>
          )}
        </SecureCard>

        {activeId ? (
          <SecureCard
            isEncrypted
            className="min-w-0 self-start"
            title={t("inbox.thread", { id: activeRef })}
            subtitle={t("inbox.twoWay")}
            headerAction={
              <AppButton type="button" size="sm" variant="outline" icon={<FileText className="w-4 h-4" />} onClick={() => navigate?.(`/cases/${activeId}`)}>
                {t("inbox.openCase")}
              </AppButton>
            }
          >
            <div className="min-w-0 space-y-4">
              <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                {t("inbox.twoWay")}
              </div>

              <div className="min-h-[24rem] max-h-[calc(100vh-18rem)] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">{t("inbox.empty")}</p>
                ) : (
                  messages.map((message) => {
                    const isReporter = message.sender === "Anonymous Whistleblower";
                    return (
                      <div key={message.id} className={`flex min-w-0 ${isReporter ? "justify-start" : "justify-end"} mb-4`}>
                        <div className={`max-w-[min(86%,44rem)] min-w-0 rounded-lg p-3 text-xs shadow-sm border ${isReporter ? "bg-white text-slate-800 border-slate-200" : "bg-cyan-600 text-white border-cyan-500"}`}>
                          <div className="mb-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-1 border-b border-white/20 pb-1">
                            <span className="min-w-0 font-semibold break-words">{message.sender}</span>
                            <span className="shrink-0 text-[9px] font-mono opacity-80">{message.timestamp}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words">{message.text}</p>
                          <MessageAttachmentList
                            attachments={message.attachments}
                            dark={!isReporter}
                            onOpen={
                              canExport
                                ? (a) => setPreview({ messageId: message.id, attachment: a })
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form className="flex min-w-0 flex-col gap-2 border-t border-slate-200 pt-4" onSubmit={send}>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label htmlFor="inbox-msg" className="sr-only">{t("inbox.messagePlaceholder")}</label>
                  <input
                    id="inbox-msg"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("inbox.messagePlaceholder")}
                    className="min-w-0 rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                  <AppButton type="submit" variant="primary" disabled={sending || (!draft.trim() && files.length === 0)} icon={sending ? null : <Send className="w-4 h-4" />}>
                    {sending ? <Spinner size={16} /> : t("common.send")}
                  </AppButton>
                </div>
                <MessageComposerAttachments files={files} onFilesChanged={setFiles} disabled={sending} />
              </form>
            </div>
          </SecureCard>
        ) : (
          <SecureCard title={t("inbox.title")}>
            <EmptyState title={t("inbox.selectThread")} />
          </SecureCard>
        )}
      </div>

      <AttachmentPreviewModal
        open={Boolean(preview)}
        attachment={preview?.attachment}
        onClose={() => setPreview(null)}
        fetchBlob={
          preview
            ? () => messageService.fetchAttachment(activeId, preview.messageId, preview.attachment.id)
            : undefined
        }
      />
    </div>
  );
}
