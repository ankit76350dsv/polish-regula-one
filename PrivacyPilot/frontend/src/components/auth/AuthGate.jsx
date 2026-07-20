// The single guard wrapped around the whole authenticated app. In priority order:
//   1. loading            → spinner while /api/auth/me is checked
//   2. transient error    → Retry button
//   3. not signed in       → the RegulaOne SSO login screen
//   4. signed in, no access → an "access denied" card with Sign out
//   5. allowed             → the real app (DashboardLayout, which renders <Outlet/>)
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, RefreshCw, ShieldX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import LoginPage from '../../pages/Auth/LoginPage';
import DashboardLayout from '../layout/DashboardLayout';
import { evaluatePrivacyPilotAccess } from '../../lib/sso';
import { useT } from '../../i18n';
import {
  initSession,
  signOut,
  ssoLoopCleared,
  selectAuthStatus,
  selectAuthError,
  selectCurrentUser,
  selectSsoLoop,
} from '../../store/slices/authSlice';

// Maps the access-denied reason to a translation key.
const REASON_KEY = {
  disabled: 'access.disabled',
  module: 'access.module',
  package: 'access.package',
  permission: 'access.permission',
};

export default function AuthGate() {
  const { t } = useT();
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);
  const error = useSelector(selectAuthError);
  const user = useSelector(selectCurrentUser);
  const ssoLoop = useSelector(selectSsoLoop);

  // 1. Still checking the session.
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="grid justify-items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">{t('auth.verifying')}</p>
        </div>
      </div>
    );
  }

  // 2. Transient failure (network / timeout) → let the user retry.
  if (status === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-foreground">{t('auth.errorTitle')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {typeof error === 'string' ? error : t('auth.errorBody')}
          </p>
          <Button className="mt-4 w-full" onClick={() => dispatch(initSession())}>
            <RefreshCw className="size-4" /> {t('auth.retry')}
          </Button>
        </div>
      </div>
    );
  }

  // 3. No valid session → central RegulaOne login (also shown on a detected loop).
  if (status !== 'authenticated' || ssoLoop) {
    return <LoginPage looped={ssoLoop} onResetLoop={() => dispatch(ssoLoopCleared())} />;
  }

  // 4. Signed in, but not allowed into PrivacyPilot.
  const { allowed, reason } = evaluatePrivacyPilotAccess(user);
  if (!allowed) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="size-5 text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-foreground">{t('access.deniedTitle')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t(REASON_KEY[reason] ?? 'access.permission')}</p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => dispatch(signOut())}>
            {t('auth.signOut')}
          </Button>
        </div>
      </div>
    );
  }

  // 5. Allowed — render the real app shell (it contains the routed <Outlet/>).
  return <DashboardLayout />;
}
