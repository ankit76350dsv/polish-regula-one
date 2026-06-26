import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";

export function ChatBubble({ sender, text, timestamp, attachments = [] }) {
  const { t } = useTranslation();
  const isReporter =
    sender === "Reporter" || sender === "Anonymous Whistleblower";

  return (
    <div
      className={`flex ${isReporter ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-[78%] rounded-lg p-3.5 text-xs shadow-md border ${
          isReporter
            ? "bg-slate-50 text-slate-800 border-slate-200"
            : "bg-cyan-600 text-white border-cyan-500/20"
        }`}
      >
        <div className="flex items-center justify-between gap-5 mb-1.5 border-b border-slate-200/40 pb-1">
          <span
            className={`font-semibold ${isReporter ? "text-cyan-700" : "text-white"}`}
          >
            {isReporter ? t("chat.anonymousReporter") : sender}
          </span>
          <span
            className={`text-[9px] font-mono ${isReporter ? "text-slate-500" : "text-cyan-105"}`}
          >
            {timestamp}
          </span>
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{text}</p>

        {attachments.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/60">
            <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">
              {t("chat.evidenceRefs")}
            </span>
            <div className="space-y-1 mt-1">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-700 bg-white px-2 py-1 rounded border border-slate-200"
                >
                  <CheckCircle2
                    className="w-3 h-3 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span className="truncate">{file.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
