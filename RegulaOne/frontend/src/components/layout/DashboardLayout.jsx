import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';
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
  MessageSquare, Trash2, ShieldCheck, Users, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Toaster } from '@/components/ui/sonner';
import NotificationBell from '../notifications/NotificationBell';

export default function DashboardLayout() {
  const { user } = useAuthStore();
  const location  = useLocation();
  const logout    = useLogout();

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
  // ROLE_SUPER_ADMIN sees every module regardless of moduleIds.
  // ROLE_ADMIN and ROLE_USER only see the modules listed in user.moduleIds.
  const ALL_MODULES = [
    { title: 'KSeFFlow',    icon: ReceiptText,   path: `/company/${tid}/modules/ksef`,         moduleKey: 'KSEFFLOW',     dotColor: 'bg-blue-300' },
    { title: 'WorkPulse',   icon: Clock,         path: `/company/${tid}/modules/workpulse`,    moduleKey: 'WORKPULSE',    dotColor: 'bg-green-300' },
    { title: 'SafeWork',    icon: ShieldCheck,   path: `/company/${tid}/modules/safework`,     moduleKey: 'SAFEWORK',     dotColor: 'bg-amber-300' },
    { title: 'SafeVoice',   icon: MessageSquare, path: `/company/${tid}/modules/safevoice`,    moduleKey: 'SAFEVOICE',    dotColor: 'bg-orange-300' },
    { title: 'WasteSync',   icon: Trash2,        path: `/company/${tid}/modules/wastesync`,    moduleKey: 'WASTESYNC',    dotColor: 'bg-red-300' },
    { title: 'PrivacyPilot',icon: ShieldAlert,   path: `/company/${tid}/modules/privacypilot`, moduleKey: 'PRIVACYPILOT', dotColor: 'bg-emerald-300' },
  ];

  const visibleModules = user?.role === 'ROLE_SUPER_ADMIN'
    ? ALL_MODULES
    : ALL_MODULES.filter((m) => (user?.moduleIds ?? []).includes(m.moduleKey));

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
                  {visibleModules.length === 0 ? (
                    <p className="px-3 py-2 text-[10px] text-red-400 italic">No modules assigned</p>
                  ) : visibleModules.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        render={<Link to={item.path} />}
                        isActive={location.pathname === item.path}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${location.pathname === item.path ? 'bg-white text-red-700 font-semibold' : 'text-red-100 hover:bg-red-600 hover:text-white'}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${item.dotColor}`}></div>
                        <span className="font-medium">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-red-300 hover:text-white hover:bg-red-600 flex-shrink-0" disabled={logout.isPending} onClick={() => logout.mutate()}>
                <LogOut className="h-4 w-4" />
              </Button>
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
      <Toaster />
    </SidebarProvider>
  );
}
