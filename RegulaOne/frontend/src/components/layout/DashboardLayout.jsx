import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import UserDisabledModal    from '../modals/UserDisabledModal';
import SetupOrgModal        from '../modals/SetupOrgModal';
import OrgBlockedModal      from '../modals/OrgBlockedModal';
import TenantSuspendedModal from '../modals/TenantSuspendedModal';
import PlanExpiredModal     from '../modals/PlanExpiredModal';
import PlanExpiryBanner     from '../modals/PlanExpiryBanner';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger,
  SidebarInset, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Building2, ReceiptText, Clock, ShieldAlert, LogOut,
  MessageSquare, Trash2, ShieldCheck, Users, Package, Lock, ExternalLink
} from 'lucide-react';
import { moduleAppUrl } from '../../config/moduleApps';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NotificationBell from '../notifications/NotificationBell';
import ConfirmedLogoutButton from '../common/ConfirmedLogoutButton';

export default function DashboardLayout() {
  const { user } = useAuthStore();
  const location  = useLocation();

  // ── Tenant + plan guards (evaluated in priority order) ───────────────────
  //
  // 0. Individual user account disabled (enabled: false in /me response).
  //    Checked first — if the account is disabled, all other guards are irrelevant.
  //    ROLE_USER  → contact your admin.
  //    ROLE_ADMIN → contact RegulaOne support.
  //    ROLE_SUPER_ADMIN → should never be disabled, but guard fires just in case.
  if (user?.status === 'suspended') {
    return <UserDisabledModal />;
  }

  // 1. ROLE_ADMIN with no org → must complete setup first.
  if (user?.role === 'ROLE_ADMIN' && !user?.tenantId) {
    return <SetupOrgModal />;
  }

  // 2. ROLE_ADMIN whose tenant is INACTIVE or SUSPENDED → contact RegulaOne.
  //    Checked before the plan-expiry guard so a suspended admin never lands on
  //    /my-plan (renewing a plan doesn't fix a suspended org; only support can).
  if (
    user?.role === 'ROLE_ADMIN' &&
    user?.tenantId &&
    (user?.tenantStatus === 'INACTIVE' || user?.tenantStatus === 'SUSPENDED')
  ) {
    return <TenantSuspendedModal />;
  }

  // 3. ROLE_USER with no org or inactive/suspended org → blocked until admin fixes it.
  if (user?.role === 'ROLE_USER' && (!user?.tenantId || user?.tenantStatus !== 'ACTIVE')) {
    return <OrgBlockedModal />;
  }

  const tid = user?.tenantId ?? 'platform';

  // 4. Plan expiry — block access to everything except /my-plan so the admin can
  //    still navigate to the plan page to renew. ROLE_SUPER_ADMIN has no tenant plan.
  if (user?.planExpired && user?.role !== 'ROLE_SUPER_ADMIN' && !location.pathname.endsWith('/my-plan')) {
    return <PlanExpiredModal />;
  }

  // Tenant display label — use real name from /me response
  const tenantLabel = user?.role === 'ROLE_SUPER_ADMIN'
    ? 'Global HQ (Root)'
    : user?.tenantName ?? 'My Organisation';

  const navItems = [
    { title: 'Overview',       icon: LayoutDashboard, path: `/company/${tid}/overview`,       roles: ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER'] },
    { title: 'Tenants',        icon: Building2,        path: `/company/${tid}/tenants`,        roles: ['ROLE_SUPER_ADMIN'] },
    { title: 'Users',          icon: Users,            path: `/company/${tid}/users`,          roles: ['ROLE_SUPER_ADMIN'] },
    { title: 'License Tiers',  icon: Package,          path: `/company/${tid}/package-tiers`,  roles: ['ROLE_SUPER_ADMIN'] },
    { title: 'Team',           icon: Users,            path: `/company/${tid}/team`,           roles: ['ROLE_ADMIN'] },
    { title: 'My Plan',        icon: Package,          path: `/company/${tid}/my-plan`,        roles: ['ROLE_ADMIN'] },
  ];

  // All compliance modules, in sidebar order.
  //
  // `path` is the page INSIDE this hub, and it exists only for modules that do not yet
  // have their own application. KSeFFlow, SafeVoice and PrivacyPilot run as separate apps,
  // so they have no in-hub page to fall back to — their addresses live in
  // src/config/moduleApps.js instead.
  const ALL_MODULES = [
    { title: 'KSeFFlow',    icon: ReceiptText,   path: null,                                   moduleKey: 'KSEFFLOW',     dotColor: 'bg-blue-300' },
    { title: 'SafeVoice',   icon: MessageSquare, path: null,                                   moduleKey: 'SAFEVOICE',    dotColor: 'bg-orange-300' },
    { title: 'PrivacyPilot',icon: ShieldAlert,   path: null,                                   moduleKey: 'PRIVACYPILOT', dotColor: 'bg-emerald-300' },
    { title: 'SafeWork',    icon: ShieldCheck,   path: `/company/${tid}/modules/safework`,     moduleKey: 'SAFEWORK',     dotColor: 'bg-amber-300' },
    { title: 'WasteSync',   icon: Trash2,        path: `/company/${tid}/modules/wastesync`,    moduleKey: 'WASTESYNC',    dotColor: 'bg-red-300' },
    { title: 'WorkPulse',   icon: Clock,         path: `/company/${tid}/modules/workpulse`,    moduleKey: 'WORKPULSE',    dotColor: 'bg-green-300' },
  ];

  // ── Who may open which module ────────────────────────────────────────────
  //
  // Every module is now LISTED for everyone; the ones this person was not given are
  // shown greyed out and cannot be clicked, instead of being hidden. Seeing a locked
  // KSeFFlow tells someone there is a module to ask their administrator for; a module
  // that simply is not there tells them nothing.
  //
  // The rule itself is unchanged: ROLE_SUPER_ADMIN may open every module, everyone else
  // only the ones listed in their own moduleIds (set by their administrator, from what
  // the company's plan includes).
  //
  // THIS IS A CONVENIENCE, NOT A SECURITY BOUNDARY. Nothing here protects data — each
  // module app checks the session and this person's own permissions again on its side,
  // and the backend refuses anything they were not granted. Greying out a button only
  // stops someone walking into a door that would be shut in their face anyway.
  const canOpenModule = (moduleKey) =>
    user?.role === 'ROLE_SUPER_ADMIN' || (user?.moduleIds ?? []).includes(moduleKey);

  const grantedModuleCount = ALL_MODULES.filter((m) => canOpenModule(m.moduleKey)).length;

  // Every module button, with the one thing that differs between them worked out once:
  // WHERE it goes.
  //   launchUrl → the module is its own app; open it in a new tab (see config/moduleApps.js)
  //   path      → the module still lives inside this hub; navigate normally
  //   neither   → nothing to open, so the button is shown locked
  //
  // The last case is not just theory: a platform super-admin belongs to no single company,
  // so there is no /company/{id}/dashboard to send them to. A module with its own app has
  // no in-hub page to fall back on, so it must lock rather than navigate to a dead route.
  const moduleLinks = ALL_MODULES.map((item) => {
    const allowed   = canOpenModule(item.moduleKey);
    const launchUrl = allowed ? moduleAppUrl(item.moduleKey, user?.tenantId) : null;
    return {
      ...item,
      allowed,
      launchUrl,
      // Why it is locked, so the tooltip can say something true and useful.
      lockReason: !allowed
        ? `${item.title} is not enabled for your account. Ask your administrator for access.`
        : (!launchUrl && !item.path)
          ? `${item.title} opens for a company. Your account is not linked to one.`
          : null,
    };
  });

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-slate-50 font-sans antialiased text-slate-900">
        <Sidebar className="border-r border-red-900 bg-red-700 text-red-100">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-red-700 font-bold text-xl shadow-lg shadow-red-900/30">
                R
              </div>
              <span className="text-lg font-bold tracking-tight text-white">RegulaOne</span>
            </div>

            {/* Which organisation the screen is showing. It is a label, not a switcher:
                a person belongs to exactly one organisation, so it no longer styles
                itself as clickable (it never did anything when clicked). */}
            <div className="mt-3">
              <div className="bg-red-800/60 rounded-md p-3 flex items-center justify-between gap-2 border border-red-600/50">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold text-red-300 tracking-wider">Organisation</span>
                  <span className="text-sm text-white font-medium truncate">{tenantLabel}</span>
                </div>
                <Users className="w-3 h-3 text-red-300 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3">
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-[10px] uppercase font-bold text-red-300 mb-1 mt-2 tracking-widest">Platform Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navItems.filter(item => item.roles.includes(user?.role || '')).map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        render={<Link to={item.path} />}
                        isActive={location.pathname === item.path}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${location.pathname === item.path ? 'bg-white text-red-700 font-semibold' : 'text-red-100 hover:bg-red-600 hover:text-white'}`}
                      >
                        <item.icon className="h-4 w-4 opacity-80" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-3">
              <SidebarGroupLabel className="px-2 text-[10px] uppercase font-bold text-red-300 mb-1 tracking-widest">Enabled Modules</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {grantedModuleCount === 0 && (
                    <p className="px-3 pb-1 text-[10px] text-red-300/90 italic leading-snug">
                      No modules assigned — ask your administrator for access.
                    </p>
                  )}

                  {moduleLinks.map((item) => {
                    const isActive = Boolean(item.path) && location.pathname === item.path;

                    // ── Locked: shown, explained, and genuinely not clickable ──
                    // A real disabled <button> is used rather than a styled link, so it is
                    // also skipped by keyboard tabbing and ignored by screen readers'
                    // activation — "looks disabled" is not the same as "is disabled".
                    if (item.lockReason) {
                      return (
                        // The explanation sits on the <li>, not on the button: browsers
                        // suppress pointer events on a disabled control, so a title there
                        // would never show a tooltip. The button keeps pointer-events-none
                        // so the hover reaches this wrapper instead.
                        <SidebarMenuItem
                          key={item.moduleKey}
                          className="cursor-not-allowed"
                          title={item.lockReason}
                        >
                          <SidebarMenuButton
                            disabled
                            aria-disabled="true"
                            className="flex w-full items-center gap-3 px-3 py-1.5 rounded-md text-sm text-red-300/50 opacity-60 pointer-events-none"
                          >
                            <div className={`w-2 h-2 rounded-full ${item.dotColor} opacity-40`}></div>
                            <span className="font-medium">{item.title}</span>
                            <Lock className="ml-auto h-3 w-3" aria-hidden="true" />
                            <span className="sr-only">— unavailable</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    // ── Allowed, and the module is its own application: new tab ──
                    // rel="noopener noreferrer" is required, not cosmetic: without noopener
                    // the page we open can reach back through window.opener and navigate
                    // this tab somewhere of its choosing (reverse tabnabbing).
                    if (item.launchUrl) {
                      return (
                        <SidebarMenuItem key={item.moduleKey}>
                          <SidebarMenuButton
                            render={
                              <a
                                href={item.launchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${item.title} (opens in a new tab)`}
                              />
                            }
                            title={`Open ${item.title} in a new tab`}
                            className="flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-all duration-200 text-red-100 hover:bg-red-600 hover:text-white"
                          >
                            <div className={`w-2 h-2 rounded-full ${item.dotColor}`}></div>
                            <span className="font-medium">{item.title}</span>
                            <ExternalLink className="ml-auto h-3 w-3 opacity-60" aria-hidden="true" />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    // ── Allowed, and the module still lives inside the hub ──
                    return (
                      <SidebarMenuItem key={item.moduleKey}>
                        <SidebarMenuButton
                          render={<Link to={item.path} />}
                          isActive={isActive}
                          className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${isActive ? 'bg-white text-red-700 font-semibold' : 'text-red-100 hover:bg-red-600 hover:text-white'}`}
                        >
                          <div className={`w-2 h-2 rounded-full ${item.dotColor}`}></div>
                          <span className="font-medium">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-red-600">
            <div className="flex items-center gap-2 px-1">
              <Link to={`/company/${tid}/profile`} className="flex items-center gap-2 min-w-0 flex-1 group">
                <Avatar className="h-8 w-8 border border-red-500 bg-red-800 flex-shrink-0">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                  <AvatarFallback className="bg-red-800 text-red-200">{user?.email?.[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-white font-medium truncate group-hover:text-red-200 transition-colors">{user?.displayName ?? user?.email?.split('@')[0]}</span>
                  <span className="text-[10px] text-red-300 uppercase font-bold tracking-tighter">{user?.role?.replace('ROLE_', '').replace(/_/g, ' ')}</span>
                </div>
              </Link>
              <ConfirmedLogoutButton
                size="icon"
                className="ml-auto h-8 w-8 text-red-300 hover:text-white hover:bg-red-600 flex-shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </ConfirmedLogoutButton>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col bg-slate-50 min-w-0">
          {/*
            The header carries only controls that DO something.

            Removed, and why:
              * a search box that was never wired to anything — an input that swallows
                what you type and answers nothing is worse than no search at all;
              * a settings gear with no action behind it (account settings live under
                the profile link in the sidebar footer);
              * an "EU-CENTRAL-1 ACTIVE" badge with a pulsing green dot. Nothing checked
                any region's health, so the dot asserted a live status the application
                does not measure — and a hosting-region claim is exactly the kind of
                statement a customer would rely on when assessing data residency.
          */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between gap-4 px-4 sm:px-8 sticky top-0 z-20">
            <SidebarTrigger className="text-slate-400 hover:text-slate-600" />
            <div className="flex items-center gap-2 text-slate-500">
              <NotificationBell />
            </div>
          </header>

          {/* Expiring-soon warning — dismissable, only when plan hasn't expired yet */}
          {user?.planExpiringSoon && user?.role !== 'ROLE_SUPER_ADMIN' && <PlanExpiryBanner />}

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 xl:px-12">
            <Outlet />
          </main>

          {/*
            The footer previously showed a hardcoded version and build number that were
            never updated by any build, next to an "EEA Compliant" badge. Neither was
            backed by anything: the first was invented, and the second is a claim about
            hosting and data protection that this application cannot demonstrate on its
            own. Both are gone; what is left is what is simply true.
          */}
          <footer className="min-h-8 py-2 bg-white border-t border-slate-200 px-4 sm:px-8 flex items-center justify-center sm:justify-end text-[10px] text-slate-400 font-medium text-center">
            © 2026 RegulaOne
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
