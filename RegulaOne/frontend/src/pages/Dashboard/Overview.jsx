import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { tenantService } from '../../services/tenantService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Building2, Users, ReceiptText, Activity, ShieldCheck, Clock, FileText, CheckSquare, Loader2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// ─── Mock data sets per role ───────────────────────────────────────────────

// OLD MOCK — SuperAdminView now fetches revenue data from GET /api/superadmin/overview
// const revenueData = [
//   { name: 'Jan', value: 4000 },
//   { name: 'Feb', value: 3000 },
//   { name: 'Mar', value: 2000 },
//   { name: 'Apr', value: 2780 },
//   { name: 'May', value: 1890 },
//   { name: 'Jun', value: 2390 },
// ];

const invoiceData = [
  { name: 'Jan', value: 210 },
  { name: 'Feb', value: 340 },
  { name: 'Mar', value: 290 },
  { name: 'Apr', value: 480 },
  { name: 'May', value: 390 },
  { name: 'Jun', value: 520 },
];

const recentTenantActivity = [
  { tenant: 'PolCorp Sp. z o.o.', action: 'Bulk Invoice Sync', status: 'SUCCESS', mod: 'KSeFFlow', time: '2m ago' },
  { tenant: 'Vistula Logistics', action: 'BDO Waste Report Gen', status: 'PENDING', mod: 'WasteSync', time: '14m ago' },
  { tenant: 'Amber Tech Group', action: 'User Permission Edit', status: 'SUCCESS', mod: 'RBAC System', time: '28m ago' },
  { tenant: 'Nordic Services PL', action: 'GDPR DPIA Detection', status: 'FAILURE', mod: 'PrivacyPilot', time: '1h ago' },
];

const recentModuleActivity = [
  { user: 'anna.kowalska', action: 'Invoice #INV-2026-0847 submitted', status: 'SUCCESS', mod: 'KSeFFlow', time: '5m ago' },
  { user: 'jan.nowak', action: 'Clock-in recorded', status: 'SUCCESS', mod: 'WorkPulse', time: '22m ago' },
  { user: 'piotr.wiśniewski', action: 'BHP training expiring in 3 days', status: 'PENDING', mod: 'SafeWork', time: '1h ago' },
  { user: 'maria.zielińska', action: 'Waste report draft saved', status: 'SUCCESS', mod: 'WasteSync', time: '2h ago' },
];

// ─── Sub-views ─────────────────────────────────────────────────────────────

// Dot colours for each module in the Module Usage bar chart.
const MODULE_COLORS = {
  KSEFFLOW:     'bg-blue-500',
  WORKPULSE:    'bg-green-500',
  SAFEWORK:     'bg-amber-500',
  SAFEVOICE:    'bg-orange-500',
  WASTESYNC:    'bg-rose-500',
  PRIVACYPILOT: 'bg-red-500',
};

// Returns a Tailwind text-colour class based on the trend string.
function trendColor(t) {
  if (!t || t === 'steady' || t === '—') return 'text-slate-400';
  if (t.startsWith('+') || t === 'New') return 'text-emerald-500';
  return 'text-rose-500';
}

// Formats a raw BigDecimal MRR number as "€82.4k" or "€950".
function fmtRevenue(val) {
  const n = Number(val ?? 0);
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${n.toFixed(0)}`;
}

function SuperAdminView() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['platform-overview'],
    queryFn:  tenantService.getPlatformOverview,
    staleTime: 60_000,
  });

  const stats = [
    {
      title: 'Active Tenants',
      value: isLoading ? '…' : String(overview?.activeTenants ?? '—'),
      icon: Building2,
      trend: overview?.tenantTrend ?? '—',
      trendColor: trendColor(overview?.tenantTrend),
    },
    {
      title: 'Total Users',
      value: isLoading ? '…' : (overview?.totalUsers?.toLocaleString() ?? '—'),
      icon: Users,
      trend: overview?.userTrend ?? '—',
      trendColor: trendColor(overview?.userTrend),
    },
    {
      title: 'Monthly Revenue',
      value: isLoading ? '…' : fmtRevenue(overview?.monthlyRevenue),
      icon: Activity,
      trend: overview?.revenueTrend ?? '—',
      trendColor: trendColor(overview?.revenueTrend),
    },
    {
      title: 'Compliance Score',
      value: isLoading ? '…' : (overview?.complianceScore ?? '—'),
      icon: ShieldCheck,
      trend: 'Target: 100%',
      trendColor: 'text-red-500',
    },
  ];

  // Map backend MonthlyRevenueStat[] to recharts data format
  const chartData = (overview?.revenueByMonth ?? []).map((m) => ({
    name:  m.month,
    value: Number(m.value ?? 0),
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Overview</h1>
        <p className="text-sm text-slate-500 font-medium">
          Monitoring{' '}
          <span className="font-bold text-slate-700">
            {isLoading ? '…' : (overview?.activeTenants ?? '—')}
          </span>{' '}
          enterprise tenants across 6 modules.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</div>
                <span className={`text-[10px] font-bold ${stat.trendColor}`}>{stat.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Revenue chart + Module usage ─────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">Platform Revenue Growth</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[260px]">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-200" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: '#dc2626', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">Module Usage</CardTitle>
          </CardHeader>
          <CardContent className="py-6 space-y-5">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                  <div className="h-1.5 w-full bg-slate-100 rounded-full animate-pulse" />
                </div>
              ))
            ) : (
              (overview?.moduleUsage ?? []).map((mod) => (
                <div key={mod.module}>
                  <div className="flex justify-between text-[10px] font-bold mb-1.5">
                    <span className="text-slate-500 tracking-wider">{mod.module}</span>
                    <span className="text-slate-900">{mod.usagePct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${MODULE_COLORS[mod.module] ?? 'bg-slate-400'}`}
                      style={{ width: `${mod.usagePct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Tenant Activity (mock — audit log API not yet built) ───── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-800">Recent Tenant Activity</h2>
            <span className="text-[10px] text-red-600 font-bold cursor-pointer uppercase tracking-wider hover:underline">View All Audit Logs</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Tenant</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Action</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Status</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Module</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTenantActivity.map((log, i) => (
                <TableRow key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6 py-4 text-xs font-semibold text-slate-700">{log.tenant}</TableCell>
                  <TableCell className="px-6 py-4 text-xs text-slate-500">{log.action}</TableCell>
                  <TableCell className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : log.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs text-slate-500">{log.mod}</TableCell>
                  <TableCell className="px-6 py-4 text-right text-xs text-slate-400 font-medium">{log.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminView() {
  const stats = [
    { title: 'Active Users', value: '48', icon: Users, trend: '+3 this month', trendColor: 'text-emerald-500' },
    { title: 'Active Modules', value: '6 / 6', icon: ShieldCheck, trend: 'All enabled', trendColor: 'text-red-500' },
    { title: 'Invoices (Jun)', value: '1,247', icon: ReceiptText, trend: '+18%', trendColor: 'text-emerald-500' },
    { title: 'Compliance Score', value: '94.2%', icon: Activity, trend: '▲ from 91%', trendColor: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tenant Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium">PolCorp Sp. z o.o. — Active since Jan 2024</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">Export Report</Button>
          <Button className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm">+ Invite User</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</div>
                <span className={`text-[10px] font-bold ${stat.trendColor}`}>{stat.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">Invoice Volume (KSeF)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={invoiceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: '#dc2626', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">Compliance Alerts</CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-3">
            {[
              { label: 'BHP training expiry — 2 users', severity: 'bg-amber-50 text-amber-700 border-amber-100' },
              { label: 'GDPR register review overdue', severity: 'bg-rose-50 text-rose-700 border-rose-100' },
              { label: 'KSeF certificate renews in 14d', severity: 'bg-blue-50 text-blue-700 border-blue-100' },
              { label: 'All invoices submitted on time', severity: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            ].map((alert, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium ${alert.severity}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
                {alert.label}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-800">Recent Module Activity</h2>
            <span className="text-[10px] text-red-600 font-bold cursor-pointer uppercase tracking-wider hover:underline">View Full Log</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">User</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Action</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Status</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Module</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentModuleActivity.map((log, i) => (
                <TableRow key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6 py-4 text-xs font-semibold text-slate-700 font-mono">{log.user}</TableCell>
                  <TableCell className="px-6 py-4 text-xs text-slate-500">{log.action}</TableCell>
                  <TableCell className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : log.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs text-slate-500">{log.mod}</TableCell>
                  <TableCell className="px-6 py-4 text-right text-xs text-slate-400 font-medium">{log.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UserView() {
  const { user } = useAuthStore();
  const name = user?.displayName ?? 'there';

  const stats = [
    { title: 'Pending Tasks', value: '3', icon: CheckSquare, trend: '1 urgent', trendColor: 'text-amber-500' },
    { title: 'Invoices (Jun)', value: '12', icon: ReceiptText, trend: 'All submitted', trendColor: 'text-emerald-500' },
    { title: 'Compliance Status', value: 'OK', icon: ShieldCheck, trend: 'Valid until Aug', trendColor: 'text-red-500' },
    { title: 'Shift Today', value: '08:00–16:00', icon: Clock, trend: 'Clocked in', trendColor: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Workspace</h1>
          <p className="text-sm text-slate-500 font-medium">Welcome back, {name}. Here's your compliance snapshot.</p>
        </div>
        <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">
          <FileText className="h-3.5 w-3.5 mr-2" /> My Reports
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</div>
                <span className={`text-[10px] font-bold ${stat.trendColor}`}>{stat.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">My Tasks</CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-3">
            {[
              { label: 'Submit June waste report by 30.06', done: false, urgent: true },
              { label: 'Sign updated GDPR consent form', done: false, urgent: false },
              { label: 'BHP refresher training scheduled', done: false, urgent: false },
              { label: 'April invoices reviewed', done: true, urgent: false },
              { label: 'Clock-out submitted for 13.06', done: true, urgent: false },
            ].map((task, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${task.done ? 'bg-emerald-500 border-emerald-500' : task.urgent ? 'border-amber-400' : 'border-slate-200'}`}>
                  {task.done && <div className="w-2 h-2 rounded-sm bg-white" />}
                </div>
                <span className={`text-xs font-medium ${task.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.label}</span>
                {task.urgent && !task.done && <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full">URGENT</span>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">My Compliance Documents</CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-3">
            {[
              { label: 'Medical Certificate', expiry: '2026-11-30', status: 'bg-emerald-50 text-emerald-700 border-emerald-100', statusLabel: 'VALID' },
              { label: 'BHP Training', expiry: '2026-08-15', status: 'bg-emerald-50 text-emerald-700 border-emerald-100', statusLabel: 'VALID' },
              { label: 'Fire Safety Certificate', expiry: '2026-06-01', status: 'bg-amber-50 text-amber-700 border-amber-100', statusLabel: 'EXPIRING' },
              { label: 'Data Processing Agreement', expiry: '2027-01-01', status: 'bg-emerald-50 text-emerald-700 border-emerald-100', statusLabel: 'VALID' },
            ].map((doc, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                <div>
                  <p className="text-xs font-semibold text-slate-700">{doc.label}</p>
                  <p className="text-[10px] text-slate-400">Expires {doc.expiry}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${doc.status}`}>{doc.statusLabel}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function Overview() {
  const { user } = useAuthStore();

  if (user?.role === 'ROLE_SUPER_ADMIN') return <SuperAdminView />;
  if (user?.role === 'ROLE_ADMIN') return <AdminView />;
  return <UserView />;
}
