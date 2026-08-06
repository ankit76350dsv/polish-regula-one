import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
// NOTE: @tanstack/react-query and tenantService are no longer imported here. The
// SuperAdmin view used to fetch through useQuery(tenantService.getPlatformOverview),
// which kept the response outside Redux and left its error state unread. All three
// dashboards now load through their own Redux Toolkit slice.
import {
  fetchPlatformOverview,
  selectPlatformOverview,
  selectPlatformOverviewError,
  selectPlatformOverviewIsInitialLoad,
  selectPlatformOverviewLoadedAt,
  selectPlatformOverviewStatus,
} from '../../slices/platformOverviewSlice';
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
  formatMoney, formatMoneyShort, formatMonth, metricLabel, moduleLabel,
  moneyMetricLabel, statusValueLabel, text, watchlistReasonLabel,
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
import { moduleDestination } from '../../config/moduleApps';

// ─── Shared pieces ─────────────────────────────────────────────────────────
//
// EVERY FIGURE ON THIS PAGE COMES FROM THE SERVER. There is no sample, placeholder or
// illustrative data anywhere in this file, and there must never be: this is the screen
// a company decides from, so an invented number would hide a real missed deadline
// behind a reassuring green tile. Money is never re-added or re-symbolled here either —
// it is printed with the currency the server sent beside it.

/**
 * The page inside THIS hub for each module, where one still exists.
 *
 * KSeFFlow, SafeVoice and PrivacyPilot are absent on purpose: they are separate
 * applications now, so there is no in-hub page to link to and moduleDestination()
 * sends people to the application instead.
 */
const IN_HUB_MODULE_PATHS = {
  SAFEWORK:  '/modules/safework',
  WASTESYNC: '/modules/wastesync',
  WORKPULSE: '/modules/workpulse',
};

/** One colour per module, used for its dot and for its bar. */
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

/** An action code from a module's audit trail, as a readable sentence. */
function actionText(code) {
  const words = String(code ?? '').replace(/_/g, ' ').toLowerCase().trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '—';
}

/**
 * Wraps its children in whatever is the right thing to click for this module.
 *
 * A module that has moved into its own application opens in a new tab; one that still
 * has a page in this hub navigates normally; and when there is nothing that can be
 * opened, the content is rendered WITHOUT a link rather than as one that would fail.
 * That last case is the point of this component — the server still sends in-hub paths
 * for modules that now live elsewhere, and following them would land on "page not
 * found".
 */
function ModuleTarget({
  moduleKey, tenantId, companyBase, inHubPath, className, children,
  hideIfUnavailable = false,
}) {
  const destination = moduleDestination(moduleKey, tenantId, inHubPath, companyBase);

  // Nothing to open. Content that only EXISTS to be clicked (an "Open" link) is left
  // out entirely; content that also carries information (a to-do row) still shows, but
  // without the hover styling that would promise a click it cannot honour.
  if (!destination) {
    if (hideIfUnavailable) return null;
    return <div className={className}>{children}</div>;
  }

  const interactive = `${className} hover:brightness-[0.98] focus-visible:brightness-[0.98] transition`;

  if (destination.external) {
    return (
      <a
        href={destination.href}
        target="_blank"
        // Without noopener the opened page can navigate this tab through
        // window.opener (reverse tabnabbing).
        rel="noopener noreferrer"
        className={interactive}
      >
        {children}
        <span className="sr-only"> ({text('opensInNewTab')})</span>
      </a>
    );
  }

  return <Link to={destination.to} className={interactive}>{children}</Link>;
}

/** The spinner every view shows on its very first load. */
function LoadingPanel({ label }) {
  return (
    <div className="max-w-7xl mx-auto py-24 flex flex-col items-center gap-3" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-slate-300" aria-hidden="true" />
      <p className="text-xs text-slate-400 font-medium">{label}…</p>
    </div>
  );
}

/** Shown when a view has nothing cached and the call failed. */
function LoadFailedPanel({ message, onRetry }) {
  return (
    <div className="max-w-7xl mx-auto py-24 flex flex-col items-center gap-4 px-4 text-center" role="alert">
      <AlertTriangle className="h-6 w-6 text-rose-400" aria-hidden="true" />
      <p className="text-sm text-slate-600 font-medium">{message}</p>
      <Button
        onClick={onRetry}
        className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2"
      >
        <RefreshCw className="h-3.5 w-3.5 mr-2" aria-hidden="true" /> {text('refresh')}
      </Button>
    </div>
  );
}

/** The "these figures are from the last successful load" strip. */
function StaleBanner() {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium bg-amber-50 text-amber-700 border-amber-100"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-px" aria-hidden="true" />
      {text('staleWarning')}
    </div>
  );
}

/** Refresh button plus the time of the last successful load. */
function RefreshControl({ onRefresh, isRefreshing, loadedAt }) {
  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {text('refresh')}
      </Button>
      {loadedAt && (
        <span className="text-[10px] text-slate-400">
          {text('updatedAt')} {formatDate(loadedAt, true)}
        </span>
      )}
    </div>
  );
}

/** One row of the platform watchlist: a customer who needs a call, and why. */
function WatchRow({ item, onOpen }) {
  const tone = TONE_PANEL[item.tone] ?? TONE_PANEL.NEUTRAL;

  // Days are only shown when the reason is actually about a date.
  const days = item.daysRemaining;
  const dayNote = days === null || days === undefined
    ? null
    : days >= 0
      ? `${days} ${text('platformDaysLeft')}`
      : `${Math.abs(days)} ${text('platformDaysOverdue')}`;

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium ${tone}`}>
      <div className="min-w-0 flex-1">
        <p className="font-bold truncate">{item.tenantName}</p>
        <p className="font-normal opacity-90">{watchlistReasonLabel(item.reason)}</p>
        <p className="text-[10px] font-normal opacity-70 mt-0.5">
          {[dayNote, item.detail].filter(Boolean).join(' · ') || ' '}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onOpen(item.tenantId)}
        className="text-[10px] font-bold uppercase tracking-wider hover:underline inline-flex items-center gap-0.5 flex-shrink-0"
      >
        {text('platformOpenCustomer')} <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── SuperAdmin (ROLE_SUPER_ADMIN) platform dashboard ──────────────────────
//
// Everything here comes from ONE server call, GET /api/superadmin/overview, held in
// the platformOverview Redux slice.
//
// WHAT THIS SCREEN MAY AND MAY NOT SHOW: RegulaOne runs the six modules on behalf of
// its customers, which under GDPR makes each customer the CONTROLLER of the personal
// data inside them and RegulaOne only the PROCESSOR (Art. 4(7)–(8), Art. 28). So this
// screen shows the COMMERCIAL position — customers, seats, plans, prices, module
// take-up — and never a customer's compliance content. Whether a given customer is
// compliant is answered on that customer's own dashboard, by their own administrator.
//
// It also no longer shows a "Compliance Score". That figure was active tenants with an
// unexpired plan divided by all tenants — a billing ratio wearing a compliance name.
// The honest subscription counts took its place; see the Plans record on the backend.

function SuperAdminView() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const overview = useSelector(selectPlatformOverview);
  const status = useSelector(selectPlatformOverviewStatus);
  const error = useSelector(selectPlatformOverviewError);
  const loadedAt = useSelector(selectPlatformOverviewLoadedAt);
  const isInitialLoad = useSelector(selectPlatformOverviewIsInitialLoad);

  // Load once when the screen opens. The slice keeps the snapshot, so navigating away
  // and back does not refetch until the operator asks for it.
  useEffect(() => {
    if (status === 'idle') dispatch(fetchPlatformOverview());
  }, [dispatch, status]);

  // ── First load: nothing to show yet ──────────────────────────────────────
  if (isInitialLoad) {
    return <LoadingPanel label={text('platformTitle')} />;
  }

  // ── Failed with nothing cached ───────────────────────────────────────────
  // The previous version had no error branch at all: react-query's `error` was never
  // read, so a failed call rendered "—" in every card and the platform looked empty
  // rather than unreachable.
  if (!overview) {
    return (
      <LoadFailedPanel
        message={error?.message ?? text('platformLoadFailed')}
        onRetry={() => dispatch(fetchPlatformOverview())}
      />
    );
  }

  const {
    tenants, seats, monthlyRecurring, billingsByMonth, plans, moduleAdoption, watchlist,
  } = overview;
  const isRefreshing = status === 'loading';

  // The headline recurring figure. There is one entry per currency, so the card shows
  // the largest and says how many others there are rather than adding them up.
  const currencies = monthlyRecurring ?? [];
  const primary = currencies.length > 0
    ? currencies.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a))
    : null;

  // Seat note: utilisation, or that no plan states a limit. Over 100% is left as-is —
  // it means customers are using more seats than they bought, which is the operator's
  // problem to act on rather than a number to hide.
  const overSeats = seats.utilisationPct !== null
    && seats.utilisationPct !== undefined
    && seats.utilisationPct > 100;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {text('platformTitle')}
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            <span className="font-bold text-slate-700">{tenants.active}</span>{' '}
            {text('platformSubtitle')}
          </p>
          {/* States the processor boundary on the screen itself, so the absence of
              customer compliance data reads as a rule rather than a missing feature. */}
          <p className="text-[10px] text-slate-400 mt-1 max-w-2xl">{text('platformScopeNote')}</p>
        </div>
        <RefreshControl
          onRefresh={() => dispatch(fetchPlatformOverview())}
          isRefreshing={isRefreshing}
          loadedAt={loadedAt}
        />
      </div>

      {/* A failed refresh keeps the previous figures on screen but says so. */}
      {status === 'failed' && (
        <StaleBanner />
      )}

      {/* ── Headline figures ────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={text('platformCustomers')}
          value={tenants.total}
          icon={Building2}
          note={`${tenants.active} ${text('platformActive')}`}
          noteColor="text-emerald-500"
        />
        <StatCard
          title={text('platformUsers')}
          value={seats.usersEnabled.toLocaleString()}
          icon={Users}
          note={seats.seatsContracted != null
            ? `${seats.seatsContracted.toLocaleString()} ${text('platformSeats')}`
            : text('platformSeatsNotStated')}
          noteColor="text-slate-400"
        />
        <StatCard
          title={text('platformUtilisation')}
          value={seats.utilisationPct != null ? `${seats.utilisationPct}%` : '—'}
          icon={Activity}
          note={overSeats ? text('platformOverSeats') : undefined}
          noteColor="text-rose-500"
        />
        {/* The recurring value, in its own currency. When customers pay in more than
            one currency the card shows the largest and counts the rest — it never
            adds them together. */}
        <StatCard
          title={text('platformMrr')}
          value={primary ? formatMoneyShort(primary.amount, primary.currency) : text('platformNoRevenue')}
          icon={CalendarClock}
          note={currencies.length > 1
            ? `+${currencies.length - 1} ${text('platformMoreCurrencies')}`
            : undefined}
          noteColor="text-slate-400"
        />
      </div>

      {/* ── New signups this month ──────────────────────────────────────── */}
      {/* Kept apart from the totals above on purpose. The trend measures the change in
          the SIGNUP RATE, and the old screen printed it next to the total customer
          count, where "+12%" read as if the customer base had grown by 12%. */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title={`${text('platformCustomers')} — ${text('platformNewThisMonth')}`}
          value={tenants.newThisMonth}
          icon={Building2}
          note={`${tenants.newTrend} ${text('platformSignupTrend')}`}
          noteColor={trendColor(tenants.newTrend)}
        />
        <StatCard
          title={`${text('platformUsers')} — ${text('platformNewThisMonth')}`}
          value={seats.newUsersThisMonth}
          icon={Users}
          note={`${seats.newTrend} ${text('platformSignupTrend')}`}
          noteColor={trendColor(seats.newTrend)}
        />
      </div>

      {/* ── Subscriptions: what replaced the invented compliance score ──── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader className="border-b border-slate-50 py-4">
          <CardTitle className="text-sm font-bold text-slate-800">{text('platformPlans')}</CardTitle>
          <p className="text-[10px] text-slate-400 mt-0.5 max-w-2xl">{text('platformPlansNote')}</p>
        </CardHeader>
        <CardContent className="py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: text('platformPlanValid'), value: plans.activeWithValidPlan, tone: 'GOOD' },
              { label: text('platformPlanExpiring'), value: plans.expiringSoon, tone: plans.expiringSoon > 0 ? 'WARN' : 'NEUTRAL' },
              { label: text('platformPlanExpired'), value: plans.expired, tone: plans.expired > 0 ? 'RISK' : 'NEUTRAL' },
              { label: text('platformPlanNone'), value: plans.noPlan, tone: plans.noPlan > 0 ? 'RISK' : 'NEUTRAL' },
              { label: text('platformSuspended'), value: tenants.suspended, tone: tenants.suspended > 0 ? 'RISK' : 'NEUTRAL' },
              { label: text('platformInactive'), value: tenants.inactive, tone: 'NEUTRAL' },
            ].map((cell) => (
              <div
                key={cell.label}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium ${TONE_PANEL[cell.tone] ?? TONE_PANEL.NEUTRAL}`}
              >
                <span className="min-w-0">{cell.label}</span>
                <span className="font-bold tabular-nums flex-shrink-0">{cell.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Billings + module take-up ───────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">{text('platformBillings')}</CardTitle>
            {/* Says out loud that this is a different quantity from the recurring
                value above, so the two are never read as one broken number. */}
            <p className="text-[10px] text-slate-400 mt-0.5">{text('platformBillingsNote')}</p>
          </CardHeader>
          <CardContent className="pt-6">
            {(billingsByMonth?.length ?? 0) === 0 ? (
              <p className="py-16 text-xs text-slate-400 text-center">{text('platformBillingsEmpty')}</p>
            ) : (
              // One chart per currency. They are NOT combined into one axis, because
              // an axis carrying both PLN and EUR would invite reading the sum.
              <div className="space-y-6">
                {billingsByMonth.map((series) => (
                  <div key={series.currency}>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {series.currency}
                      </span>
                      <span className={`text-[10px] font-bold ${trendColor(series.trend)}`}>
                        {series.trend}
                      </span>
                    </div>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series.points}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="month"
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            tickFormatter={formatMonth}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => formatMoneyShort(v, series.currency)}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                            labelFormatter={formatMonth}
                            formatter={(v) => formatMoney(v, series.currency)}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#dc2626"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#dc2626', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">{text('platformAdoption')}</CardTitle>
            <p className="text-[10px] text-slate-400 mt-0.5">{text('platformAdoptionNote')}</p>
          </CardHeader>
          <CardContent className="py-6 space-y-5">
            {(moduleAdoption ?? []).map((mod) => (
              <div key={mod.module}>
                <div className="flex justify-between items-baseline text-[10px] font-bold mb-1.5 gap-2">
                  <span className="text-slate-500 tracking-wider truncate">
                    {moduleLabel(mod.module)}
                  </span>
                  <span className="text-slate-900 flex-shrink-0">{mod.tenantsPct}%</span>
                </div>
                {/* The bar is a share of ACTIVE CUSTOMERS — a fixed denominator. The
                    old chart divided by the most popular module, so the leading bar
                    was always 100% and no bar meant anything on its own. */}
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${MODULE_COLORS[mod.module] ?? 'bg-slate-400'}`}
                    style={{ width: `${Math.min(mod.tenantsPct, 100)}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1">
                  {mod.tenantsEntitled} {text('platformAdoptionCustomers')} ·{' '}
                  {mod.usersGranted} {text('platformAdoptionUsers')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Watchlist (replaces the invented activity table) ────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader className="border-b border-slate-50 py-4">
          <CardTitle className="text-sm font-bold text-slate-800">{text('platformWatchlist')}</CardTitle>
          <p className="text-[10px] text-slate-400 mt-0.5">{text('platformWatchlistNote')}</p>
        </CardHeader>
        <CardContent className="py-4 space-y-2">
          {(watchlist?.length ?? 0) === 0 ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
              {text('platformWatchlistEmpty')}
            </div>
          ) : (
            watchlist.map((item) => (
              <WatchRow
                key={`${item.tenantId}-${item.reason}`}
                item={item}
                onOpen={(tenantId) => navigate(`/company/${tenantId}/overview`)}
              />
            ))
          )}
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
function ModuleCard({ card, tenantId, companyBase }) {
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
          {/* Where this goes depends on whether the module is its own application —
              resolved centrally so no card can link to a page that no longer exists. */}
          <ModuleTarget
            moduleKey={card.module}
            tenantId={tenantId}
            companyBase={companyBase}
            inHubPath={IN_HUB_MODULE_PATHS[card.module]}
            hideIfUnavailable
            className="text-[10px] font-bold uppercase tracking-wider text-red-600 hover:underline focus-visible:underline inline-flex items-center gap-0.5 py-1"
          >
            {text('open')} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </ModuleTarget>
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

  // Prefix for links to pages that still live in this hub. The company id in the URL is
  // display-only — the server always answers for the signed-in user's own company.
  const companyBase = `/company/${tenantId ?? overview?.company?.id ?? 'platform'}`;

  // ── First load: nothing to show yet ──────────────────────────────────────
  if (isInitialLoad) {
    return <LoadingPanel label={text('title')} />;
  }

  // ── Failed with nothing cached ───────────────────────────────────────────
  if (!overview) {
    return (
      <LoadFailedPanel
        message={error?.message ?? text('loadFailed')}
        onRetry={() => dispatch(fetchCompanyOverview())}
      />
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
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{text('title')}</h1>
          <p className="text-sm text-slate-500 font-medium">
            {company?.name}
            {company?.nip && <> · {text('subtitleWithNip')} {company.nip}</>}
            {plan?.packageName && <> · {plan.packageName}</>}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{text('minimisationNote')}</p>
        </div>
        <RefreshControl
          onRefresh={() => dispatch(fetchCompanyOverview())}
          isRefreshing={isRefreshing}
          loadedAt={loadedAt}
        />
      </div>

      {/* A failed refresh keeps the previous figures on screen but says so, rather
          than silently showing yesterday's compliance position as today's. */}
      {status === 'failed' && (
        <StaleBanner />
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
          note={company?.status ? statusValueLabel(company.status) : undefined}
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
              <ModuleTarget
                key={`${item.module}-${item.type}`}
                moduleKey={item.module}
                tenantId={tenantId ?? company?.id}
                companyBase={companyBase}
                inHubPath={item.to}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium ${TONE_PANEL[item.tone] ?? TONE_PANEL.NEUTRAL}`}
              >
                <span className="font-bold tabular-nums flex-shrink-0 min-w-[1.5rem]">{item.count}</span>
                <span className="flex-1 min-w-0">
                  {attentionLabel(item.type)}
                  {/* The legal source, so the admin can see why it is urgent. */}
                  {item.legalRef && (
                    <span className="block text-[9px] font-normal opacity-70 mt-0.5">{item.legalRef}</span>
                  )}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 flex-shrink-0 text-right">
                  {moduleLabel(item.module)}
                </span>
              </ModuleTarget>
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
          <ModuleCard
            key={card.module}
            card={card}
            tenantId={tenantId ?? company?.id}
            companyBase={companyBase}
          />
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
                  <TableHead className="px-4 sm:px-6 py-3 text-[10px] uppercase font-bold text-slate-400">{text('activityUser')}</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-[10px] uppercase font-bold text-slate-400">{text('activityAction')}</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-[10px] uppercase font-bold text-slate-400">{text('activityModule')}</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-[10px] uppercase font-bold text-slate-400 text-right">{text('activityWhen')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((log, i) => (
                  <TableRow key={`${log.module}-${log.at}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-4 sm:px-6 py-4 text-xs font-semibold text-slate-700 break-all">{log.actor}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 text-xs text-slate-500">
                      {actionText(log.action)}
                      {!log.success && (
                        <span className="ml-2 px-2 py-0.5 rounded-full font-bold text-[9px] bg-rose-50 text-rose-600 whitespace-nowrap">
                          {text('activityFailed')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 text-xs text-slate-500">{moduleLabel(log.module)}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 text-right text-xs text-slate-400 font-medium whitespace-nowrap">
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

/**
 * One line in the "my rights" panel.
 *
 * The link is only rendered when the module behind it can actually be opened — a right
 * the company has not enabled is stated plainly rather than dressed as a working link.
 */
function RightsRow({ icon: Icon, title, value, legalRef, moduleKey, inHubPath, tenantId, companyBase, linkLabel }) {
  const destination = inHubPath
    ? moduleDestination(moduleKey, tenantId, inHubPath, companyBase)
    : null;

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-slate-100">
      <Icon className="h-4 w-4 text-slate-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="text-[11px] text-slate-500 break-words">{value}</p>
        <p className="text-[9px] text-slate-400 mt-0.5">{legalRef}</p>
      </div>
      {destination && (
        <ModuleTarget
          moduleKey={moduleKey}
          tenantId={tenantId}
          companyBase={companyBase}
          inHubPath={inHubPath}
          className="text-[10px] font-bold uppercase tracking-wider text-red-600 hover:underline focus-visible:underline inline-flex items-center gap-0.5 flex-shrink-0 py-1"
        >
          {linkLabel} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </ModuleTarget>
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
    return <LoadingPanel label={text('myTitle')} />;
  }

  // ── Failed with nothing cached ───────────────────────────────────────────
  if (!overview) {
    return (
      <LoadFailedPanel
        message={error?.message ?? text('myLoadFailed')}
        onRetry={() => dispatch(fetchMyOverview())}
      />
    );
  }

  const { me, headline, modules, attention, documents, rights, recentActivity } = overview;
  const isRefreshing = status === 'loading';

  // The company id in the URL is display-only; the server always answers for the
  // signed-in person's own company. Falling back to what the response reported
  // keeps the links working if the screen is opened without one.
  const companyBase = `/company/${tenantId ?? me?.companyId ?? 'platform'}`;

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
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{text('myTitle')}</h1>
          <p className="text-sm text-slate-500 font-medium">
            {text('myGreeting')}, {me.name || me.email}
            {me.companyName && <> · {me.companyName}</>}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{text('myScopeNote')}</p>
        </div>
        <RefreshControl
          onRefresh={() => dispatch(fetchMyOverview())}
          isRefreshing={isRefreshing}
          loadedAt={loadedAt}
        />
      </div>

      {/* A failed refresh keeps the previous figures but says so, rather than
          passing yesterday's document status off as today's. */}
      {status === 'failed' && (
        <StaleBanner />
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
              <ModuleTarget
                key={`${item.module}-${item.type}`}
                moduleKey={item.module}
                tenantId={tenantId ?? me?.companyId}
                companyBase={companyBase}
                inHubPath={item.to}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium ${TONE_PANEL[item.tone] ?? TONE_PANEL.NEUTRAL}`}
              >
                <span className="font-bold tabular-nums flex-shrink-0 min-w-[1.5rem]">{item.count}</span>
                <span className="flex-1 min-w-0">
                  {attentionLabel(item.type)}
                  {item.legalRef && (
                    <span className="block text-[9px] font-normal opacity-70 mt-0.5">{item.legalRef}</span>
                  )}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 flex-shrink-0 text-right">
                  {moduleLabel(item.module)}
                </span>
              </ModuleTarget>
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
              moduleKey="PRIVACYPILOT"
              inHubPath={rights.privacyRoute}
              tenantId={tenantId ?? me?.companyId}
              companyBase={companyBase}
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
              moduleKey="SAFEVOICE"
              inHubPath={rights.whistleblowingRoute}
              tenantId={tenantId ?? me?.companyId}
              companyBase={companyBase}
              linkLabel={text('myOpenLink')}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── One card per module, my own figures ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((card) => (
          <ModuleCard
            key={card.module}
            card={card}
            tenantId={tenantId ?? company?.id}
            companyBase={companyBase}
          />
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
                  <TableHead className="px-4 sm:px-6 py-3 text-[10px] uppercase font-bold text-slate-400">{text('activityAction')}</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-[10px] uppercase font-bold text-slate-400">{text('activityModule')}</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-[10px] uppercase font-bold text-slate-400 text-right">{text('activityWhen')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((log, i) => (
                  <TableRow key={`${log.module}-${log.at}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-4 sm:px-6 py-4 text-xs text-slate-600">
                      {actionText(log.action)}
                      {!log.success && (
                        <span className="ml-2 px-2 py-0.5 rounded-full font-bold text-[9px] bg-rose-50 text-rose-600 whitespace-nowrap">
                          {text('activityFailed')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 text-xs text-slate-500">{moduleLabel(log.module)}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 text-right text-xs text-slate-400 font-medium whitespace-nowrap">
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
