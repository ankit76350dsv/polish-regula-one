// RegulaOne single sign-on screen. PrivacyPilot has NO password form of its own —
// this sends the user to the central RegulaOne login, which signs them in and
// returns them here. Rendered by AuthGate whenever there is no valid session.
//
// LOOP PROTECTION: if the session cookie is not valid for the current address the
// login can bounce back forever ("page keeps reloading"). We never auto-redirect on
// render — the redirect only starts on a deliberate button click, and after too many
// bounces in a short window we show an explanation instead.
import { useEffect, useState } from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  buildLoginUrl,
  registerSsoRedirect,
  clearSsoRedirectGuard,
  CENTRAL_LOGIN_URL,
} from '../../services/http';
import { useT } from '../../i18n';

export default function LoginPage({ looped: detectedLoop = false, onResetLoop = () => {} }) {
  const { t } = useT();
  const [looped, setLooped] = useState(detectedLoop);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (detectedLoop) setLooped(true);
  }, [detectedLoop]);

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

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand hero */}
      <div className="hidden flex-col justify-between bg-muted p-10 lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <span className="font-display text-lg font-semibold">RegulaOne / PrivacyPilot</span>
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold leading-snug text-foreground">
            Rejestr Czynności Przetwarzania.<br />
            <span className="text-primary">Art. 30 RODO, bez arkuszy Excela.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            ROPA · DPIA (M.P. 2019 poz. 666) · klauzule informacyjne · rejestr naruszeń ·
            wnioski osób · umowy powierzenia — w jednym miejscu, gotowe na kontrolę UODO.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Hosted in the EEA · AES-256 at rest · TLS 1.3 — platform controls, not badges.
        </p>
      </div>

      {/* Sign-in card */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </div>
          <h2 className="font-display text-xl font-semibold">{t('auth.ssoTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {looped ? t('auth.loopBody') : t('auth.ssoBody')}
          </p>

          {looped ? (
            <div className="mt-6 grid gap-3">
              <ul className="grid list-disc gap-1 pl-4 text-xs text-muted-foreground">
                <li>{t('auth.loopHint1')}</li>
                <li>{t('auth.loopHint2')}</li>
                <li>{t('auth.loopHint3')}</li>
              </ul>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={retry}>{t('auth.resetSignIn')}</Button>
                <a
                  href={CENTRAL_LOGIN_URL}
                  className="flex-1 rounded-md border px-4 py-2 text-center text-sm font-medium hover:bg-accent"
                >
                  {t('auth.openLogin')}
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              <Button onClick={startSignIn} disabled={redirecting}>
                <LogIn className="size-4" />
                {redirecting ? t('auth.openingLogin') : t('auth.continueToLogin')}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                {t('auth.redirectingHint')}
              </p>
            </div>
          )}

          <Card className="mt-6">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t('auth.subtitle')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
