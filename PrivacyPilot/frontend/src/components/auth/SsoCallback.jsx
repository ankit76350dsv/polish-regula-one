// Landing route the central RegulaOne login sends the browser back to
// (/auth/sso-callback). By the time we get here the session cookie is set, so
// App.jsx's initSession() resolves to "authenticated" and we forward the user to
// wherever they were headed (the ?returnPath), or the dashboard.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus } from '../../store/slices/authSlice';
import { orgPath } from '../../lib/paths';
import { useT } from '../../i18n';

export default function SsoCallback() {
  const { t } = useT();
  const status = useSelector(selectAuthStatus);
  const tenantId = useSelector((s) => s.auth.user?.tenantId);
  const navigate = useNavigate();

  useEffect(() => {
    const home = orgPath(tenantId, '/dashboard');
    if (status === 'authenticated') {
      const params = new URLSearchParams(window.location.search);
      const returnPath = params.get('returnPath');
      // Only allow an INTERNAL path (starts with a single "/") — blocks open-redirects.
      const safe = returnPath && /^\/[^/]/.test(returnPath) ? returnPath : home;
      navigate(safe, { replace: true });
    } else if (status === 'unauthenticated' || status === 'error') {
      // Session did not stick / failed — go to a stable URL; RootRedirect/the gate
      // then shows the login (or the retry screen).
      navigate('/', { replace: true });
    }
    // While 'idle' / 'loading' we wait — App.jsx's initSession() is resolving.
  }, [status, tenantId, navigate]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="grid justify-items-center gap-4">
        <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">{t('auth.verifying')}</p>
      </div>
    </div>
  );
}
