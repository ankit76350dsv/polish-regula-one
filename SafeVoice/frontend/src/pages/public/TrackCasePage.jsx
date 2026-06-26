import { Lock, Send, ShieldCheck, Upload } from "lucide-react";
import { AppButton, SecureCard } from "../components/ui";
import { messages, reports } from "./staticData";

export default function TrackCasePage() {
  const report = reports[0];
  const reportMessages = messages.filter((message) => message.caseId === report.id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start leading-relaxed">
      <div className="lg:col-span-1 space-y-6">
        <SecureCard title="Track a report" subtitle="Anonymous status lookup">
          <div className="space-y-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              Tracking code
              <input
                defaultValue={report.trackingCode}
                className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              Access PIN
              <input
                defaultValue="482913"
                type="password"
                className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </label>
            <AppButton type="button" variant="primary" icon={<ShieldCheck className="w-4 h-4" />}>
              View status
            </AppButton>
          </div>
        </SecureCard>

        <SecureCard title="Case status" subtitle={report.id}>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <span>Status</span>
              <span className="font-semibold text-cyan-700">{report.status}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <span>Acknowledgement due</span>
              <span className="font-mono text-slate-600">{report.acknowledgementDue}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <span>Feedback due</span>
              <span className="font-mono text-slate-600">{report.feedbackDue}</span>
            </div>
          </div>
        </SecureCard>
      </div>

      <div className="lg:col-span-2">
        <SecureCard isEncrypted title="Secure message thread" subtitle="Static conversation preview">
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs flex items-start gap-2">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              Messages are presented as UI only. Sending and evidence upload are intentionally inactive.
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 max-h-[32rem] overflow-y-auto">
              {reportMessages.map((message) => {
                const reporter = message.sender === "Anonymous Whistleblower";
                return (
                  <div
                    key={message.id}
                    className={`flex ${reporter ? "justify-end" : "justify-start"} mb-4`}
                  >
                    <div
                      className={`max-w-[82%] rounded-lg p-3.5 text-xs shadow-sm border ${
                        reporter
                          ? "bg-white text-slate-800 border-slate-200"
                          : "bg-cyan-600 text-white border-cyan-500"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-5 mb-1.5 border-b border-slate-200/40 pb-1">
                        <span className="font-semibold">{message.sender}</span>
                        <span className="text-[9px] font-mono opacity-80">{message.timestamp}</span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
                      {message.attachments?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200/50 text-[10px] font-mono">
                          {message.attachments.map((file) => (
                            <span key={file.id}>{file.displayName}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 border-t border-slate-200 pt-4">
              <input
                defaultValue="Thank you. I can add one more supporting document."
                className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Attach evidence"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </SecureCard>
      </div>
    </div>
  );
}
