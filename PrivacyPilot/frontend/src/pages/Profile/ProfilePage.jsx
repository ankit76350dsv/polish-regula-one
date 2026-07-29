// The signed-in user's own account, organisation and PrivacyPilot access.
// Everything is read from the RegulaOne SSO session already in Redux (auth.user);
// this page is read-only — permissions/roles are managed centrally in RegulaOne.
import { useSelector } from 'react-redux';
import { UserCircle, Building2, CreditCard, KeyRound, ShieldCheck, Boxes } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '../../components/common/PageHeader';
import { useT } from '../../i18n';
import { privacyPilotPermissions, formatPermissionCode, platformRoleLabel } from '../../lib/sso';

// Friendly product names for the RegulaOne module codes in /me.moduleIds.
const MODULE_LABELS = {
  KSEFFLOW: 'KSeFFlow',
  SAFEVOICE: 'SafeVoice',
  WORKPULSE: 'WorkPulse',
  SAFEWORK: 'SafeWork',
  WASTESYNC: 'WasteSync',
  PRIVACYPILOT: 'PrivacyPilot',
};

// One label/value row.
function Row({ label, value, mono }) {
  const shown = value !== null && value !== undefined && value !== '' ? value : '—';
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-right text-xs font-medium text-foreground ${mono ? 'font-mono' : ''}`}>
        {shown}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { t, lang } = useT();
  const user = useSelector((s) => s.auth.user);
  if (!user) return null;

  const initials = (user.name || user.email || '')
    .trim().split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '—';

  // The PrivacyPilot capacity, shown as the raw code (e.g. "PRIVACYPILOT ADMIN").
  // The platform role is a separate thing (ROLE_ADMIN → "Admin").
  const ppRoleLabel = user.primaryPermission ? formatPermissionCode(user.primaryPermission) : null;
  const platformRole = user.role ? platformRoleLabel(user.role) : '—';
  const ppPerms = privacyPilotPermissions(user);
  const modules = user.moduleIds ?? [];
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB') : '—');

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      {/* Hero */}
      <Card className="mb-4">
        <CardContent className="flex items-center gap-5 p-5">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold text-foreground">{user.name || '—'}</h2>
            <p className="truncate text-sm text-muted-foreground">{user.email || '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {ppRoleLabel && (
                <Badge variant="outline" className="border-primary/40 text-primary">{ppRoleLabel}</Badge>
              )}
              <Badge variant="outline"
                className={user.enabled === false ? 'text-muted-foreground' : 'border-(--status-ok)/40 text-(--status-ok)'}>
                {user.enabled === false ? t('profile.disabled') : t('profile.active')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Account */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserCircle className="size-4 text-primary" /> {t('profile.accountTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label={t('profile.fullName')} value={user.name} />
            <Row label={t('profile.email')} value={user.email} mono />
            <Row label={t('profile.ppRole')} value={ppRoleLabel} />
            <Row label={t('profile.platformRole')} value={platformRole} />
            <Row label={t('common.status')} value={user.enabled === false ? t('profile.disabled') : t('profile.active')} />
          </CardContent>
        </Card>

        {/* Organisation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="size-4 text-primary" /> {t('profile.orgTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label={t('profile.company')} value={user.tenantName} />
            <Row label={t('profile.tenantId')} value={user.tenantId} mono />
            <Row label={t('common.status')} value={user.tenantStatus} />
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-primary" /> {t('profile.subscriptionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-xs text-muted-foreground">{t('profile.planStatus')}</span>
                <Badge variant="outline"
                  className={user.planExpired ? 'border-(--status-risk)/40 text-(--status-risk)' : 'border-(--status-ok)/40 text-(--status-ok)'}>
                  {user.planExpired ? t('profile.expired') : t('profile.active')}
                </Badge>
              </div>
              <Row label={t('profile.planExpires')} value={fmtDate(user.planExpiresAt)} />
            </div>
            <div className="mt-3 border-t pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Boxes className="size-3.5" /> {t('profile.modules')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {modules.length === 0 ? (
                  <span className="text-xs text-muted-foreground">{t('profile.none')}</span>
                ) : (
                  modules.map((m) => (
                    <span key={m} className="rounded-md border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {MODULE_LABELS[m] ?? m}
                    </span>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PrivacyPilot access & permissions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4 text-primary" /> {t('profile.accessTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ppPerms.length === 0 ? (
              <p className="rounded-lg bg-muted py-3 text-center text-xs text-muted-foreground">
                {t('profile.noPermissions')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ppPerms.map((p) => (
                  <span key={p} title={p}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary">
                    <ShieldCheck className="size-3" /> {formatPermissionCode(p)}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{t('profile.accessNote')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
