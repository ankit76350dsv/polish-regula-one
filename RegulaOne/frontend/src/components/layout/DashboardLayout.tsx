// Firebase signOut removed - logout now clears authStore directly
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger,
  SidebarInset, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Building2, ReceiptText, Clock, ShieldAlert, LogOut, Search, Bell, Settings,
  MessageSquare, Trash2, ShieldCheck, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Toaster } from '@/components/ui/sonner';

export default function DashboardLayout() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  // Tenant display label based on role
  const tenantLabel = user?.role === 'SUPER_ADMIN'
    ? 'Global HQ (Root)'
    : user?.tenantId === 'tenant-001'
      ? 'PolCorp Sp. z o.o.'
      : 'My Tenant';

  const navItems = [
    { title: 'Overview', icon: LayoutDashboard, path: '/', roles: ['SUPER_ADMIN', 'ADMIN', 'USER'] },
    { title: 'Tenants', icon: Building2, path: '/tenants', roles: ['SUPER_ADMIN'] },
  ];

  const moduleItems = [
    { title: 'KSeFFlow', icon: ReceiptText, path: '/modules/ksef', roles: ['ADMIN', 'USER', 'SUPER_ADMIN'] },
    { title: 'WorkPulse', icon: Clock, path: '/modules/workpulse', roles: ['ADMIN', 'USER', 'SUPER_ADMIN'] },
    { title: 'SafeWork', icon: ShieldCheck, path: '/modules/safework', roles: ['ADMIN', 'USER', 'SUPER_ADMIN'] },
    { title: 'SafeVoice', icon: MessageSquare, path: '/modules/safevoice', roles: ['ADMIN', 'USER', 'SUPER_ADMIN'] },
    { title: 'WasteSync', icon: Trash2, path: '/modules/wastesync', roles: ['ADMIN', 'USER', 'SUPER_ADMIN'] },
    { title: 'PrivacyPilot', icon: ShieldAlert, path: '/modules/privacypilot', roles: ['ADMIN', 'USER', 'SUPER_ADMIN'] },
  ];

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
                  {moduleItems.map((item, index) => {
                    const dotColors = ['bg-blue-300', 'bg-green-300', 'bg-amber-300', 'bg-orange-300', 'bg-red-300', 'bg-emerald-300'];
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          render={<Link to={item.path} />}
                          isActive={location.pathname === item.path}
                          className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${location.pathname === item.path ? 'bg-white text-red-700 font-semibold' : 'text-red-100 hover:bg-red-600 hover:text-white'}`}
                        >
                          <div className={`w-2 h-2 rounded-full ${dotColors[index % dotColors.length]}`}></div>
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
              <Avatar className="h-8 w-8 border border-red-500 bg-red-800">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                <AvatarFallback className="bg-red-800 text-red-200">{user?.email?.[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-white font-medium truncate">{user?.displayName ?? user?.email?.split('@')[0]}</span>
                <span className="text-[10px] text-red-300 uppercase font-bold tracking-tighter">{user?.role}</span>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-red-300 hover:text-white hover:bg-red-600" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col bg-slate-50">
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
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700 relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              </Button>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </header>

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
