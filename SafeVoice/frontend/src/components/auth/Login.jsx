import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import {
  SSO_CALLBACK_URL,
  registerSsoRedirect,
  clearSsoRedirectGuard,
  CENTRAL_LOGIN_URL,
} from "../../services/api";

// SIMPLE EXPLANATION:
// SafeVoice has no login form of its own. When a staff member opens a protected page
// without a valid session, this screen sends the browser to the central RegulaOne login
// page, which signs them in and sends them back here.
//
// LOOP PROTECTION (why this exists):
// If the session cookie is not valid for the address being used (common right after a
// machine's IP changes — the old cookie was set for the old host), the login keeps bouncing
// us back and failing. To the user that looks like the page "keeps reloading". The shared
// redirect counter (registerSsoRedirect) stops us after a few tries and shows the reason.
export default function Login() {
  const [looped, setLooped] = useState(false);

  useEffect(() => {
    // registerSsoRedirect() returns false once we've redirected too many times in 30s.
    if (!registerSsoRedirect()) {
      setLooped(true);
      return;
    }

    // Normal path: go to the central login, asking it to send us back here afterwards.
    const currentPath = window.location.pathname + window.location.search;
    const isGeneric =
      currentPath === "/" || currentPath === "/login" || currentPath === "/auth/sso-callback";
    const callbackUrl = isGeneric
      ? SSO_CALLBACK_URL
      : `${SSO_CALLBACK_URL}?returnPath=${encodeURIComponent(currentPath)}`;

    const returnTo = encodeURIComponent(callbackUrl);
    window.location.href = `${CENTRAL_LOGIN_URL}?redirect_uri=${returnTo}`;
  }, []);

  // Let the user clear the guard and try the whole flow again.
  const retry = () => {
    clearSsoRedirectGuard();
    window.location.reload();
  };

  // Loop detected — explain instead of reloading forever.
  if (looped) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
          <div className="flex items-center gap-2 text-cyan-600">
            <Shield className="w-5 h-5" aria-hidden="true" />
            <span className="font-bold text-sm tracking-widest text-slate-900 uppercase">
              SafeVoice
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-800">Sign-in could not complete</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            We kept getting sent back to the login page. This usually means your session
            cookie is not valid for this address.
          </p>
          <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-1">
            <li>Make sure you are opening SafeVoice on the same host as RegulaOne.</li>
            <li>
              Confirm the RegulaOne backend sets the session cookie for host{" "}
              <span className="font-mono">{window.location.hostname}</span>.
            </li>
            <li>Try signing in again from the central RegulaOne app.</li>
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={retry}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
            >
              Try again
            </button>
            <a
              href={CENTRAL_LOGIN_URL}
              className="flex-1 text-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl transition"
            >
              Open RegulaOne login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-700 text-sm font-medium">Redirecting to RegulaOne sign-in…</p>
        <p className="text-slate-500 text-xs">You will return to SafeVoice once signed in.</p>
      </div>
    </div>
  );
}
