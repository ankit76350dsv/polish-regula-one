// The signed-in user's own account, organisation and PrivacyPilot access.
// Everything is read from the RegulaOne SSO session already in Redux (auth.user);
// this page is read-only — permissions/roles are managed centrally in RegulaOne.
import { useSelector } from 'react-redux';
import { UserCircle, Building2, CreditCard, KeyRound, ShieldCheck, Boxes } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '../../components/common/PageHeader';
import { useT } from '../../i18n';
import { privacyPilotPermissions, platformRoleLabel } from '../../lib/sso';
import { ROLE_LABELS } from '../../lib/permissions';

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
function Row({ label, value }) {
  const shown = value !== null && value !== undefined && value !== '' ? value : '—';
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-xs font-medium text-foreground">
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

  // Permission names, the same wording the Users screen shows. This page used to print
  // the stored code with its underscores swapped for spaces — "PRIVACYPILOT ADMIN" — so the
  // same permission read one way here and another way there.
  const permLabel = (code) => ROLE_LABELS[code]?.[lang] ?? code;
  const ppRoleLabel = user.primaryPermission ? permLabel(user.primaryPermission) : null;
  const platformRole = user.role ? platformRoleLabel(user.role) : '—';
  const ppPerms = privacyPilotPermissions(user);
  const modules = user.moduleIds ?? [];
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB') : '—');

  // The organisation's state arrives as a stored code (ACTIVE / SUSPENDED / INACTIVE).
  const ORG_STATUS = {
    ACTIVE: t('profile.active'),
    SUSPENDED: t('profile.orgSuspended'),
    INACTIVE: t('profile.orgInactive'),
  };
  const orgStatus = ORG_STATUS[user.tenantStatus] ?? user.tenantStatus;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      {/* Hero */}
      <Card className="mb-4">
        <CardContent className="flex items-center gap-5">
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
            {/* The PrivacyPilot permission and the account status are both on the badge
                above and, for permissions, listed in full in the access card — so they are
                not repeated here as well. */}
            <Row label={t('profile.fullName')} value={user.name} />
            <Row label={t('profile.email')} value={user.email} />
            <Row label={t('profile.platformRole')} value={platformRole} />
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
            {/* The "Tenant ID" row is gone: a 24-character database id is not something a
                person needs, and it is in the address bar anyway if support ever asks. */}
            <Row label={t('profile.company')} value={user.tenantName} />
            <Row label={t('common.status')} value={orgStatus} />
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
                    <Badge key={m} variant="outline" className="text-muted-foreground">
                      {MODULE_LABELS[m] ?? m}
                    </Badge>
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
                {/* The stored code stays in the tooltip so an administrator can still match
                    a permission to what RegulaOne shows. */}
                {ppPerms.map((p) => (
                  <Badge key={p} variant="outline" title={p}
                    className="gap-1 border-primary/20 bg-primary/5 text-primary">
                    <ShieldCheck className="size-3" aria-hidden /> {permLabel(p)}
                  </Badge>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t('profile.accessNote')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
