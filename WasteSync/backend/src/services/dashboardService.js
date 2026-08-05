const WasteEntry = require('../models/WasteEntry');
const AnnualReport = require('../models/AnnualReport');
const AuditLog = require('../models/AuditLog');
const { WASTE_CATEGORY_KEYS } = require('../utils/wasteCategories');
const { resolveFilingObligation } = require('../utils/bdoDeadlines');

// Builds everything the dashboard needs in a SINGLE response, so the frontend
// makes one call. Everything is scoped to the tenant, and the year defaults to
// the current year.
//
// WHAT CHANGED AND WHY
// This used to loop over a list of Company documents, group figures per company,
// and accept a companyId to narrow the view. All of that assumed a tenant could
// own several companies. It cannot: one customer = one company, registered in
// RegulaOne. So the per-company grouping was work that always produced exactly
// one group, and the "scope" filter always had one choice.
//
// The figures are now aggregated straight from tenantId. The company's NAME and
// BDO number are no longer read from the database at all — the caller passes in
// the live profile it already fetched from RegulaOne, so the dashboard shows the
// current legal name rather than a stale copy.
//
// includeAuditActivity says whether this caller is allowed to see the audit trail.
// It defaults to FALSE so a caller that forgets to pass it gets LESS data, never
// more — leaving audit records out by mistake is a bug, handing them to the wrong
// person is a privacy incident.
const getOverview = async (
  tenantId,
  { year, company = null, includeAuditActivity = false } = {}
) => {
  const reportingYear = Number(year) || new Date().getFullYear();

  // ── Year summary: per-category totals + grand total ────────────────────────
  const entries = await WasteEntry.find({
    tenantId,
    year: reportingYear,
    isLatest: true,
  });

  const categoryTotals = {};
  for (const key of WASTE_CATEGORY_KEYS) categoryTotals[key] = 0;

  // monthlyTrend[1..12] = total kg recorded that month (for the line chart).
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, totalKg: 0 }));
  const monthsWithData = new Set();

  for (const entry of entries) {
    monthsWithData.add(entry.month);
    monthlyTrend[entry.month - 1].totalKg += entry.totalWeightKg;
    for (const item of entry.items) {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.weightKg;
    }
  }
  const grandTotalKg = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // ── Missing monthly entries ────────────────────────────────────────────────
  // We expect 12 months in a full year. List the ones with no data yet so the
  // alert panel can show them.
  const missingMonths = [];
  for (let m = 1; m <= 12; m += 1) {
    if (!monthsWithData.has(m)) missingMonths.push(m);
  }

  // ── Reports + reporting status ──────────────────────────────────────────────
  const reportsThisYear = await AnnualReport.find({ tenantId, year: reportingYear }).sort({
    version: -1,
  });

  // The company is "reported" for this year once at least one report exists.
  // reportsThisYear is sorted newest version first, so [0] is the current one.
  const latestReport = reportsThisYear[0] || null;
  const reportingStatus = {
    // Prefer the live name from RegulaOne; fall back to the snapshot on the last
    // report so the panel still says something useful if RegulaOne is unreachable.
    companyName: company?.name || latestReport?.companyName || null,
    bdoRegistrationNumber:
      company?.bdoRegistrationNumber || latestReport?.bdoRegistrationNumber || null,
    reported: Boolean(latestReport),
  };

  // ── Compliance alerts ───────────────────────────────────────────────────────
  // Combine threshold breaches from the LATEST report with the missing-data
  // warning, so the dashboard shows one clear list of things to fix.
  const complianceAlerts = [];
  const companyLabel = reportingStatus.companyName || 'Your company';

  for (const breach of latestReport?.thresholdValidation?.breaches || []) {
    complianceAlerts.push({
      level: breach.type === 'OVER_MAX' ? 'error' : 'warning',
      companyName: companyLabel,
      message: breach.message,
    });
  }

  if (missingMonths.length) {
    complianceAlerts.push({
      level: 'info',
      companyName: companyLabel,
      message: `${missingMonths.length} month(s) of ${reportingYear} have no waste data yet`,
    });
  }

  // ── The legally-due annual report ───────────────────────────────────────────
  // The dashboard's year picker shows how the CURRENT year is going, but the
  // report the law actually wants right now is for the year BEFORE, due 15 March.
  // Those are two different years, and confusing them is how a filing gets
  // missed — so this block is worked out independently of the selected year.
  const filingObligation = await resolveFilingObligation({
    // A customer who joined this year is not told last year's report is late —
    // we have no data for a year before their account existed.
    activeSinceYear: company?.registeredAt
      ? new Date(company.registeredAt).getFullYear()
      : null,
    lookupYear: async (targetYear) => {
      const reports = await AnnualReport.find({ tenantId, year: targetYear }).select('status');
      return {
        generated: reports.length > 0,
        submitted: reports.some((r) => r.status === 'SUBMITTED'),
      };
    },
  });

  // ── Recent reports (across all years) and recent audit activity ─────────────
  const recentReports = await AnnualReport.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(5);

  // The "recent activity" list is the audit trail. Only callers who are allowed to
  // read the audit trail get it — for everyone else we return an empty list and do
  // not even run the query.
  //
  // WHY: HR may use the dashboard but may NOT open the Audit Logs page, because the
  // trail shows which colleague looked at or corrected whose figures. If the
  // dashboard still handed HR the last ten audit records, the restriction on the
  // Audit Logs page would achieve nothing — the same data would simply arrive by a
  // different door. The route tells us whether this caller holds AUDIT_READ.
  const recentAuditLogs = includeAuditActivity
    ? await AuditLog.find({ tenantId }).sort({ createdAt: -1 }).limit(10)
    : [];

  return {
    year: reportingYear,
    // The company these figures belong to. null when RegulaOne was unreachable —
    // the figures are still correct, we just cannot name the company.
    company: company
      ? {
          name: company.name,
          bdoRegistrationNumber: company.bdoRegistrationNumber,
          nip: company.nip,
        }
      : null,
    metrics: {
      totalEntriesThisYear: entries.length,
      reportsGeneratedThisYear: reportsThisYear.length,
      missingMonthsCount: missingMonths.length,
      grandTotalKg,
    },
    yearSummary: { categoryTotals, grandTotalKg },
    monthlyTrend,
    reportingStatus,
    // The 15 March obligation — always about the previous year, never the year
    // chosen in the picker above.
    filingObligation,
    missingMonths,
    complianceAlerts,
    recentReports,
    recentAuditLogs,
  };
};

module.exports = { getOverview };
