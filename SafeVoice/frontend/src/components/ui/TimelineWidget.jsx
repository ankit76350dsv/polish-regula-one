import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";

export function TimelineWidget({ events }) {
  const { t } = useTranslation();
  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400 italic">
        {t("noEvents")}
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, eventIdx) => (
          <li key={event.id}>
            <div className="relative pb-8">
              {eventIdx !== events.length - 1 && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-px bg-slate-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white ${
                      event.type === "system"
                        ? "bg-white text-emerald-600 border border-emerald-200"
                        : event.type === "status"
                          ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                          : event.type === "retention"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700 border border-slate-300"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-1.5 flex justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-900">
                      {event.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-500 whitespace-nowrap">
                    {event.timestamp}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
