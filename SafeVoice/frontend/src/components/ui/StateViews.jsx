import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

// Shown when a list/section has no data. Keeps empty screens friendly, not blank.
export function EmptyState({ icon: Icon = Inbox, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-500" aria-hidden="true" />
      </div>
      {title ? <p className="text-sm font-semibold text-slate-800">{title}</p> : null}
      {message ? <p className="text-xs text-slate-500 mt-1 max-w-sm">{message}</p> : null}
    </div>
  );
}

// Shown when a request fails. Offers a Retry button when `onRetry` is given.
export function ErrorState({ title, message, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4" role="alert">
      <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5 text-rose-600" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title || t("common.error")}</p>
      {message ? <p className="text-xs text-slate-500 mt-1 max-w-sm">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> {t("common.retry")}
        </button>
      ) : null}
    </div>
  );
}
