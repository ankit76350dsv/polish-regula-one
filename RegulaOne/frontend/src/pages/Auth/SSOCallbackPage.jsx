import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuthStore }        from '../../store/authStore';

/**
 * SSOCallbackPage — mounted at /auth/sso-callback.
 *
 * This page is the landing point after a successful cross-app SSO round-trip:
 *
 *   1. Module app had no session → called ssoService.redirectToSSO('/some/path')
 *   2. Backend redirected to central login page with ?redirect_uri=<this page's URL>
 *   3. User logged in on the central app (app.regulaone.eu)
 *   4. Shared-domain cookies set (Domain=.regulaone.eu)
 *   5. useLogin hook did window.location.href → browser landed here
 *   6. App.jsx has already called initAuth() on this page load
 *      → /api/auth/me succeeded because the shared-domain cookie is now present
 *      → user is set in the store (or isLoading is still true if in-flight)
 *   7. THIS PAGE watches isLoading → when false, checks user:
 *      - user set  → navigate to returnPath ✅
 *      - user null → auth failed, redirect to /login
 *
 * Why we watch isLoading instead of calling initAuth() again:
 *   App.jsx already calls initAuth() on every mount. Calling it again from here
 *   would make a duplicate /api/auth/me request. We simply wait for that existing
 *   call to finish and read its result from the store.
 *
 * Error case (?sso_error=...):
 *   The backend sets this when the SSO flow fails (e.g. bad state param).
 *   We show a user-friendly message and auto-redirect to /login after 3 seconds.
 */
export default function SSOCallbackPage() {
  const navigate             = useNavigate();
  const { user, isLoading }  = useAuthStore();
  const [error, setError]    = useState(null);

  const params     = new URLSearchParams(window.location.search);
  const ssoError   = params.get('sso_error');
  const returnPath = params.get('returnPath') || '/';

  // ── Error case ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ssoError) return;

    const messages = {
      access_denied:         'Login was cancelled. Please try again.',
      token_exchange_failed: 'Authentication failed. Please try again.',
      missing_code:          'Invalid SSO response. Please try again.',
    };
    setError(messages[ssoError] ?? 'Authentication failed. Please try again.');

    const timer = setTimeout(() => navigate('/login', { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [ssoError]);

  // ── Session result ──────────────────────────────────────────────────────────
  // Wait for App.jsx's initAuth() call to finish (isLoading → false), then act.
  useEffect(() => {
    if (ssoError || isLoading) return; // error handled above; still loading

    if (user) {
      // Auth succeeded — navigate to the page the user originally requested
      navigate(returnPath, { replace: true });
    } else {
      // initAuth completed but no user — cookie missing or invalid
      navigate('/login', { replace: true });
    }
  }, [isLoading, user, ssoError]);

  // ── UI ──────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-red-600 text-lg font-bold">!</span>
          </div>
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <p className="text-xs text-slate-400">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-200 border-t-red-600" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Completing sign-in…
        </span>
      </div>
    </div>
  );
}
