import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Check, Copy, Lock, ShieldCheck } from "lucide-react";
import { AppButton } from "../../components/ui";
import { clearSubmission, selectLastSubmission } from "../../slices/reportsSlice";
import { addToast } from "../../slices/uiSlice";

// Shows the tracking code + PIN issued for the just-submitted report. These come
// from the (mock) backend in state — never hard-coded — and are shown only once.
// If there is no recent submission (e.g. the user reloaded), we send them back to
// the form rather than show stale credentials.
export default function ReportSuccessPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const submission = useSelector(selectLastSubmission);

  useEffect(() => {
    if (!submission) navigate?.("/report");
  }, [submission, navigate]);

  if (!submission) return null;

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      dispatch(addToast({ type: "success", message: t("toast.copyOk") }));
    } catch {
      dispatch(addToast({ type: "error", message: t("toast.genericError") }));
    }
  };

  // HR grievances are routed to HR with no anonymous tracking PIN.
  const hasPin = Boolean(submission.pin);

  return (
    <div className="max-w-xl mx-auto text-center py-2 leading-relaxed">
      <div className="inline-flex items-center justify-center h-16 w-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full mb-6">
        <ShieldCheck className="w-8 h-8" aria-hidden="true" />
      </div>

      <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("success.title")}</h1>
      <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">{t("success.subtitle")}</p>

      <div className="space-y-6 mt-8 text-left">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500/70" aria-hidden="true" />
          <div className="flex flex-col gap-6 max-w-sm mx-auto">
            <div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono mb-2">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                {t("success.trackingCode")}
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-md font-mono text-slate-900 font-bold select-all tracking-wider">
                  {submission.trackingCode}
                </span>
                <button
                  type="button"
                  aria-label={t("success.copyCode")}
                  onClick={() => copy(submission.trackingCode)}
                  className="text-slate-500 hover:text-cyan-600 hover:bg-slate-100 p-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {hasPin && (
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {t("success.pin")}
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-md font-mono text-slate-900 font-bold select-all tracking-wider">
                    {submission.pin}
                  </span>
                  <button
                    type="button"
                    aria-label={t("success.copyPin")}
                    onClick={() => copy(submission.pin)}
                    className="text-slate-500 hover:text-cyan-600 hover:bg-slate-100 p-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {hasPin && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-4 leading-normal">
            {t("success.saveWarning")}
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {t("success.ackInfo")}
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {hasPin && (
            <AppButton
              type="button"
              variant="primary"
              icon={<ShieldCheck className="w-4 h-4" />}
              onClick={() => {
                dispatch(clearSubmission());
                navigate?.("/track");
              }}
            >
              {t("success.goTrack")}
            </AppButton>
          )}
          <AppButton
            type="button"
            variant="outline"
            onClick={() => {
              dispatch(clearSubmission());
              navigate?.("/report");
            }}
          >
            {t("success.newReport")}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
