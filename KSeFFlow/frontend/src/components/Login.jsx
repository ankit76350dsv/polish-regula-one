import { useEffect } from 'react';
import { SSO_CALLBACK_URL } from '../lib/api';

const CENTRAL_LOGIN = import.meta.env.VITE_CENTRAL_LOGIN_URL ?? 'http://localhost:3000/login';

/**
 * KSeFFlow does NOT have its own login form.
 * Authentication is handled centrally by the RegulaOne app (localhost:3000).
 * This component is rendered when the app detects no valid session.
 * It immediately redirects the browser to the RegulaOne login page with
 * a ?redirect_uri parameter pointing back to this app's SSO callback route.
 *
 * After the user authenticates on the main app the shared-domain cookie
 * (Domain=localhost, or .regulaone.eu in production) is set by the backend
 * and the user is sent back to /auth/sso-callback here. App.jsx then retries
 * /api/auth/me, finds the session, and renders the dashboard.
 */
export default function Login() {
  useEffect(() => {
    const returnTo = encodeURIComponent(SSO_CALLBACK_URL);
    window.location.href = `${CENTRAL_LOGIN}?redirect_uri=${returnTo}`;
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-4 border-red-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium">
          Redirecting to RegulaOne login…
        </p>
        <p className="text-slate-600 text-xs">
          You will be returned to KSeFFlow automatically after signing in.
        </p>
      </div>
    </div>
  );
}
