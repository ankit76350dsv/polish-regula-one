// Demo login — real form flow through the auth slice. No role self-selection:
// the role comes from the account, exactly as it will with the SSO backend.
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField, Input } from '../../components/common/Field';
import { login } from '../../store/slices/authSlice';
import { useT } from '../../i18n';
import { ROLE_LABELS } from '../../lib/permissions';

const DEMO_ACCOUNTS = [
  { email: 'karolina.wojcik@abclogistics.example.pl', role: 'TENANT_ADMIN' },
  { email: 'marek.zielinski@abclogistics.example.pl', role: 'COMPLIANCE_OFFICER' },
  { email: 'iod@abclogistics.example.pl', role: 'DPO' },
  { email: 'ewa.kaminska@audytpartner.example.pl', role: 'AUDITOR' },
];

export default function LoginPage() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.auth);
  const { t, lang } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e) => {
    e.preventDefault();
    dispatch(login({ email, password }));
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

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-xl font-semibold">{t('auth.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.subtitle')}</p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            <FormField label={t('auth.email')} required>
              {(id) => (
                <Input id={id} type="email" autoComplete="username" required
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </FormField>
            <FormField label={t('auth.password')} required
              error={status === 'failed' ? t('auth.invalid') : null}>
              {(id) => (
                <Input id={id} type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </FormField>
            <Button type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? t('common.loading') : t('auth.signIn')}
            </Button>
            {error && status === 'failed' && (
              <p className="sr-only" role="alert">{t('auth.invalid')}</p>
            )}
          </form>

          <Card className="mt-6">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{t('auth.demoHint')}</p>
              <ul className="mt-2 grid gap-1">
                {DEMO_ACCOUNTS.map((acc) => (
                  <li key={acc.email}>
                    <button
                      type="button"
                      className="w-full rounded-md px-2 py-1 text-left text-xs hover:bg-accent"
                      onClick={() => { setEmail(acc.email); setPassword('demo123'); }}
                    >
                      <span className="text-primary">{ROLE_LABELS[acc.role][lang]}</span>
                      {' — '}
                      <span className="text-muted-foreground">{acc.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">password: demo123</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
