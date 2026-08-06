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
  LayoutDashboard, Building2, ReceiptText, Clock, ShieldAlert, LogOut, Search, Settings,
  MessageSquare, Trash2, ShieldCheck, Users, Package, Lock, ExternalLink
} from 'lucide-react';
import { moduleAppUrl } from '../../config/moduleApps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  // All compliance modules with their backend enum key for access control.
  const ALL_MODULES = [
    { title: 'KSeFFlow',    icon: ReceiptText,   path: `/company/${tid}/modules/ksef`,         moduleKey: 'KSEFFLOW',     dotColor: 'bg-blue-300' },
    { title: 'SafeVoice',   icon: MessageSquare, path: `/company/${tid}/modules/safevoice`,    moduleKey: 'SAFEVOICE',    dotColor: 'bg-orange-300' },
    { title: 'PrivacyPilot',icon: ShieldAlert,   path: `/company/${tid}/modules/privacypilot`, moduleKey: 'PRIVACYPILOT', dotColor: 'bg-emerald-300' },
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
  //   launchUrl  → the module runs as its own app; open it in a new tab (see config/moduleApps.js)
  //   otherwise  → the module still lives inside the hub; navigate normally
  const moduleLinks = ALL_MODULES.map((item) => ({
    ...item,
    allowed:   canOpenModule(item.moduleKey),
    launchUrl: canOpenModule(item.moduleKey)
      ? moduleAppUrl(item.moduleKey, user?.tenantId)
      : null,
  }));

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

            <div className="mt-3">
              <div className="bg-red-800/60 rounded-md p-3 flex items-center justify-between cursor-pointer border border-red-600/50 hover:bg-red-800 transition-colors">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-red-300 tracking-wider">Active Tenant</span>
                  <span className="text-sm text-white font-medium">{tenantLabel}</span>
                </div>
                <Users className="w-3 h-3 text-red-300" />
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
                    const isActive = location.pathname === item.path;

                    // ── Locked: shown, explained, and genuinely not clickable ──
                    // A real disabled <button> is used rather than a styled link, so it is
                    // also skipped by keyboard tabbing and ignored by screen readers'
                    // activation — "looks disabled" is not the same as "is disabled".
                    if (!item.allowed) {
                      return (
                        // The explanation sits on the <li>, not on the button: browsers
                        // suppress pointer events on a disabled control, so a title there
                        // would never show a tooltip. The button keeps pointer-events-none
                        // so the hover reaches this wrapper instead.
                        <SidebarMenuItem
                          key={item.path}
                          className="cursor-not-allowed"
                          title={`${item.title} is not enabled for your account. Ask your administrator for access.`}
                        >
                          <SidebarMenuButton
                            disabled
                            aria-disabled="true"
                            className="flex w-full items-center gap-3 px-3 py-1.5 rounded-md text-sm text-red-300/50 opacity-60 pointer-events-none"
                          >
                            <div className={`w-2 h-2 rounded-full ${item.dotColor} opacity-40`}></div>
                            <span className="font-medium">{item.title}</span>
                            <Lock className="ml-auto h-3 w-3" aria-hidden="true" />
                            <span className="sr-only">— no access</span>
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
                        <SidebarMenuItem key={item.path}>
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

                    // ── Allowed, but the module still lives inside the hub ──
                    return (
                      <SidebarMenuItem key={item.path}>
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
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
            <div className="flex items-center gap-6 flex-1">
              <SidebarTrigger className="text-slate-400 hover:text-slate-600" />
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search across tenants, modules or logs..."
                  className="w-full bg-slate-50 border-slate-200 rounded-full py-2 pl-10 pr-4 text-xs focus-visible:ring-red-500/20 focus-visible:ring-offset-0 focus-visible:border-red-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-6 text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-bold uppercase tracking-wider">EU-CENTRAL-1 ACTIVE</span>
              </div>
              <div className="h-4 w-[1px] bg-slate-200"></div>
              <NotificationBell />
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </header>

          {/* Expiring-soon warning — dismissable, only when plan hasn't expired yet */}
          {user?.planExpiringSoon && user?.role !== 'ROLE_SUPER_ADMIN' && <PlanExpiryBanner />}

          <main className="flex-1 overflow-y-auto p-8 lg:px-12">
            <Outlet />
          </main>

          <footer className="h-8 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <div className="flex gap-4">
              <span>v4.2.0-stable</span>
              <span>Build #2026.05.14</span>
              <span>EEA Compliant</span>
            </div>
            <div>
              © 2026 RegulaOne Platform • Polish Compliance Hub
            </div>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
