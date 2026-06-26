import { Lock, Send } from "lucide-react";
import { AppButton, SecureCard } from "../../components/ui";
import { messages, reports } from "../staticData";

export default function CentralEncryptedInboxPage() {
  const selectedReport = reports[0];
  const selectedMessages = messages.filter((message) => message.caseId === selectedReport.id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[22rem_1fr] gap-6 max-w-6xl mx-auto leading-relaxed">
      <SecureCard title="Encrypted inbox" subtitle="Case threads">
        <div className="space-y-2">
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              className={`w-full text-left rounded-lg border p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                report.id === selectedReport.id
                  ? "border-cyan-200 bg-cyan-50"
                  : "border-slate-200 bg-slate-50 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-900">{report.id}</span>
                <span className="text-[10px] font-mono text-slate-500">{report.status}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{report.category}</p>
            </button>
          ))}
        </div>
      </SecureCard>

      <SecureCard isEncrypted title={`Thread ${selectedReport.id}`} subtitle="Two-way anonymous communication">
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            Staff can view the conversation layout, but this phase does not send or persist messages.
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 min-h-[24rem]">
            {selectedMessages.map((message) => {
              const reporter = message.sender === "Anonymous Whistleblower";
              return (
                <div key={message.id} className={`flex ${reporter ? "justify-start" : "justify-end"} mb-4`}>
                  <div className={`max-w-[80%] rounded-lg p-3 text-xs shadow-sm border ${
                    reporter
                      ? "bg-white text-slate-800 border-slate-200"
                      : "bg-cyan-600 text-white border-cyan-500"
                  }`}>
                    <div className="flex items-center justify-between gap-5 mb-1.5 border-b border-slate-200/40 pb-1">
                      <span className="font-semibold">{message.sender}</span>
                      <span className="text-[9px] font-mono opacity-80">{message.timestamp}</span>
                    </div>
                    <p>{message.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 border-t border-slate-200 pt-4">
            <input
              defaultValue="Add a careful follow-up question."
              className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            <AppButton type="button" variant="primary" icon={<Send className="w-4 h-4" />}>
              Send
            </AppButton>
          </div>
        </div>
      </SecureCard>
    </div>
  );
}
