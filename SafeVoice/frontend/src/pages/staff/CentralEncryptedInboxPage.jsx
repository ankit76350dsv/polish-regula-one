import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Lock, Send } from "lucide-react";
import { AppButton, EmptyState, PageSpinner, SecureCard, Spinner } from "../../components/ui";
import { fetchReports, selectReports, selectReportsStatus } from "../../slices/reportsSlice";
import { fetchMessages, selectMessagesFor, selectSending, sendMessage } from "../../slices/messagesSlice";
import { addToast } from "../../slices/uiSlice";

export default function CentralEncryptedInboxPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const reports = useSelector(selectReports);
  const status = useSelector(selectReportsStatus);
  const sending = useSelector(selectSending);

  // Only anonymous cases have a two-way reporter thread. The list no longer exposes the
  // access-key hash (a credential — it must never leave the server), so we identify them
  // by their disclosure mode instead.
  const threads = reports.filter((r) => r.disclosureMode === "Anonymous");
  const [selectedId, setSelectedId] = useState(null);
  const activeId = selectedId || threads[0]?.id || null;
  // The readable reference (e.g. "SV/2026/0629/1408") for the open thread, used in the
  // header instead of the raw database id. Falls back to the id if not loaded yet.
  const activeThread = threads.find((r) => r.id === activeId);
  const activeRef = activeThread?.caseReference || activeId;
  const messages = useSelector(selectMessagesFor(activeId));
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (status === "idle") dispatch(fetchReports());
  }, [status, dispatch]);

  useEffect(() => {
    if (activeId) dispatch(fetchMessages(activeId));
  }, [activeId, dispatch]);

  if (status === "loading" && reports.length === 0) return <PageSpinner label={t("common.loading")} />;

  async function send(e) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    try {
      await dispatch(sendMessage({ caseId: activeId, sender: "Compliance Officer", text: draft })).unwrap();
      setDraft("");
      dispatch(addToast({ type: "success", message: t("toast.messageSent") }));
    } catch {
      dispatch(addToast({ type: "error", message: t("toast.genericError") }));
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto leading-relaxed">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("inbox.title")}</h1>
        <p className="text-xs text-slate-500 mt-1">{t("inbox.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[22rem_1fr] gap-6">
        <SecureCard title={t("inbox.threadsTitle")} subtitle={t("inbox.subtitle")}>
          {threads.length === 0 ? (
            <EmptyState title={t("inbox.empty")} />
          ) : (
            <div className="space-y-2">
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
                  <div className="flex items-center justify-between gap-3">
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
          <SecureCard isEncrypted title={t("inbox.thread", { id: activeRef })} subtitle={t("inbox.twoWay")}>
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                {t("inbox.twoWay")}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 min-h-[24rem] max-h-[32rem] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">{t("inbox.empty")}</p>
                ) : (
                  messages.map((message) => {
                    const isReporter = message.sender === "Anonymous Whistleblower";
                    return (
                      <div key={message.id} className={`flex ${isReporter ? "justify-start" : "justify-end"} mb-4`}>
                        <div className={`max-w-[80%] rounded-lg p-3 text-xs shadow-sm border ${isReporter ? "bg-white text-slate-800 border-slate-200" : "bg-cyan-600 text-white border-cyan-500"}`}>
                          <div className="flex items-center justify-between gap-5 mb-1.5 border-b border-white/20 pb-1">
                            <span className="font-semibold">{message.sender}</span>
                            <span className="text-[9px] font-mono opacity-80">{message.timestamp}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{message.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 border-t border-slate-200 pt-4" onSubmit={send}>
                <label htmlFor="inbox-msg" className="sr-only">{t("inbox.messagePlaceholder")}</label>
                <input
                  id="inbox-msg"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("inbox.messagePlaceholder")}
                  className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <AppButton type="submit" variant="primary" disabled={sending || !draft.trim()} icon={sending ? null : <Send className="w-4 h-4" />}>
                  {sending ? <Spinner size={16} /> : t("common.send")}
                </AppButton>
              </form>
            </div>
          </SecureCard>
        ) : (
          <SecureCard title={t("inbox.title")}>
            <EmptyState title={t("inbox.selectThread")} />
          </SecureCard>
        )}
      </div>
    </div>
  );
}
