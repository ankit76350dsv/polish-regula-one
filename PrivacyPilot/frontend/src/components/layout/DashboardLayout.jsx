// App shell — the sidebar menu, the top bar with the language switch, and the frame every
// screen is drawn inside.
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  LayoutDashboard, BookOpenCheck, ShieldAlert, FileText, Handshake, Globe,
  Siren, Inbox, History, Users, Settings, LogOut, ShieldCheck, Languages,
} from 'lucide-react';

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';

import { useT } from '../../i18n';
import { setLanguage } from '../../store/slices/uiSlice';
import { signOut } from '../../store/slices/authSlice';
import { navFor, NAV_SECTIONS } from '../../lib/permissions';
import { roleDisplay } from '../../lib/sso';
import { useOrgBase } from '../../lib/paths';

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
  const { pathname } = useLocation();
  const user = useSelector((s) => s.auth.user);
  const base = useOrgBase(); // "/company/{tenantId}"
  // The menu, already filtered to what this user is allowed to open, split into the
  // day-to-day compliance screens and the administration ones.
  const items = navFor(user);
  const workItems = items.filter((i) => i.section === NAV_SECTIONS.WORK);
  const adminItems = items.filter((i) => i.section === NAV_SECTIONS.ADMIN);
  // Sidebar footer: the user's PrivacyPilot capacity, in the same words the Users and
  // Profile screens use for it (e.g. "PrivacyPilot Admin"), in the chosen language.
  const roleLabel = roleDisplay(user, lang);

  // A nav item is active on its own route and every sub-route
  // (e.g. /register stays highlighted on /register/:id and the wizard).
  // Paths are tenant-scoped, so compare against the "/company/{id}" base.
  const isActive = (to) => {
    const full = `${base}${to}`;
    return pathname === full || pathname.startsWith(`${full}/`);
  };

  // First letter of the first two words of the name, for the round avatar. Empty words are
  // dropped so a name typed with a double space still gives two letters, and a missing name
  // falls back to "?" rather than an empty circle.
  const initials = user.name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  // Ends the RegulaOne SSO session and sends the browser to the central logout
  // page (which finishes sign-out and returns here to the login screen).
  const handleLogout = () => {
    dispatch(signOut());
  };

  // One block of menu links, with an optional heading above it. Both blocks are drawn the
  // same way so spacing, sizing and the active-link highlight can never drift apart.
  const renderSection = (sectionItems, heading) => (
    <SidebarGroup>
      {heading && <SidebarGroupLabel>{heading}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {sectionItems.map((item) => {
            const Icon = NAV_ICONS[item.key];
            const label = t(item.key);
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  // When the sidebar is collapsed to icons only, the name appears on hover.
                  tooltip={label}
                  isActive={isActive(item.to)}
                  render={<NavLink to={`${base}${item.to}`} />}
                  className="data-active:bg-primary/15 data-active:text-primary data-active:font-medium"
                >
                  {Icon && <Icon />}
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            {/* Product name only. The descriptive tagline that used to sit under it was
                decoration: the topbar already reads "RegulaOne / PrivacyPilot", so the name
                appeared twice on screen, and the navigation makes the purpose obvious. */}
            <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
              <span className="font-display text-sm font-semibold text-foreground">{t('app.name')}</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* A real <nav> landmark so screen readers can jump straight to the menu (WCAG 2.1). */}
          <nav aria-label={t('nav.mainLabel')} className="flex flex-col">
            {renderSection(workItems)}
            {/* Only drawn when the user can reach at least one of these screens — an
                auditor, for example, sees the heading only because they have the audit
                trail. A heading over nothing would be clutter. */}
            {adminItems.length > 0 && renderSection(adminItems, t('nav.group.admin'))}
          </nav>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
            {/* Clicking the user opens their profile. */}
            <NavLink
              to={`${base}/profile`}
              title={t('nav.profile')}
              className="flex min-w-0 items-center gap-2 rounded-md p-1 hover:bg-accent"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {initials}
              </div>
              <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-medium text-foreground">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
              </div>
            </NavLink>
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

      <SidebarInset className="min-w-0">
        {/* Top bar. It holds only what cannot live anywhere else: the button that opens the
            menu, and the language switch. Two things were removed from it:

            • "RegulaOne / PrivacyPilot" — the menu already names the app two centimetres to
              the left, so the name was on screen twice. It is kept for narrow screens ONLY,
              where the menu slides off and this bar is the only thing framing the page.
            • The account-role badge ("Admin") — it sat beside the menu's "PrivacyPilot
              Admin", so two different words described the same person's access. The account
              role now appears once, on the profile page, where it can be explained. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur sm:gap-3 md:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5 md:hidden" />
          <span className="truncate font-display text-sm font-semibold text-foreground md:hidden">
            {t('app.name')}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => dispatch(setLanguage(lang === 'pl' ? 'en' : 'pl'))}
            aria-label={t('common.switchLanguage')}
          >
            <Languages />
            {lang === 'pl' ? 'PL' : 'EN'}
          </Button>
        </header>

        {/* The "documents are drafts, get them reviewed" note used to live HERE, on every
            single screen — including ones that produce no documents at all, like the
            dashboard. A warning shown where it does not apply just teaches people to ignore
            it. It now appears only on the screens that actually generate a document for use
            outside the app (see components/common/DraftsDisclaimer). */}
        <div className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </div>
        <Toaster position="bottom-right" />
      </SidebarInset>
    </SidebarProvider>
  );
}
