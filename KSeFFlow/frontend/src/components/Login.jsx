import { useEffect, useState } from 'react';
import { SSO_CALLBACK_URL, registerSsoRedirect, clearSsoRedirectGuard } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

import { CENTRAL_LOGIN } from '../lib/serviceHosts';

// SIMPLE EXPLANATION:
// KSeFFlow has no login form of its own. When there is no valid session, this screen sends the
// browser to the central RegulaOne login page, which sends it back here after signing in.
//
// LOOP PROTECTION (why this exists):
// If the session cookie is NOT valid for the address you are using (very common right after the
// machine's IP changes — the old cookie was set for the old host), then /api/auth/me keeps
// returning 401, so we keep bouncing: KSeFFlow → login → back → 401 → login → … forever. To the
// user this looks like the website "keeps reloading". The redirect counter now lives in lib/api.js
// (registerSsoRedirect) so this screen AND the 401-redirect inside the HTTP client share ONE
// budget — see the long note there. After a few redirects we STOP and explain the likely cause.

export default function Login() {
  const [looped, setLooped] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // registerSsoRedirect() returns false when we have already redirected too many
    // times in the last 30s → we are stuck in a login loop. Stop and show why.
    if (!registerSsoRedirect()) {
      setLooped(true);
      return;
    }

    // Normal path: go to the central login, asking it to send us back here afterwards.
    const currentPath = window.location.pathname + window.location.search;
    const isGeneric = currentPath === '/' || currentPath === '/login' || currentPath === '/auth/sso-callback';
    const callbackUrl = isGeneric
      ? SSO_CALLBACK_URL
      : `${SSO_CALLBACK_URL}?returnPath=${encodeURIComponent(currentPath)}`;

    const returnTo = encodeURIComponent(callbackUrl);
    window.location.href = `${CENTRAL_LOGIN}?redirect_uri=${returnTo}`;
  }, []);

  // Let the user clear the guard and try the whole flow again.
  const retry = () => {
    clearSsoRedirectGuard();
    window.location.reload();
  };

  // Loop detected — show a clear explanation instead of reloading forever.
  if (looped) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
          <h1 className="text-base font-bold text-slate-800">{t('login.failed')}</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t('login.desc1')}
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t('login.desc2', { host: window.location.host })}
          </p>
          <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-1">
            <li>{t('login.solution1')}</li>
            <li>{t('login.solution2', { host: window.location.hostname })}</li>
            <li>{t('login.solution3')}</li>
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              onClick={retry}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
            >
              {t('login.retryBtn')}
            </button>
            <a
              href={CENTRAL_LOGIN}
              className="flex-1 text-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl transition"
            >
              {t('login.openBtn')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-4 border-red-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium">
          {t('login.redirecting')}
        </p>
        <p className="text-slate-600 text-xs">
          {t('login.returnDesc')}
        </p>
      </div>
    </div>
  );
}
