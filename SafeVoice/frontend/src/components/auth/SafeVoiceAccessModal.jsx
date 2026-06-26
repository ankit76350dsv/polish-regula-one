import { Lock, LogOut, ShieldAlert } from "lucide-react";

// Shown when a user IS signed in to RegulaOne but is not allowed into the SafeVoice
// staff area. It mirrors RegulaOne's UserDisabled / PlanExpired blocking screens.
// The four reasons come from utils/access.js (evaluateSafeVoiceAccess).
const COPY = {
  disabled: {
    title: "Your account is disabled",
    body: "Your RegulaOne account has been disabled, so SafeVoice access is paused. Please contact your administrator.",
  },
  module: {
    title: "SafeVoice is not in your plan",
    body: "Your organisation's subscription does not include the SafeVoice whistleblower module. Add it in RegulaOne to gain access.",
  },
  package: {
    title: "Subscription expired",
    body: "Your organisation's subscription has expired, so access to SafeVoice is paused. Renew the plan in RegulaOne to restore access.",
  },
};

export default function SafeVoiceAccessModal({ reason, onSignOut }) {
  const copy = COPY[reason] ?? COPY.module;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            RegulaOne · SafeVoice
          </span>
          <Lock className="w-4 h-4 text-white/70" aria-hidden="true" />
        </div>

        <div className="p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <ShieldAlert className="text-amber-600" size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">{copy.title}</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{copy.body}</p>
          </div>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut size={15} /> Sign out
            </button>
          )}

          <p className="text-[11px] text-slate-400">
            Need help? Contact your RegulaOne administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
