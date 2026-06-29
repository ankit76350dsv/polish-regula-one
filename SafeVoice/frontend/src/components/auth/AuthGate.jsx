import { AlertTriangle, RefreshCw } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Login from "./Login";
import SafeVoiceAccessModal from "./SafeVoiceAccessModal";
import { evaluateSafeVoiceAccess } from "../../utils/access";
import {
  initSession,
  signOut,
  selectAuthStatus,
  selectAuthError,
  selectCurrentUser,
  selectSsoLoop,
} from "../../slices/authSlice";

// Guard wrapped around the STAFF area only. In priority order: loading → error →
// not-signed-in → no module/expired/disabled → render the protected page.
// Public report/tracking/legal pages are NOT wrapped in this gate.
export default function AuthGate({ children }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);
  const error = useSelector(selectAuthError);
  const user = useSelector(selectCurrentUser);
  const ssoLoop = useSelector(selectSsoLoop);

  // 1. Loading.
  if (status === "idle" || status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 text-sm font-medium">{t("auth.verifying")}</p>
        </div>
      </div>
    );
  }

  // 2. Transient error → retry.
  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
            <AlertTriangle className="text-rose-600" size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">{t("auth.errorTitle")}</h2>
            <p className="text-xs text-slate-500 mt-1">{typeof error === "string" ? error : t("auth.errorBody")}</p>
          </div>
          <button
            type="button"
            onClick={() => dispatch(initSession())}
            className="inline-flex items-center justify-center gap-2 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <RefreshCw size={15} /> {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  // 3. Not signed in → central login flow.
  if (status !== "authenticated" || ssoLoop) {
    return <Login />;
  }

  // 4. Signed in but not allowed into SafeVoice.
  const { allowed, reason } = evaluateSafeVoiceAccess(user);
  if (!allowed) {
    return <SafeVoiceAccessModal reason={reason} onSignOut={() => dispatch(signOut())} />;
  }

  // 5. Allowed.
  return children;
}
