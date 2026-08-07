import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
// useNavigate lets us move the user to another page when they click a button.
import { useNavigate } from "react-router-dom";
import { fetchDashboard } from "../store/slices/dashboardSlice";
import { useCapabilities } from "../hooks/useCapabilities";
import { useTranslation } from "../hooks/useTranslation";
import { useOrgBase } from "../utils/paths";

// ── Status badges ─────────────────────────────────────────────────────────────
// Each status keeps its colours here, but its WORDS come from the dictionary
// (labelKey), so the badge reads "Ważne" in Polish and "Valid" in English.
const statusConfig = {
  valid:     { labelKey: "status.valid",     cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500" },
  compliant: { labelKey: "status.compliant", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500" },
  expiring:  { labelKey: "status.expiring",  cls: "bg-amber-50  text-amber-700   ring-1 ring-amber-200",   dot: "bg-amber-500"   },
  warning:   { labelKey: "status.warning",   cls: "bg-amber-50  text-amber-700   ring-1 ring-amber-200",   dot: "bg-amber-500"   },
  expired:   { labelKey: "status.expired",   cls: "bg-red-50    text-red-700     ring-1 ring-red-200",     dot: "bg-red-500"     },
  missing:   { labelKey: "status.missing",   cls: "bg-red-50    text-red-700     ring-1 ring-red-200",     dot: "bg-red-500"     },
  blocked:   { labelKey: "status.blocked",   cls: "bg-red-50    text-red-700     ring-1 ring-red-200",     dot: "bg-red-500"     },
  allowed:   { labelKey: "status.allowed",   cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500" },
};

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const c = statusConfig[status] || statusConfig.valid;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {t(c.labelKey)}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900 leading-snug">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, colorKey, trend }) {
  const palette = {
    blue:    { iconBg: "bg-blue-500",    shadow: "shadow-blue-500/25",    trend: "bg-blue-50 text-blue-700"    },
    emerald: { iconBg: "bg-emerald-500", shadow: "shadow-emerald-500/25", trend: "bg-emerald-50 text-emerald-700"},
    amber:   { iconBg: "bg-amber-500",   shadow: "shadow-amber-500/25",   trend: "bg-amber-50 text-amber-700"  },
    red:     { iconBg: "bg-red-500",     shadow: "shadow-red-500/25",     trend: "bg-red-50 text-red-700"      },
    violet:  { iconBg: "bg-violet-500",  shadow: "shadow-violet-500/25",  trend: "bg-violet-50 text-violet-700"},
  }[colorKey] || {};

  // The card is laid out as one short row: icon on the left, numbers on the
  // right. Keeping everything side by side (instead of stacked) makes the card
  // much shorter, so the five cards take up less space at the top of the page.
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 shrink-0 rounded-xl ${palette.iconBg} shadow-md ${palette.shadow} flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <span className="shrink-0 text-2xl font-black text-slate-900 tracking-tight leading-none">{value}</span>
            {/* The little grey label (for example "Active records") is hidden on
                small phones. Two cards sit side by side there, so the card is
                too narrow and the label would stick out past the border.
                It comes back on wider screens where there is room for it. */}
            {trend && (
              <span
                title={trend}
                className={`hidden sm:inline-block min-w-0 truncate text-[9px] font-semibold rounded-full px-2 py-0.5 ${palette.trend}`}
              >
                {trend}
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-slate-700 mt-1 truncate">{title}</p>
          <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function ComplianceHealthCard({ health }) {
  const { t } = useTranslation();
  if (!health) return null;
  const { compliantPct: cp = 0, warningPct: wp = 0, blockedPct: bp = 0, compliant = 0, warning = 0, blocked = 0 } = health;
  return (
    <Card className="p-5 flex flex-col h-full">
      <CardHeader title={t("dashboard.healthTitle")} subtitle={t("dashboard.healthSubtitle")} />
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-5 bg-slate-100">
        <div className="bg-emerald-500 transition-all duration-700 rounded-l-full" style={{ width: `${cp}%` }} />
        <div className="bg-amber-400  transition-all duration-700"                 style={{ width: `${wp}%` }} />
        <div className="bg-red-500    transition-all duration-700 rounded-r-full"  style={{ width: `${bp}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { count: compliant, label: t("dashboard.healthCompliant"), bg: "bg-emerald-50", border: "border-emerald-200", num: "text-emerald-700", sub: "text-emerald-600" },
          { count: warning,   label: t("dashboard.healthWarning"),   bg: "bg-amber-50",   border: "border-amber-200",   num: "text-amber-700",   sub: "text-amber-600"   },
          { count: blocked,   label: t("dashboard.healthBlocked"),   bg: "bg-red-50",     border: "border-red-200",     num: "text-red-700",     sub: "text-red-600"     },
        ].map(tile => (
          <div key={tile.label} className={`rounded-xl border p-3 text-center ${tile.bg} ${tile.border}`}>
            <div className={`text-2xl font-bold ${tile.num}`}>{tile.count}</div>
            <div className={`text-xs font-medium mt-0.5 ${tile.sub}`}>{tile.label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-4 flex-1">
        {[
          { label: t("dashboard.healthCompliant"),    pct: cp, bar: "bg-emerald-500", track: "bg-emerald-100", val: "text-emerald-600" },
          { label: t("dashboard.healthExpiringSoon"), pct: wp, bar: "bg-amber-400",   track: "bg-amber-100",   val: "text-amber-600"   },
          { label: t("dashboard.healthBlocked"),      pct: bp, bar: "bg-red-500",     track: "bg-red-100",     val: "text-red-600"     },
        ].map(b => (
          <div key={b.label}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-600">{b.label}</span>
              <span className={`font-bold ${b.val}`}>{b.pct}%</span>
            </div>
            <div className={`h-2 rounded-full ${b.track}`}>
              <div className={`h-full rounded-full ${b.bar} transition-all duration-700`} style={{ width: `${b.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BlockedEmployees({ employees = [] }) {
  const list = employees.filter(e => e.clockInStatus === "blocked");
  // Fixing a block means uploading a valid certificate, so only roles allowed to
  // upload documents are offered the button. Read-only roles still SEE who is
  // blocked and why — that is the information an auditor needs.
  const { can, CAPABILITIES } = useCapabilities();
  const { t } = useTranslation();
  const canFixCompliance = can(CAPABILITIES.DOCUMENT_WRITE);
  return (
    <Card className="p-5 flex flex-col h-full">
      <CardHeader
        title={t("dashboard.blockedTitle")}
        subtitle={t("dashboard.blockedSubtitle")}
        action={
          <span className="w-7 h-7 rounded-lg bg-red-100 border border-red-200 text-red-700 text-xs font-bold flex items-center justify-center">
            {list.length}
          </span>
        }
      />
      <div className="space-y-3 flex-1">
        {list.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">{t("dashboard.blockedNone")}</p>
        )}
        {list.map(emp => (
          <div key={emp.id} className="rounded-xl bg-red-50 border border-red-100 p-4">
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div>
                <p className="text-sm font-bold text-slate-900">{emp.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{emp.jobRole} · {emp.site}</p>
              </div>
              <StatusBadge status="blocked" />
            </div>
            <div className="flex items-center gap-2 bg-white border border-red-100 rounded-lg px-3 py-2 mb-3">
              <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-xs text-red-700">
                {emp.medicalStatus === "expired"
                  ? t("dashboard.blockedMedicalExpired", {
                      date: emp.medicalExpiry ? new Date(emp.medicalExpiry).toLocaleDateString("en-GB") : "",
                    })
                  : emp.medicalStatus === "missing"
                  ? t("dashboard.blockedMedicalMissing")
                  : t("dashboard.blockedGeneric")}
              </span>
            </div>
            {canFixCompliance && (
              <button className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-semibold text-white transition-colors">
                {t("dashboard.blockedResolve")}
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

const avatarColors = [
  "from-blue-500 to-cyan-500", "from-violet-500 to-purple-500",
  "from-rose-500 to-pink-500", "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500", "from-sky-500 to-blue-500",
];

function EmployeeComplianceTable({ employees = [] }) {
  const { t } = useTranslation();

  return (
    <Card className="p-5">
      <CardHeader
        title={t("dashboard.registerTitle")}
        subtitle={t("dashboard.registerSubtitle")}
        action={
          <button className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:border-emerald-200 transition-colors shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {t("common.exportCsv")}
          </button>
        }
      />
      {employees.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">{t("dashboard.registerEmpty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  t("dashboard.colEmployee"),
                  t("dashboard.colDepartment"),
                  t("dashboard.colSite"),
                  t("dashboard.colMedical"),
                  t("dashboard.colBhp"),
                  t("dashboard.colOverall"),
                  t("dashboard.colClockIn"),
                ].map(h => (
                  <th key={h} className="pb-3 px-2 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map((emp, idx) => {
                const initials = (emp.name || "").split(" ").map(n => n[0]).join("").slice(0, 2);
                return (
                  <tr key={emp.id || idx} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-3.5 px-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[idx % avatarColors.length]} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{emp.name}</p>
                          <p className="text-[11px] text-slate-400">{emp.employeeCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-2 text-sm text-slate-500">{emp.department}</td>
                    <td className="py-3.5 px-2 text-sm text-slate-500">{emp.site}</td>
                    <td className="py-3.5 px-2"><StatusBadge status={emp.medicalStatus} /></td>
                    <td className="py-3.5 px-2"><StatusBadge status={emp.bhpStatus} /></td>
                    <td className="py-3.5 px-2"><StatusBadge status={emp.overallStatus} /></td>
                    <td className="py-3.5 px-2"><StatusBadge status={emp.clockInStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// The backend labels each warning with fixed English text. This turns that text
// into the words for the chosen language. Anything unexpected is shown as it came,
// so a new backend value is still visible rather than blank.
const ALERT_LEVEL_KEYS = {
  "Expired": "dashboard.levelExpired",
  "Missing Document": "dashboard.levelMissingDocument",
  "7-day warning": "dashboard.level7Day",
  "30-day warning": "dashboard.level30Day",
};

function ExpiringDocumentsTable({ expiringDocuments = [] }) {
  // "navigate" is the function that changes the page the user is looking at.
  const navigate = useNavigate();
  // "/company/{tenantId}" — we keep the company in the address when we move.
  const orgBase = useOrgBase();
  // Only roles that may upload a certificate get the "Upload / Renew" action.
  const { can, CAPABILITIES } = useCapabilities();
  const { t } = useTranslation();
  const canUploadDocuments = can(CAPABILITIES.DOCUMENT_WRITE);

  return (
    <Card className="p-5">
      <CardHeader
        title={t("dashboard.expiringTitle")}
        subtitle={t("dashboard.expiringSubtitle")}
        action={
          // When the user clicks "View All" we send them to the employee list
          // page, where they can see every employee and their document status.
          <button
            type="button"
            onClick={() => navigate(`${orgBase}/employees`)}
            aria-label={t("dashboard.viewAllAria")}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm shadow-emerald-500/20"
          >
            {t("common.viewAll")}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        }
      />
      {expiringDocuments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">{t("dashboard.expiringEmpty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  t("dashboard.colEmployee"),
                  t("dashboard.colDocument"),
                  t("dashboard.colExpiryDate"),
                  t("common.status"),
                  t("dashboard.colAlertLevel"),
                  t("dashboard.colAction"),
                ].map((h, i) => (
                  <th key={h} className={`pb-3 px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expiringDocuments.map((doc, idx) => {
                const isExpiredOrMissing = doc.level === "Expired" || doc.level === "Missing Document";
                const isCritical = doc.level === "7-day warning";
                return (
                  <tr key={doc.id || idx} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-3.5 px-2 text-sm font-semibold text-slate-800">{doc.employee}</td>
                    <td className="py-3.5 px-2 text-sm text-slate-500">{doc.documentType}</td>
                    <td className="py-3.5 px-2 text-xs text-slate-500 font-mono">{doc.expiryDate}</td>
                    <td className="py-3.5 px-2 text-sm">
                      {doc.daysLeft === null
                        ? <span className="font-semibold text-red-600">{t("status.missing")}</span>
                        : doc.daysLeft < 0
                        ? <span className="font-semibold text-red-600">{t("common.daysOverdue", { count: Math.abs(doc.daysLeft) })}</span>
                        : <span className={`font-semibold ${isCritical ? "text-amber-600" : "text-slate-600"}`}>{t("common.daysLeft", { count: doc.daysLeft })}</span>
                      }
                    </td>
                    <td className="py-3.5 px-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isExpiredOrMissing ? "bg-red-100 text-red-700"
                        : isCritical       ? "bg-amber-100 text-amber-700"
                                           : "bg-blue-100 text-blue-700"
                      }`}>
                        {ALERT_LEVEL_KEYS[doc.level] ? t(ALERT_LEVEL_KEYS[doc.level]) : doc.level}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      {canUploadDocuments ? (
                        <button className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          {t("dashboard.uploadRenew")}
                        </button>
                      ) : (
                        // Read-only roles see the warning but not the fix action.
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// Turns a date into "just now" / "5 min ago" / "3 hours ago" / a plain date.
//
// It takes `t` as an argument (instead of using the hook) because this is a plain
// helper, not a component — only components may use hooks. The caller passes its
// own t, so the wording always matches the language on screen.
function formatRelativeTime(dateStr, t, locale) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 2) return t("common.justNow");
  if (diffMin < 60) return t("common.minutesAgo", { count: diffMin });
  if (diffHr < 24) return t("common.hoursAgo", { count: diffHr });
  if (diffDay < 2) return t("common.yesterday");
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

// Colour for the small status pill. The WORDS come from the dictionary (see
// DOC_STATUS_KEYS below); this only decides the colours.
const docStatusCls = (status = "") => {
  switch (status.toUpperCase()) {
    case "VALID":    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "EXPIRING": return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "EXPIRED":  return "bg-red-50 text-red-700 ring-1 ring-red-200";
    default:         return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
  }
};

// The backend sends the document status in capital letters. Map it to words in
// the chosen language, and fall back to whatever came if it is something new.
const DOC_STATUS_KEYS = {
  VALID: "status.valid",
  EXPIRING: "status.expiring",
  EXPIRED: "status.expired",
  MISSING: "status.missing",
};

function RecentDocumentsTable({ recentDocuments = [] }) {
  const { t, language } = useTranslation();

  const iconCls = (type = "") =>
    type === "Medical Certificate" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600";

  return (
    <Card className="p-5 flex flex-col h-full">
      <CardHeader
        title={t("dashboard.recentDocsTitle")}
        subtitle={t("dashboard.recentDocsSubtitle")}
        action={
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
        }
      />
      {recentDocuments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t("dashboard.recentDocsEmpty")}</p>
      ) : (
        <div className="space-y-1 flex-1">
          {recentDocuments.map((doc, idx) => (
            <div key={doc.id || idx} className="flex items-start gap-3  rounded-xl hover:bg-slate-50 transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconCls(doc.documentType)}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{doc.employeeName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{doc.documentType}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${docStatusCls(doc.status)}`}>
                    {DOC_STATUS_KEYS[String(doc.status).toUpperCase()]
                      ? t(DOC_STATUS_KEYS[String(doc.status).toUpperCase()])
                      : doc.status}
                  </span>
                  {doc.expiryDate && (
                    <span className="text-[11px] text-slate-400">
                      {t("dashboard.expiresShort", { date: new Date(doc.expiryDate).toLocaleDateString("en-GB") })}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t("dashboard.uploadedAt", { time: formatRelativeTime(doc.uploadDate, t, language) })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const avatarColors2 = [
  "from-sky-500 to-blue-500", "from-violet-500 to-purple-500",
  "from-rose-500 to-pink-500", "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500", "from-blue-500 to-cyan-500",
];

function RecentEmployeesTable({ recentEmployees = [] }) {
  const { t, language } = useTranslation();

  return (
    <Card className="p-5 flex flex-col h-full">
      <CardHeader
        title={t("dashboard.recentEmployeesTitle")}
        subtitle={t("dashboard.recentEmployeesSubtitle")}
        action={
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
        }
      />
      {recentEmployees.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t("dashboard.recentEmployeesEmpty")}</p>
      ) : (
        <div className="space-y-1 flex-1">
          {recentEmployees.map((emp, idx) => {
            const initials = (emp.name || "").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={emp.id || idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColors2[idx % avatarColors2.length]} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                  {initials || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{emp.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {emp.employeeId} · {emp.department}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t("dashboard.addedAt", { time: formatRelativeTime(emp.createdAt, t, language) })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AuditActivity({ auditActivity = [] }) {
  const { t, language } = useTranslation();

  const actionMeta = {
    DOCUMENT_UPLOADED:        { dot: "bg-blue-500",    ring: "ring-blue-100",    label: t("dashboard.auditUpload")     },
    EMPLOYEE_PROFILE_CREATED: { dot: "bg-emerald-500", ring: "ring-emerald-100", label: t("dashboard.auditCreated")    },
    EMPLOYEE_PROFILE_UPDATED: { dot: "bg-sky-500",     ring: "ring-sky-100",     label: t("dashboard.auditUpdated")    },
    COMPLIANCE_UPDATED:       { dot: "bg-amber-400",   ring: "ring-amber-100",   label: t("dashboard.auditCompliance") },
    CLOCK_IN_BLOCKED:         { dot: "bg-red-500",     ring: "ring-red-100",     label: t("dashboard.auditBlocked")    },
  };
  return (
    <Card className="p-5 flex flex-col h-full">
      <CardHeader title={t("dashboard.auditTitle")} subtitle={t("dashboard.auditSubtitle")} />
      {auditActivity.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t("dashboard.auditEmpty")}</p>
      ) : (
        <div className="relative flex-1">
          <div className="absolute left-3 top-1 bottom-1 w-px bg-slate-200" />
          <div className="space-y-5">
            {auditActivity.map((activity, idx) => {
              const meta = actionMeta[activity.action] || { dot: "bg-slate-400", ring: "ring-slate-100", label: t("dashboard.auditAction") };
              return (
                <div key={activity.id || idx} className="relative pl-9">
                  <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full ring-4 ${meta.ring} ${meta.dot} flex items-center justify-center z-10`}>
                    <span className="text-white text-[9px] font-black">{meta.label[0]}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {activity.action.replace(/_/g, " ")}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white ${meta.dot}`}>{meta.label}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5 leading-snug">{activity.description}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      <span className="font-medium text-slate-500">{activity.user}</span>
                      {" · "}
                      {formatRelativeTime(activity.time, t, language)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-40 rounded-3xl bg-slate-200" />
      <div className="grid grid-cols-5 gap-4">
        {/* Same height as the real metric cards so the page does not jump. */}
        {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-200" />)}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 h-64 rounded-2xl bg-slate-200" />
        <div className="col-span-4 h-64 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function ComplianceDashboard() {
  const dispatch = useDispatch();
  // t() gives the words for the chosen language; `language` is used for dates so
  // "30 Jul 2026" is written the way each language writes dates.
  const { t, language } = useTranslation();
  const { data, loading, error } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const metrics          = data?.metrics            || {};
  const employees        = data?.employees          || [];
  const health           = data?.complianceHealth   || null;
  const expiringDocuments = data?.expiringDocuments || [];
  const recentDocuments  = data?.recentDocuments    || [];
  const recentEmployees  = data?.recentEmployees    || [];
  const auditActivity    = data?.recentAuditLogs    || data?.auditActivity || [];

  const metricCards = [
    {
      title: t("dashboard.metricTotal"), value: metrics.total ?? "—",     subtitle: t("dashboard.metricTotalSub"),   colorKey: "blue",    trend: t("dashboard.metricTotalTrend"),
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    },
    {
      title: t("dashboard.metricCompliant"), value: metrics.compliant ?? "—", subtitle: t("dashboard.metricCompliantSub"),   colorKey: "emerald", trend: t("dashboard.metricCompliantTrend"),
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    },
    {
      title: t("dashboard.metricExpiring"),   value: metrics.expiringSoon ?? "—",  subtitle: t("dashboard.metricExpiringSub"),    colorKey: "amber",   trend: t("dashboard.metricExpiringTrend"),
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      title: t("dashboard.metricBlocked"),         value: metrics.blocked ?? "—",   subtitle: t("dashboard.metricBlockedSub"), colorKey: "red",     trend: t("dashboard.metricBlockedTrend"),
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
    },
    {
      title: t("dashboard.metricMissing"),    value: metrics.missingDocs ?? "—",   subtitle: t("dashboard.metricMissingSub"),    colorKey: "violet",  trend: t("dashboard.metricMissingTrend"),
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Page Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-40 -bottom-20 w-48 h-48 rounded-full bg-teal-400/20" />
          <div className="pointer-events-none absolute -left-8 bottom-0 w-32 h-32 rounded-full bg-emerald-800/30" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {t("dashboard.badge")}
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("dashboard.title")}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-100">
                {t("dashboard.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="rounded-2xl bg-white/15 border border-white/20 p-4 text-right backdrop-blur-sm">
                <p className="text-xs text-emerald-200 uppercase tracking-widest font-semibold">{t("common.today")}</p>
                <p className="mt-0.5 text-2xl font-bold">{new Date().toLocaleDateString(language, { day: "numeric", month: "short", year: "numeric" })}</p>
                <p className="mt-0.5 text-xs text-emerald-200">{data ? t("common.dataLoaded") : loading ? t("common.loading") : t("common.noData")}</p>
              </div>
              <button
                onClick={() => dispatch(fetchDashboard())}
                className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {t("common.refresh")}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {t("dashboard.loadFailed", { error })}
          </div>
        )}

        {loading && !data ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {metricCards.map((card, i) => (
                <div key={i} className={i === 4 ? "col-span-2 lg:col-span-1" : ""}>
                  <MetricCard {...card} />
                </div>
              ))}
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8"><EmployeeComplianceTable employees={employees} /></div>
              <div className="xl:col-span-4"><ComplianceHealthCard health={health} /></div>
              <div className="xl:col-span-8"><ExpiringDocumentsTable expiringDocuments={expiringDocuments} /></div>
              <div className="xl:col-span-4"><BlockedEmployees employees={employees} /></div>
            </div>

            {/* Bottom 3-col: Recently Uploaded Docs · Recently Added Employees · Audit Log */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <RecentDocumentsTable recentDocuments={recentDocuments} />
              <RecentEmployeesTable recentEmployees={recentEmployees} />
              <AuditActivity auditActivity={auditActivity} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
