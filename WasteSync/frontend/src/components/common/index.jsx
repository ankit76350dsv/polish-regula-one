// A small set of reusable UI building blocks used across all pages.
// Keeping them in one file makes them easy to find and reuse, and keeps the
// look-and-feel consistent (cards, badges, banners, loaders, page headers).

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ── StatCard — a big number with a label, used on the dashboard ───────────────
export function StatCard({ label, value, hint, tone = "default" }) {
  const tones = {
    default: "text-slate-900",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-red-600",
  };
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tones[tone] || tones.default}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Card>
  );
}

// ── Badge — a small coloured status pill ──────────────────────────────────────
export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

// ── AlertBanner — coloured message box for errors / warnings / info ───────────
export function AlertBanner({ level = "info", children }) {
  if (!children) return null;
  const styles = {
    error: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[level] || styles.info}`}>
      {children}
    </div>
  );
}

// ── Loader — centred spinner used while data loads ────────────────────────────
export function Loader({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">{label}</p>
      </div>
    </div>
  );
}

// ── EmptyState — friendly "nothing here yet" message with an optional action ──
export function EmptyState({ title, message, action }) {
  return (
    <Card className="p-10 text-center">
      <div className="text-slate-900 font-medium">{title}</div>
      {message && <div className="mt-1 text-sm text-slate-500">{message}</div>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

// ── PageHeader — the title row at the top of each page ────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Button — a single styled button used everywhere ───────────────────────────
export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
