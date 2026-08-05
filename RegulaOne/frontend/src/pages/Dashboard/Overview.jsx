import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { tenantService } from '../../services/tenantService';
import {
  fetchCompanyOverview,
  selectCompanyOverview,
  selectCompanyOverviewError,
  selectCompanyOverviewIsInitialLoad,
  selectCompanyOverviewLoadedAt,
  selectCompanyOverviewStatus,
} from '../../slices/companyOverviewSlice';
import {
  fetchMyOverview,
  selectMyOverview,
  selectMyOverviewError,
  selectMyOverviewIsInitialLoad,
  selectMyOverviewLoadedAt,
  selectMyOverviewStatus,
} from '../../slices/myOverviewSlice';
import {
  attentionLabel, cardStatusLabel, documentTypeLabel, formatDate, formatMetric,
  metricLabel, moduleLabel, moneyMetricLabel, statusValueLabel, text,
} from '../../lib/dashboardLabels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Building2, Users, Activity, ShieldCheck, Clock, FileText, CheckSquare, Loader2,
  AlertTriangle, ArrowUpRight, CalendarClock, Lock, RefreshCw, ShieldOff, TriangleAlert,
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

// OLD MOCK — the company-admin (ROLE_ADMIN) dashboard no longer invents figures.
// AdminView now reads GET /api/admin/overview through the companyOverview Redux
// slice, which returns REAL counts and legal deadlines from all six modules.
//
// const invoiceData = [ { name: 'Jan', value: 210 }, ... ];          // fake KSeF chart
// const recentModuleActivity = [ { user: 'anna.kowalska', ... } ];   // fake audit feed
//
// Why they had to go: this screen is what a company administrator uses to judge
// whether the business is compliant. Numbers that look plausible but are invented
// are worse than no numbers at all — they hide real missed deadlines (a rejected
// KSeF invoice, an expired medical certificate, a breach past its 72-hour UODO
// window) behind a reassuring green dashboard.

const recentTenantActivity = [
  { tenant: 'PolCorp Sp. z o.o.', action: 'Bulk Invoice Sync', status: 'SUCCESS', mod: 'KSeFFlow', time: '2m ago' },
  { tenant: 'Vistula Logistics', action: 'BDO Waste Report Gen', status: 'PENDING', mod: 'WasteSync', time: '14m ago' },
  { tenant: 'Amber Tech Group', action: 'User Permission Edit', status: 'SUCCESS', mod: 'RBAC System', time: '28m ago' },
  { tenant: 'Nordic Services PL', action: 'GDPR DPIA Detection', status: 'FAILURE', mod: 'PrivacyPilot', time: '1h ago' },
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

// ─── Company-admin (ROLE_ADMIN) compliance dashboard ───────────────────────
//
// Everything on this screen comes from ONE server call, GET /api/admin/overview,
// held in the companyOverview Redux slice. The server counts the records and works
// out every legal deadline — the 72-hour breach window, the 7-day whistleblower
// acknowledgement, the 30-day certificate warning, the 15 March BDO filing date —
// so this component only formats what it is given. It never adds numbers up and
// never computes a due date, which is what keeps this screen and each module's own
// dashboard from quietly disagreeing.
//
// The response carries no personal data: only counts, totals and dates. See the
// backend CompanyOverviewResponse for what is deliberately left out and why.

// Tailwind classes for each tone the server can put on a figure.
const TONE_TEXT = {
  RISK: 'text-rose-600',
  WARN: 'text-amber-600',
  GOOD: 'text-emerald-600',
  NEUTRAL: 'text-slate-900',
};

const TONE_PANEL = {
  RISK: 'bg-rose-50 text-rose-700 border-rose-100',
  WARN: 'bg-amber-50 text-amber-700 border-amber-100',
  GOOD: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  NEUTRAL: 'bg-slate-50 text-slate-700 border-slate-100',
};

// Why a module card carries no figures — each needs a different icon so the
// difference between "not bought" and "not granted to you" is obvious at a glance.
const CARD_STATUS_ICONS = {
  NOT_IN_PLAN: ShieldOff,
  NO_ACCESS: Lock,
  RESTRICTED: Lock,
  UNAVAILABLE: TriangleAlert,
};

// One stat card in the top row.
function StatCard({ title, value, icon: Icon, note, noteColor }) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-300" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
          {note && <span className={`text-[10px] font-bold ${noteColor ?? 'text-slate-400'}`}>{note}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// One module's card: either its figures, or the reason it has none.
function ModuleCard({ card, moduleBase }) {
  const dot = MODULE_COLORS[card.module] ?? 'bg-slate-400';

  if (card.status !== 'OK') {
    const Icon = CARD_STATUS_ICONS[card.status] ?? TriangleAlert;
    return (
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader className="border-b border-slate-50 py-3">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dot} opacity-40`} />
            <CardTitle className="text-xs font-bold text-slate-500">{moduleLabel(card.module)}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-start gap-2.5 text-xs text-slate-500">
            <Icon className="h-4 w-4 text-slate-300 flex-shrink-0 mt-px" />
            <span>{cardStatusLabel(card.status)}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm hover:border-slate-300 transition-all rounded-xl">
      <CardHeader className="border-b border-slate-50 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <CardTitle className="text-xs font-bold text-slate-800">{moduleLabel(card.module)}</CardTitle>
          </div>
          <Link
            to={`${moduleBase}/${card.module.toLowerCase() === 'ksefflow' ? 'ksef' : card.module.toLowerCase()}`}
            className="text-[10px] font-bold uppercase tracking-wider text-red-600 hover:underline inline-flex items-center gap-0.5"
          >
            {text('open')} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="py-3 divide-y divide-slate-50">
        {card.metrics.map((metric) => (
          <div key={metric.key} className="flex items-center justify-between gap-4 py-1.5">
            <div className="min-w-0">
              <p className="text-xs text-slate-600 truncate">
                {metric.unit === 'MONEY' ? moneyMetricLabel(metric.key) : metricLabel(metric.key)}
              </p>
              {/* The rule this figure exists for, so a number is never just a number. */}
              {metric.legalRef && (
                <p className="text-[9px] text-slate-400 truncate" title={metric.legalRef}>{metric.legalRef}</p>
              )}
            </div>
            <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${TONE_TEXT[metric.tone] ?? TONE_TEXT.NEUTRAL}`}>
              {formatMetric(metric)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AdminView() {
  const dispatch = useDispatch();
  const { tenantId } = useParams();

  const overview = useSelector(selectCompanyOverview);
  const status = useSelector(selectCompanyOverviewStatus);
  const error = useSelector(selectCompanyOverviewError);
  const loadedAt = useSelector(selectCompanyOverviewLoadedAt);
  const isInitialLoad = useSelector(selectCompanyOverviewIsInitialLoad);

  // Load once when the screen opens. The slice keeps the snapshot, so navigating
  // away and back does not refetch until the admin asks for it.
  useEffect(() => {
    if (status === 'idle') dispatch(fetchCompanyOverview());
  }, [dispatch, status]);

  // Where the module links point. The company id in the URL is display-only — the
  // server always answers for the signed-in user's own company.
  const moduleBase = `/company/${tenantId ?? overview?.company?.id ?? 'platform'}/modules`;

  // ── First load: nothing to show yet ──────────────────────────────────────
  if (isInitialLoad) {
    return (
      <div className="max-w-7xl mx-auto py-24 flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        <p className="text-xs text-slate-400 font-medium">{text('title')}…</p>
      </div>
    );
  }

  // ── Failed with nothing cached ───────────────────────────────────────────
  if (!overview) {
    return (
      <div className="max-w-7xl mx-auto py-24 flex flex-col items-center gap-4">
        <AlertTriangle className="h-6 w-6 text-rose-400" />
        <p className="text-sm text-slate-600 font-medium">{error?.message ?? text('loadFailed')}</p>
        <Button
          onClick={() => dispatch(fetchCompanyOverview())}
          className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> {text('refresh')}
        </Button>
      </div>
    );
  }

  const { company, plan, headline, modules, attention, invoiceVolume, recentActivity } = overview;
  const isRefreshing = status === 'loading';

  // Plan note: how long is left, or that it has already lapsed. An expired plan is
  // a compliance risk in itself — filing tools stop working.
  const planNote = plan?.daysRemaining === null || plan?.daysRemaining === undefined
    ? text('noExpiry')
    : plan.expired
      ? text('planExpired')
      : `${plan.daysRemaining} ${text('daysLeft')}`;

  const seatsNote = headline.seatsCapacity != null
    ? `${text('seatsOf')} ${headline.seatsCapacity}`
    : `${headline.newUsersThisMonth} ${text('newThisMonth')}`;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{text('title')}</h1>
          <p className="text-sm text-slate-500 font-medium">
            {company?.name}
            {company?.nip && <> · {text('subtitleWithNip')} {company.nip}</>}
            {plan?.packageName && <> · {plan.packageName}</>}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{text('minimisationNote')}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            variant="outline"
            onClick={() => dispatch(fetchCompanyOverview())}
            disabled={isRefreshing}
            className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> {text('refresh')}
          </Button>
          {loadedAt && (
            <span className="text-[10px] text-slate-400">
              {text('updatedAt')} {formatDate(loadedAt, true)}
            </span>
          )}
        </div>
      </div>

      {/* A failed refresh keeps the previous figures on screen but says so, rather
          than silently showing yesterday's compliance position as today's. */}
      {status === 'failed' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium bg-amber-50 text-amber-700 border-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {text('staleWarning')}
        </div>
      )}

      {/* ── Headline figures ────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={text('headlineActiveUsers')}
          value={headline.activeUsers}
          icon={Users}
          note={seatsNote}
          noteColor="text-slate-400"
        />
        <StatCard
          title={text('headlineModules')}
          value={`${headline.modulesVisible} / ${headline.modulesEntitled}`}
          icon={ShieldCheck}
          note={company?.status}
          noteColor={company?.status === 'ACTIVE' ? 'text-emerald-500' : 'text-rose-500'}
        />
        <StatCard
          title={text('headlineOpenActions')}
          value={headline.openComplianceActions}
          icon={Activity}
          note={headline.overdueComplianceActions > 0
            ? `${headline.overdueComplianceActions} ${text('overdueOf')}`
            : undefined}
          noteColor="text-rose-500"
        />
        <StatCard
          title={text('headlinePlan')}
          value={plan?.packageName ?? '—'}
          icon={CalendarClock}
          note={planNote}
          noteColor={plan?.expired ? 'text-rose-500' : plan?.expiringSoon ? 'text-amber-500' : 'text-emerald-500'}
        />
      </div>

      {/* ── Needs attention: the cross-module to-do list ────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader className="border-b border-slate-50 py-4">
          <CardTitle className="text-sm font-bold text-slate-800">{text('needsAttention')}</CardTitle>
        </CardHeader>
        <CardContent className="py-4 space-y-2">
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
              {text('allClear')}
            </div>
          ) : (
            attention.map((item) => (
              <Link
                key={`${item.module}-${item.type}`}
                to={`/company/${tenantId ?? company?.id}${item.to}`}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium hover:brightness-[0.98] transition ${TONE_PANEL[item.tone] ?? TONE_PANEL.NEUTRAL}`}
              >
                <span className="font-bold tabular-nums flex-shrink-0 min-w-[1.5rem]">{item.count}</span>
                <span className="flex-1 min-w-0">
                  {attentionLabel(item.type)}
                  {/* The legal source, so the admin can see why it is urgent. */}
                  {item.legalRef && (
                    <span className="block text-[9px] font-normal opacity-70 mt-0.5">{item.legalRef}</span>
                  )}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 flex-shrink-0">
                  {item.module}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── KSeF invoice volume ─────────────────────────────────────────── */}
      {invoiceVolume?.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">{text('invoiceVolume')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={invoiceVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: '#dc2626', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── One card per module ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((card) => (
          <ModuleCard key={card.module} card={card} moduleBase={moduleBase} />
        ))}
      </div>

      {/* ── Recent module activity (accountability, GDPR Art. 5(2)) ─────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-4">
          <h2 className="font-bold text-sm text-slate-800">{text('recentActivity')}</h2>
          {/* Says out loud why whistleblower activity is absent, so its absence is
              understood as a legal requirement rather than a missing feature. */}
          <p className="text-[10px] text-slate-400 mt-0.5">{text('activityNote')}</p>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivity.length === 0 ? (
            <p className="px-6 py-8 text-xs text-slate-400 text-center">{text('activityEmpty')}</p>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">User</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Action</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Record</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Module</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((log, i) => (
                  <TableRow key={`${log.module}-${log.at}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-6 py-4 text-xs font-semibold text-slate-700 font-mono">{log.actor}</TableCell>
                    <TableCell className="px-6 py-4 text-xs text-slate-500">
                      {log.action.replace(/_/g, ' ').toLowerCase()}
                      {!log.success && (
                        <span className="ml-2 px-2 py-0.5 rounded-full font-bold text-[9px] bg-rose-50 text-rose-600">FAILED</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs text-slate-400">{log.resource ?? '—'}</TableCell>
                    <TableCell className="px-6 py-4 text-xs text-slate-500">{log.module}</TableCell>
                    <TableCell className="px-6 py-4 text-right text-xs text-slate-400 font-medium">
                      {formatDate(log.at, true)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Personal (any signed-in member) "My Workspace" dashboard ───────────────
//
// OLD MOCK REMOVED. Until now this view showed hardcoded tasks ("Submit June waste
// report by 30.06"), invented document expiry dates and a fixed "08:00–16:00" shift.
// Those had to go for the same reason the admin mocks did, only with sharper
// consequences: this is the screen an employee looks at to decide whether they may
// legally start work. A made-up "Medical Certificate — VALID" row tells somebody
// they are cleared to work when their certificate may in fact have lapsed, which is
// a Kodeks pracy art. 229 §4 breach for the employer and an uninsured shift for the
// employee.
//
// Everything below now comes from ONE server call, GET /api/me/overview, held in the
// myOverview Redux slice. The server resolves the person from the session token,
// filters every query to that person's own records, and works out every date — the
// 30-day document warning, the yearly 150-hour overtime cap, the whistleblower
// clocks. This component only formats what it is handed; it never computes a
// deadline and never adds figures up.

// The tone the server puts on a document state, as panel classes.
const DOC_TONE = {
  VALID: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  EXPIRING: 'bg-amber-50 text-amber-700 border-amber-100',
  EXPIRED: 'bg-rose-50 text-rose-700 border-rose-100',
  MISSING: 'bg-rose-50 text-rose-700 border-rose-100',
  NOT_REQUIRED: 'bg-slate-50 text-slate-500 border-slate-100',
};

// The colour the headline "may I work today?" tile gets.
const DOC_STATUS_COLOR = {
  COMPLIANT: 'text-emerald-500',
  EXPIRING: 'text-amber-500',
  NO_PROFILE: 'text-amber-500',
};

/**
 * One of the person's own documents, with its real expiry date.
 *
 * The days-remaining line is what makes this useful: "valid until 30.11.2026" is
 * information, "62 days left" is a prompt to book an appointment. A negative number
 * from the server means the document already lapsed, and is shown as days overdue.
 */
function DocumentRow({ doc }) {
  const tone = DOC_TONE[doc.status] ?? DOC_TONE.NOT_REQUIRED;
  const days = doc.daysRemaining;

  return (
    <div className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border ${tone}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{documentTypeLabel(doc.type)}</p>
        <p className="text-[10px] opacity-80">
          {doc.status === 'NOT_REQUIRED'
            ? text('myNotRequired')
            : doc.expiryDate
              ? <>{text('myExpiresOn')} {formatDate(doc.expiryDate)}</>
              : text('myNoDate')}
          {/* Only shown when the server actually gave a date to count from. */}
          {days !== null && days !== undefined && doc.status !== 'NOT_REQUIRED' && (
            <> · {days >= 0
              ? `${days} ${text('myDaysLeft')}`
              : `${Math.abs(days)} ${text('myDaysAgo')}`}</>
          )}
        </p>
        {/* The rule behind the date, so it is clear this is a legal duty. */}
        {doc.legalRef && <p className="text-[9px] opacity-60 mt-0.5">{doc.legalRef}</p>}
      </div>
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-current/20 bg-white/60 flex-shrink-0">
        {statusValueLabel(doc.status)}
      </span>
    </div>
  );
}

/** One line in the "my rights" panel. */
function RightsRow({ icon: Icon, title, value, legalRef, to, linkLabel }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-slate-100">
      <Icon className="h-4 w-4 text-slate-300 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="text-[11px] text-slate-500 break-words">{value}</p>
        <p className="text-[9px] text-slate-400 mt-0.5">{legalRef}</p>
      </div>
      {to && (
        <Link
          to={to}
          className="text-[10px] font-bold uppercase tracking-wider text-red-600 hover:underline inline-flex items-center gap-0.5 flex-shrink-0"
        >
          {linkLabel} <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function UserView() {
  const dispatch = useDispatch();
  const { tenantId } = useParams();

  const overview = useSelector(selectMyOverview);
  const status = useSelector(selectMyOverviewStatus);
  const error = useSelector(selectMyOverviewError);
  const loadedAt = useSelector(selectMyOverviewLoadedAt);
  const isInitialLoad = useSelector(selectMyOverviewIsInitialLoad);

  // Load once when the screen opens; the slice keeps the snapshot afterwards.
  useEffect(() => {
    if (status === 'idle') dispatch(fetchMyOverview());
  }, [dispatch, status]);

  // ── First load: nothing to show yet ──────────────────────────────────────
  if (isInitialLoad) {
    return (
      <div className="max-w-7xl mx-auto py-24 flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        <p className="text-xs text-slate-400 font-medium">{text('myTitle')}…</p>
      </div>
    );
  }

  // ── Failed with nothing cached ───────────────────────────────────────────
  if (!overview) {
    return (
      <div className="max-w-7xl mx-auto py-24 flex flex-col items-center gap-4">
        <AlertTriangle className="h-6 w-6 text-rose-400" />
        <p className="text-sm text-slate-600 font-medium">{error?.message ?? text('myLoadFailed')}</p>
        <Button
          onClick={() => dispatch(fetchMyOverview())}
          className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> {text('refresh')}
        </Button>
      </div>
    );
  }

  const { me, headline, modules, attention, documents, rights, recentActivity } = overview;
  const isRefreshing = status === 'loading';

  // The company id in the URL is display-only; the server always answers for the
  // signed-in person's own company. Falling back to what the response reported
  // keeps the links working if the screen is opened without one.
  const companyBase = `/company/${tenantId ?? me?.companyId ?? 'platform'}`;
  const moduleBase = `${companyBase}/modules`;

  // Somebody not yet linked to a company gets an explanation, not an error page.
  if (!me?.companyId) {
    return (
      <div className="max-w-3xl mx-auto py-24 flex flex-col items-center gap-4 text-center">
        <Building2 className="h-6 w-6 text-slate-300" />
        <h1 className="text-xl font-bold text-slate-900">{text('myTitle')}</h1>
        <p className="text-sm text-slate-500 max-w-md">{text('myNoCompany')}</p>
      </div>
    );
  }

  // Documents worth listing. NOT_REQUIRED rows are kept on purpose: knowing a
  // certificate is not needed for your role is an answer, and hiding it looks
  // like a missing record.
  const hasDocuments = documents?.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{text('myTitle')}</h1>
          <p className="text-sm text-slate-500 font-medium">
            {text('myGreeting')}, {me.name || me.email}
            {me.companyName && <> · {me.companyName}</>}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{text('myScopeNote')}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            variant="outline"
            onClick={() => dispatch(fetchMyOverview())}
            disabled={isRefreshing}
            className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> {text('refresh')}
          </Button>
          {loadedAt && (
            <span className="text-[10px] text-slate-400">
              {text('updatedAt')} {formatDate(loadedAt, true)}
            </span>
          )}
        </div>
      </div>

      {/* A failed refresh keeps the previous figures but says so, rather than
          passing yesterday's document status off as today's. */}
      {status === 'failed' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium bg-amber-50 text-amber-700 border-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {text('staleWarning')}
        </div>
      )}

      {/* ── The one thing that stops work ───────────────────────────────── */}
      {/* Placed above everything else because it is not a statistic: it means the
          person may not legally be on shift today. */}
      {headline.blockedFromWork && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border bg-rose-50 text-rose-800 border-rose-200">
          <ShieldOff className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">{text('myBlockedTitle')}</p>
            <p className="text-xs mt-1 leading-relaxed">{text('myBlockedBody')}</p>
          </div>
        </div>
      )}

      {/* ── Headline figures ────────────────────────────────────────────── */}
      {/* Each tile is left out when the person has no access to the module behind
          it. Showing a zero instead would read as "nothing to worry about". */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {headline.shiftStatusToday && (
          <StatCard
            title={text('myShiftToday')}
            value={statusValueLabel(headline.shiftStatusToday)}
            icon={Clock}
          />
        )}
        {headline.workedHoursThisMonth != null && (
          <StatCard
            title={text('myHoursThisMonth')}
            value={formatMetric({ value: headline.workedHoursThisMonth, unit: 'HOURS' })}
            icon={CalendarClock}
            note={headline.overtimeHoursThisMonth != null
              ? `+${formatMetric({ value: headline.overtimeHoursThisMonth, unit: 'HOURS' })} ${text('myOvertimeNote')}`
              : undefined}
            noteColor={Number(headline.overtimeHoursThisMonth) > 0 ? 'text-amber-500' : 'text-slate-400'}
          />
        )}
        {headline.documentStatus && (
          <StatCard
            title={text('myDocumentStatus')}
            value={statusValueLabel(headline.blockedFromWork ? 'BLOCKED' : headline.documentStatus)}
            icon={ShieldCheck}
            note={statusValueLabel(headline.documentStatus)}
            noteColor={headline.blockedFromWork
              ? 'text-rose-500'
              : DOC_STATUS_COLOR[headline.documentStatus] ?? 'text-rose-500'}
          />
        )}
        <StatCard
          title={text('myOpenActions')}
          value={headline.openActions}
          icon={CheckSquare}
          note={headline.overdueActions > 0
            ? `${headline.overdueActions} ${text('overdueOf')}`
            : undefined}
          noteColor="text-rose-500"
        />
        <StatCard
          title={text('myModulesNote')}
          value={`${headline.modulesAvailable} / ${headline.modulesEntitled}`}
          icon={ShieldCheck}
        />
      </div>

      {/* ── My to-do list ──────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader className="border-b border-slate-50 py-4">
          <CardTitle className="text-sm font-bold text-slate-800">{text('myTodo')}</CardTitle>
        </CardHeader>
        <CardContent className="py-4 space-y-2">
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
              {text('myAllClear')}
            </div>
          ) : (
            attention.map((item) => (
              <Link
                key={`${item.module}-${item.type}`}
                to={`${companyBase}${item.to}`}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium hover:brightness-[0.98] transition ${TONE_PANEL[item.tone] ?? TONE_PANEL.NEUTRAL}`}
              >
                <span className="font-bold tabular-nums flex-shrink-0 min-w-[1.5rem]">{item.count}</span>
                <span className="flex-1 min-w-0">
                  {attentionLabel(item.type)}
                  {item.legalRef && (
                    <span className="block text-[9px] font-normal opacity-70 mt-0.5">{item.legalRef}</span>
                  )}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 flex-shrink-0">
                  {item.module}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── My documents + my rights ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50 py-4">
            <CardTitle className="text-sm font-bold text-slate-800">{text('myDocuments')}</CardTitle>
            {/* Says plainly that no health findings are held here, so nobody fears
                their medical results are on a dashboard (GDPR Art. 9). */}
            <p className="text-[10px] text-slate-400 mt-0.5">{text('myDocumentsNote')}</p>
          </CardHeader>
          <CardContent className="py-4 space-y-2.5">
            {hasDocuments ? (
              documents.map((doc) => <DocumentRow key={doc.type} doc={doc} />)
            ) : (
              <p className="px-3 py-6 text-xs text-slate-400 text-center">{text('myDocumentsEmpty')}</p>
            )}
          </CardContent>
        </Card>

        {/* What the company owes THIS PERSON in the way of information. Shown to
            every employee because these are their own rights, not module features
            somebody has to be granted. */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50 py-4">
            <CardTitle className="text-sm font-bold text-slate-800">{text('myRights')}</CardTitle>
            <p className="text-[10px] text-slate-400 mt-0.5">{text('myRightsNote')}</p>
          </CardHeader>
          <CardContent className="py-4 space-y-2.5">
            <RightsRow
              icon={FileText}
              title={text('myPrivacyNotices')}
              value={rights.privacyNoticesAvailable > 0
                ? `${rights.privacyNoticesAvailable}${rights.latestNoticeAt ? ` · ${text('myLatestNotice')} ${formatDate(rights.latestNoticeAt)}` : ''}`
                : '—'}
              legalRef={text('myPrivacyNoticesLegal')}
              to={rights.privacyRoute ? `${companyBase}${rights.privacyRoute}` : null}
              linkLabel={text('myOpenLink')}
            />
            <RightsRow
              icon={ShieldCheck}
              title={text('myDpo')}
              value={rights.dpoName || rights.dpoEmail
                ? [rights.dpoName, rights.dpoEmail].filter(Boolean).join(' · ')
                : text('myDpoNone')}
              legalRef={text('myDpoLegal')}
            />
            <RightsRow
              icon={Lock}
              title={text('myWhistleblowing')}
              value={rights.whistleblowingChannelAvailable
                ? text('myWhistleblowingAvailable')
                : text('myWhistleblowingNone')}
              legalRef={text('myWhistleblowingLegal')}
              to={rights.whistleblowingRoute ? `${companyBase}${rights.whistleblowingRoute}` : null}
              linkLabel={text('myOpenLink')}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── One card per module, my own figures ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((card) => (
          <ModuleCard key={card.module} card={card} moduleBase={moduleBase} />
        ))}
      </div>

      {/* ── My own audit trail ─────────────────────────────────────────── */}
      {/* An employee can check what the system recorded under their name. That is
          transparency about their own data, not surveillance of anyone else's —
          the feed is filtered to this person server-side. */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-4">
          <h2 className="font-bold text-sm text-slate-800">{text('myActivity')}</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">{text('myActivityNote')}</p>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivity.length === 0 ? (
            <p className="px-6 py-8 text-xs text-slate-400 text-center">{text('myActivityEmpty')}</p>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Action</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Record</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Module</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((log, i) => (
                  <TableRow key={`${log.module}-${log.at}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-6 py-4 text-xs text-slate-600">
                      {log.action.replace(/_/g, ' ').toLowerCase()}
                      {!log.success && (
                        <span className="ml-2 px-2 py-0.5 rounded-full font-bold text-[9px] bg-rose-50 text-rose-600">FAILED</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs text-slate-400">{log.resource ?? '—'}</TableCell>
                    <TableCell className="px-6 py-4 text-xs text-slate-500">{log.module}</TableCell>
                    <TableCell className="px-6 py-4 text-right text-xs text-slate-400 font-medium">
                      {formatDate(log.at, true)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
