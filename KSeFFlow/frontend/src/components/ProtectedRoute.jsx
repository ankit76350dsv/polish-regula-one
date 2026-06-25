import { AlertTriangle, RefreshCw } from 'lucide-react';
import Login from './Login';
import KsefAccessModal from './KsefAccessModal';
import { evaluateKsefAccess } from '../lib/access';
import { useLanguage } from '../context/LanguageContext';

// ── ProtectedRoute ──────────────────────────────────────────────────────────
// One reusable guard for the whole protected area, in priority order:
//   1. loading        → full-screen spinner (while /me is in flight)
//   2. error          → error screen with a Retry button (transient /me failure)
//   3. !authenticated → <Login/> (redirects to the central SSO login)
//   4. no KSeFFlow module / expired package → blocking <KsefAccessModal/>
//   5. otherwise      → render the protected app (children)
//
// It is presentational: it receives the already-fetched session via props (so we never call
// /me twice) and decides what to show. The access rule lives in lib/access.js.
export default function ProtectedRoute({
  loading,
  error,
  isAuthenticated,
  user,
  onRetry,
  onSignOut,
  children,
}) {
  const { language } = useLanguage();
  const T = (en, pl) => (language === 'pl' ? pl : en);

  // 1. Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-4 border-red-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">{T('Verifying your session…', 'Weryfikacja sesji…')}</p>
        </div>
      </div>
    );
  }

  // 2. Error (with retry)
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="text-red-600" size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">{T('Could not verify your session', 'Nie udało się zweryfikować sesji')}</h2>
            <p className="text-xs text-slate-500 mt-1">{typeof error === 'string' ? error : T('Please try again in a moment.', 'Spróbuj ponownie za chwilę.')}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw size={15} /> {T('Try again', 'Spróbuj ponownie')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. Not authenticated → the central SSO login flow (Login.jsx handles the redirect).
  if (!isAuthenticated) {
    return <Login />;
  }

  // 4. Authenticated, but not allowed into KSeFFlow (no module / expired package).
  const { allowed, reason } = evaluateKsefAccess(user);
  if (!allowed) {
    return <KsefAccessModal reason={reason} user={user} onSignOut={onSignOut} />;
  }

  // 5. Allowed.
  return children;
}
