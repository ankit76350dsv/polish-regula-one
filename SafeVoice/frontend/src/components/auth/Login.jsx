import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LogIn, Shield } from "lucide-react";
import {
  SSO_CALLBACK_URL,
  registerSsoRedirect,
  clearSsoRedirectGuard,
  CENTRAL_LOGIN_URL,
} from "../../services/api";

// SIMPLE EXPLANATION:
// SafeVoice has no login form of its own. When a staff member opens a protected page
// without a valid session, this screen sends them to the central RegulaOne login page,
// which signs them in and sends them back here.
//
// LOOP PROTECTION (why this exists):
// If the session cookie is not valid for the address being used (common right after a
// machine's IP changes — the old cookie was set for the old host), the login keeps bouncing
// us back and failing. To the user that looks like the page "keeps reloading". We never
// auto-redirect on render; the redirect only starts after a deliberate button click.
export default function Login({ looped: detectedLoop = false, onResetLoop = () => {} }) {
  const { t } = useTranslation();
  const [looped, setLooped] = useState(detectedLoop);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (detectedLoop) setLooped(true);
  }, [detectedLoop]);

  const buildLoginUrl = () => {
    const currentPath = window.location.pathname + window.location.search;
    const isGeneric =
      currentPath === "/" || currentPath === "/login" || currentPath === "/auth/sso-callback";
    const callbackUrl = isGeneric
      ? SSO_CALLBACK_URL
      : `${SSO_CALLBACK_URL}?returnPath=${encodeURIComponent(currentPath)}`;

    return `${CENTRAL_LOGIN_URL}?redirect_uri=${encodeURIComponent(callbackUrl)}`;
  };

  const startSignIn = () => {
    // registerSsoRedirect() returns false once we've redirected too many times in 30s.
    if (!registerSsoRedirect()) {
      setLooped(true);
      return;
    }

    setRedirecting(true);
    window.location.assign(buildLoginUrl());
  };

  // Let the user clear the guard and try the whole flow again.
  const retry = () => {
    clearSsoRedirectGuard();
    onResetLoop();
    setLooped(false);
    setRedirecting(false);
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
          <h1 className="text-base font-bold text-slate-800">{t("auth.loopTitle")}</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t("auth.loopBody")}
          </p>
          <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-1">
            <li>{t("auth.loopHint1")}</li>
            <li>{t("auth.loopHint2", { host: window.location.hostname })}</li>
            <li>{t("auth.loopHint3")}</li>
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={retry}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
            >
              {t("auth.resetSignIn")}
            </button>
            <a
              href={CENTRAL_LOGIN_URL}
              className="flex-1 text-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl transition"
            >
              {t("auth.openLogin")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 border border-slate-200 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-700">
          <Shield className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-base font-bold text-slate-800">
            {t("auth.signInRequiredTitle")}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t("auth.signInRequiredBody")}
          </p>
        </div>
        <button
          type="button"
          onClick={startSignIn}
          disabled={redirecting}
          className="inline-flex w-full items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 px-4 rounded-xl transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {redirecting ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" aria-hidden="true" />
          )}
          {redirecting ? t("auth.openingLogin") : t("auth.continueToLogin")}
        </button>
        <p className="text-[11px] text-slate-500">
          {t("auth.redirectingHint")}
        </p>
      </div>
    </div>
  );
}
