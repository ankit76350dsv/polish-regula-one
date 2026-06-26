import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, KeyRound, ShieldCheck } from "lucide-react";
import { AppButton } from "../../components/ui";
import { clearSubmission, selectLastSubmission } from "../../slices/reportsSlice";
import { addToast } from "../../slices/uiSlice";

// Shows the ONE access key issued for the just-submitted report. It is the only
// credential the reporter ever gets (identifier + password in one), comes from
// the (mock) backend, and is shown only once. If there is no recent submission
// (e.g. a reload), we send them back to the form rather than show a stale key.
export default function ReportSuccessPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const submission = useSelector(selectLastSubmission);

  useEffect(() => {
    if (!submission) navigate?.("/report");
  }, [submission, navigate]);

  if (!submission) return null;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(submission.accessKey);
      dispatch(addToast({ type: "success", message: t("toast.copyOk") }));
    } catch {
      dispatch(addToast({ type: "error", message: t("toast.genericError") }));
    }
  };

  // Save the key as a plain-text file so the reporter has an offline copy. We
  // build the file in the browser (no upload) and revoke the temporary URL after.
  const downloadKey = () => {
    const content = `${t("success.fileHeading")}\n\n${submission.accessKey}\n\n${t("success.saveWarning")}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "safevoice-access-key.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    dispatch(addToast({ type: "success", message: t("toast.downloaded") }));
  };

  // HR grievances are routed to HR with no anonymous access key.
  const hasKey = Boolean(submission.accessKey);

  return (
    <div className="max-w-xl mx-auto text-center py-2 leading-relaxed">
      <div className="inline-flex items-center justify-center h-16 w-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full mb-6">
        <ShieldCheck className="w-8 h-8" aria-hidden="true" />
      </div>

      <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("success.title")}</h1>

      {!hasKey ? (
        <div className="mt-6 text-left bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4">
          <p className="font-bold text-sm mb-1">{t("success.hrTitle")}</p>
          <p className="text-xs leading-relaxed">{t("success.hrBody")}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">{t("success.subtitle")}</p>

          <div className="space-y-6 mt-8 text-left">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500/70" aria-hidden="true" />
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono mb-3">
                <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                {t("success.accessKey")}
              </div>

              {/* The full 64-char key, wrapped and selectable. */}
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <code className="block font-mono text-sm text-slate-900 font-bold select-all tracking-wide break-all leading-relaxed">
                  {submission.accessKey}
                </code>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">{t("success.accessKeyHint")}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={copyKey}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:text-cyan-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" /> {t("success.copyKey")}
                  </button>
                  <button
                    type="button"
                    onClick={downloadKey}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:text-cyan-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" /> {t("success.downloadKey")}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-4 leading-normal">
              {t("success.saveWarning")}
            </div>

            <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              {t("success.ackInfo")}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap justify-center gap-3 pt-8">
        {hasKey && (
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
  );
}
