import { AlertTriangle, RefreshCw } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
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

// ── AuthGate ──────────────────────────────────────────────────────────────────
// One reusable guard wrapped around the STAFF area only. In priority order:
//   1. loading        → full-screen spinner (while /api/auth/me is in flight)
//   2. error          → error screen with a Retry button (transient /me failure)
//   3. !authenticated → <Login/> (redirects to the central RegulaOne sign-in)
//   4. no module / expired plan / disabled → blocking <SafeVoiceAccessModal/>
//   5. otherwise      → render the protected staff page (children)
//
// It reads the session straight from Redux (so /me is fetched once, in App) and
// decides what to show. The access rule itself lives in utils/access.js.
//
// Public report-submission and report-tracking pages are NOT wrapped in this gate —
// anonymous whistleblowers must reach them without signing in.
export default function AuthGate({ children }) {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);
  const error = useSelector(selectAuthError);
  const user = useSelector(selectCurrentUser);
  const ssoLoop = useSelector(selectSsoLoop);

  // 1. Loading (or not started yet).
  if (status === "idle" || status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 text-sm font-medium">Verifying your session…</p>
        </div>
      </div>
    );
  }

  // 2. Transient error → let the user retry the session check.
  if (status === "error") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
            <AlertTriangle className="text-rose-600" size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Could not verify your session</h2>
            <p className="text-xs text-slate-500 mt-1">
              {typeof error === "string" ? error : "Please try again in a moment."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dispatch(initSession())}
            className="inline-flex items-center justify-center gap-2 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      </div>
    );
  }

  // 3. Not signed in (or stuck in a redirect loop) → the central SSO login flow.
  if (status !== "authenticated" || ssoLoop) {
    return <Login />;
  }

  // 4. Signed in, but not allowed into SafeVoice (disabled / no module / expired plan).
  const { allowed, reason } = evaluateSafeVoiceAccess(user);
  if (!allowed) {
    return <SafeVoiceAccessModal reason={reason} onSignOut={() => dispatch(signOut())} />;
  }

  // 5. Allowed.
  return children;
}
