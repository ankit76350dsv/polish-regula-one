import { Lock, LogOut, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

// Shown when a user IS signed in to RegulaOne but may not enter the SafeVoice
// staff area. The reason comes from utils/access.js (evaluateSafeVoiceAccess):
//   disabled | module | package | permission.
export default function SafeVoiceAccessModal({ reason, onSignOut }) {
  const { t } = useTranslation();
  const key = ["disabled", "module", "package", "permission"].includes(reason) ? reason : "module";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">RegulaOne · SafeVoice</span>
          <Lock className="w-4 h-4 text-white/70" aria-hidden="true" />
        </div>

        <div className="p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <ShieldAlert className="text-amber-600" size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">{t(`access.${key}Title`)}</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t(`access.${key}Body`)}</p>
          </div>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <LogOut size={15} /> {t("common.signOut")}
            </button>
          )}

          <p className="text-[11px] text-slate-400">{t("access.needHelp")}</p>
        </div>
      </div>
    </div>
  );
}
