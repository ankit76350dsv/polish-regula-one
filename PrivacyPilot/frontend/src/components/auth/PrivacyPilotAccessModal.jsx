import {
  BadgeX,
  CalendarX2,
  Lock,
  LogOut,
  ShieldX,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useT } from '../../i18n';

const ACCESS_STATES = {
  disabled: {
    title: 'access.disabledTitle',
    body: 'access.disabledBody',
    Icon: BadgeX,
  },
  package: {
    title: 'access.packageTitle',
    body: 'access.packageBody',
    Icon: CalendarX2,
  },
  module: {
    title: 'access.moduleTitle',
    body: 'access.moduleBody',
    Icon: Lock,
  },
  permission: {
    title: 'access.permissionTitle',
    body: 'access.permissionBody',
    Icon: ShieldX,
  },
};

/**
 * Full-screen access modal shown only after /api/auth/me has authenticated the
 * user but its account, plan, module, or permission fields deny PrivacyPilot.
 */
export default function PrivacyPilotAccessModal({ reason, onSignOut }) {
  const { t } = useT();
  const state = ACCESS_STATES[reason] ?? ACCESS_STATES.module;
  const { Icon } = state;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-access-title"
        aria-describedby="privacy-access-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between bg-foreground px-6 py-3 text-background">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
            RegulaOne · PrivacyPilot
          </span>
          <Lock className="size-4 opacity-70" aria-hidden />
        </div>

        <div className="space-y-4 p-7 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <Icon className="size-5 text-destructive" aria-hidden />
          </div>

          <div>
            <h1 id="privacy-access-title" className="text-base font-semibold text-foreground">
              {t(state.title)}
            </h1>
            <p
              id="privacy-access-description"
              className="mt-1 text-xs leading-relaxed text-muted-foreground"
            >
              {t(state.body)}
            </p>
          </div>

          <Button variant="outline" className="w-full" onClick={onSignOut}>
            <LogOut className="size-4" aria-hidden /> {t('auth.signOut')}
          </Button>

          <p className="text-[11px] text-muted-foreground">{t('access.needHelp')}</p>
        </div>
      </section>
    </div>
  );
}
