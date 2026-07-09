// App shell — gold-on-charcoal sidebar, topbar with language switch, and the
// permanent "drafts require DPO review" disclaimer (an honest product promise,
// not decoration).
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  LayoutDashboard, BookOpenCheck, ShieldAlert, FileText, Handshake, Globe,
  Siren, Inbox, History, Users, Settings, LogOut, ShieldCheck, Languages,
} from 'lucide-react';

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';

import { useT } from '../../i18n';
import { setLanguage } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';
import { navForRole, ROLE_LABELS } from '../../lib/permissions';

const NAV_ICONS = {
  'nav.dashboard': LayoutDashboard,
  'nav.register': BookOpenCheck,
  'nav.dpia': ShieldAlert,
  'nav.notices': FileText,
  'nav.vendors': Handshake,
  'nav.transfers': Globe,
  'nav.breaches': Siren,
  'nav.dsar': Inbox,
  'nav.auditTrail': History,
  'nav.users': Users,
  'nav.settings': Settings,
};

export default function DashboardLayout() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useSelector((s) => s.auth.user);
  const items = navForRole(user.role);

  // A nav item is active on its own route and every sub-route
  // (e.g. /register stays highlighted on /register/:id and the wizard).
  const isActive = (to) => pathname === to || pathname.startsWith(`${to}/`);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
              <span className="font-display text-sm font-semibold text-foreground">{t('app.name')}</span>
              <span className="text-[11px] text-muted-foreground">{t('app.tagline')}</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = NAV_ICONS[item.key];
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        tooltip={t(item.key)}
                        isActive={isActive(item.to)}
                        render={<NavLink to={item.to} />}
                        className="data-active:bg-primary/15 data-active:text-primary data-active:font-medium"
                      >
                        {Icon && <Icon />}
                        <span>{t(item.key)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
            </div>
            <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-xs font-medium text-foreground">{user.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {ROLE_LABELS[user.role]?.[lang] ?? user.role}
              </span>
            </div>
            <Button
              variant="ghost" size="icon-sm" onClick={handleLogout}
              aria-label={t('nav.logout')}
              className="ml-auto group-data-[collapsible=icon]:hidden"
            >
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="font-display text-sm text-muted-foreground">
            RegulaOne <span className="text-primary">/</span> {t('app.name')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(setLanguage(lang === 'pl' ? 'en' : 'pl'))}
              aria-label={t('common.switchLanguage')}
            >
              <Languages />
              {lang === 'pl' ? 'PL' : 'EN'}
            </Button>
            <Badge variant="outline" className="hidden sm:inline-flex border-primary/40 text-primary">
              {ROLE_LABELS[user.role]?.[lang] ?? user.role}
            </Badge>
          </div>
        </header>

        {/* Honest-drafts disclaimer — every generated document needs legal review. */}
        <div className="border-b border-primary/20 bg-accent px-4 py-1.5 text-[11px] text-accent-foreground">
          {t('app.disclaimer')}
        </div>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
        <Toaster position="bottom-right" />
      </SidebarInset>
    </SidebarProvider>
  );
}
