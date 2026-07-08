import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { fetchDashboard } from "../store/slices/dashboardSlice";
import { fetchCompanies } from "../store/slices/companySlice";
import {
  Card,
  Loader,
  AlertBanner,
  Badge,
  EmptyState,
  Button,
} from "../components/common";
import {
  WASTE_CATEGORIES,
  MONTH_NAMES,
  CATEGORY_COLORS,
} from "../utils/constants";

// ── Small helpers ────────────────────────────────────────────────────────────

// Turn a number into a friendly "1,234" string. Used for every weight/count so
// big numbers stay readable (and never show NaN if the value is missing).
const fmt = (n) => Number(n || 0).toLocaleString();

// ── Inline icons ─────────────────────────────────────────────────────────────
// We draw the icons inline as SVG so the dashboard needs no extra icon library.
// Each one inherits its colour from the text colour around it (currentColor).
const icons = {
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01" strokeLinecap="round" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6M8 17v-3M12 17v-6M16 17v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  recycle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12M14 16l-3 3 3 3M8.293 13.596 7.196 9.5 3.1 10.598M9.344 5.811l1.093-1.892a1.83 1.83 0 0 1 3.149-.001l1.226 2.12M13.378 9.633l4.096-1.098 1.098 4.096" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bars: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M3 3v18h18M8 17V9M13 17V5M18 17v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M3 17l6-6 4 4 7-7M14 8h7v7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ── Metric card ───────────────────────────────────────────────────────────────
// A single big-number tile with an icon. The "accent" picks the colour theme so
// good news looks green, warnings look amber, etc.
const accents = {
  emerald: { chip: "bg-emerald-50 text-emerald-600", value: "text-slate-900", glow: "bg-emerald-300" },
  blue: { chip: "bg-blue-50 text-blue-600", value: "text-slate-900", glow: "bg-blue-300" },
  violet: { chip: "bg-violet-50 text-violet-600", value: "text-slate-900", glow: "bg-violet-300" },
  amber: { chip: "bg-amber-50 text-amber-600", value: "text-amber-600", glow: "bg-amber-300" },
};

function MetricCard({ icon, label, value, hint, accent = "emerald" }) {
  const a = accents[accent] || accents.emerald;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Soft coloured glow in the corner — pure decoration. */}
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-50 blur-2xl ${a.glow}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          <div className={`mt-2 text-3xl font-bold ${a.value}`}>{value}</div>
          {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${a.chip}`}>{icon}</div>
      </div>
    </div>
  );
}

// ── Section header — a small icon chip + a title, used above each panel ────────
function SectionTitle({ icon, children, right }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </span>
        <span className="text-sm font-semibold text-slate-700">{children}</span>
      </div>
      {right}
    </div>
  );
}

// ── Custom chart tooltip — a clean white card instead of Recharts' default ─────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{fmt(payload[0].value)} kg</div>
    </div>
  );
}

export default function Dashboard() {
  const dispatch = useDispatch();
  const { data, loading, error } = useSelector((state) => state.dashboard);
  const { list: companies } = useSelector((state) => state.companies);

  const [year, setYear] = useState(new Date().getFullYear());
  // "all" means every company; otherwise a specific company id.
  const [scope, setScope] = useState("all");

  useEffect(() => {
    dispatch(fetchCompanies());
  }, [dispatch]);

  // Reload the dashboard whenever the year or company scope changes.
  useEffect(() => {
    const companyId = scope === "all" ? undefined : scope;
    dispatch(fetchDashboard({ year, companyId }));
  }, [dispatch, year, scope]);

  if (loading && !data) return <Loader label="Loading dashboard…" />;

  // No companies at all — guide the user to set one up first.
  if (!loading && companies.length === 0) {
    return (
      <div>
        <EmptyState
          title="Welcome to WasteSync"
          message="Start by adding the company you report packaging waste for."
          action={
            <Link to="/companies/new">
              <Button>+ Add your company</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const m = data?.metrics || {};

  // Shape the category totals for the bar chart.
  const categoryData = WASTE_CATEGORIES.map((c) => ({
    name: c.label,
    key: c.key,
    kg: data?.yearSummary?.categoryTotals?.[c.key] ?? 0,
  }));

  // Shape the monthly trend for the line chart.
  const trendData = (data?.monthlyTrend || []).map((row) => ({
    month: MONTH_NAMES[row.month - 1].slice(0, 3),
    kg: row.totalKg,
  }));

  // A few recent years for the year picker (this year and the 4 before).
  const nowYear = new Date().getFullYear();
  const yearOptions = [nowYear, nowYear - 1, nowYear - 2, nowYear - 3, nowYear - 4];

  return (
    <div className="space-y-6">
      {/* ── Hero header ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 px-6 py-7 text-white shadow-sm">
        {/* Decorative blurred circles for a bit of depth. */}
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-teal-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                {icons.recycle}
              </span>
              WasteSync · BDO Reporting
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-emerald-100">
              Reporting overview for {data?.year ?? year}
            </p>
          </div>

          {/* Scope + year controls, styled for the dark hero background. */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-emerald-100">Scope</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white backdrop-blur transition focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-900"
              >
                <option value="all">All companies</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-emerald-100">Year</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white backdrop-blur transition focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-900"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {error && <AlertBanner level="error">{error}</AlertBanner>}

      {/* ── Key metrics ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard
          icon={icons.building}
          label="Companies"
          value={fmt(m.totalCompanies)}
          accent="blue"
        />
        <MetricCard
          icon={icons.clipboard}
          label="Entries this year"
          value={fmt(m.totalEntriesThisYear)}
          accent="violet"
        />
        <MetricCard
          icon={icons.report}
          label="Reports generated"
          value={fmt(m.reportsGeneratedThisYear)}
          accent="emerald"
        />
        <MetricCard
          icon={icons.alert}
          label="Missing months"
          value={fmt(m.missingMonthsCount)}
          hint={m.missingMonthsCount > 0 ? "Needs attention" : "All caught up"}
          accent={m.missingMonthsCount > 0 ? "amber" : "emerald"}
        />
        <MetricCard
          icon={icons.recycle}
          label="Total waste (kg)"
          value={fmt(m.grandTotalKg)}
          accent="emerald"
        />
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={icons.bars}>Waste by category (kg)</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
              <Bar dataKey="kg" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {categoryData.map((entry) => (
                  <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] || "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Colour legend so each bar's category is easy to read. */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {categoryData.map((c) => (
              <div key={c.key} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: CATEGORY_COLORS[c.key] || "#64748b" }}
                />
                {c.name}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={icons.trend}>Monthly trend (kg)</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                {/* A soft green gradient that fills the area under the line. */}
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="kg"
                stroke="#16a34a"
                strokeWidth={2.5}
                fill="url(#trendFill)"
                dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Alerts + reporting status ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={icons.shield}>Compliance alerts</SectionTitle>
          {(!data?.complianceAlerts || data.complianceAlerts.length === 0) ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-5 text-sm text-emerald-700">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                {icons.check}
              </span>
              No issues — everything looks good.
            </div>
          ) : (
            <div className="space-y-2">
              {data.complianceAlerts.map((a, i) => (
                <AlertBanner key={i} level={a.level}>
                  <span className="font-medium">{a.companyName}:</span> {a.message}
                </AlertBanner>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle icon={icons.check}>Reporting status ({data?.year})</SectionTitle>
          {(!data?.reportingStatus || data.reportingStatus.length === 0) ? (
            <p className="text-sm text-slate-500">No companies in scope.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.reportingStatus.map((s) => (
                <div
                  key={s.companyId}
                  className="flex items-center justify-between py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{s.companyName}</div>
                    <div className="font-mono text-xs text-slate-400">{s.bdoRegistrationNumber}</div>
                  </div>
                  {s.reported ? (
                    <Badge tone="green">Reported</Badge>
                  ) : (
                    <Badge tone="amber">Not reported</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Recent reports + recent activity ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle
            icon={icons.report}
            right={
              <Link to="/reports" className="text-xs font-medium text-emerald-700 hover:underline">
                View all
              </Link>
            }
          >
            Recent reports
          </SectionTitle>
          {(!data?.recentReports || data.recentReports.length === 0) ? (
            <p className="text-sm text-slate-500">No reports generated yet.</p>
          ) : (
            <div className="space-y-1">
              {data.recentReports.map((r) => (
                <Link
                  key={r._id}
                  to={`/reports/${r._id}`}
                  className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      {icons.report}
                    </span>
                    {r.year} · {r.companyName || r.companyId?.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle
            icon={icons.clock}
            right={
              <Link to="/audit-logs" className="text-xs font-medium text-emerald-700 hover:underline">
                View audit log
              </Link>
            }
          >
            Recent activity
          </SectionTitle>
          {(!data?.recentAuditLogs || data.recentAuditLogs.length === 0) ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <div className="space-y-1">
              {data.recentAuditLogs.map((log) => (
                <div
                  key={log._id}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {log.action}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
