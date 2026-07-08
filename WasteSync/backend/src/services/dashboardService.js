const mongoose = require('mongoose');
const Company = require('../models/Company');
const WasteEntry = require('../models/WasteEntry');
const AnnualReport = require('../models/AnnualReport');
const AuditLog = require('../models/AuditLog');
const { WASTE_CATEGORY_KEYS } = require('../utils/wasteCategories');

// Builds everything the dashboard needs in a SINGLE response, so the frontend
// makes one call. Everything is scoped to the tenant. An optional companyId
// narrows the figures to one company; otherwise we cover all of the tenant's
// companies. The year defaults to the current year.
const getOverview = async (tenantId, { companyId, year } = {}) => {
  const reportingYear = Number(year) || new Date().getFullYear();

  // Which companies are we covering?
  const companyFilter = { tenantId, deletedAt: null };
  if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
    companyFilter._id = companyId;
  }
  const companies = await Company.find(companyFilter).select('_id name bdoRegistrationNumber');
  const companyIds = companies.map((c) => c._id);

  // Base match for waste queries — limited to the chosen companies + year.
  const wasteMatch = {
    tenantId,
    year: reportingYear,
    isLatest: true,
  };
  if (companyIds.length) wasteMatch.companyId = { $in: companyIds };

  // ── Year summary: per-category totals + grand total ────────────────────────
  const entries = await WasteEntry.find(wasteMatch);

  const categoryTotals = {};
  for (const key of WASTE_CATEGORY_KEYS) categoryTotals[key] = 0;

  // monthlyTrend[1..12] = total kg recorded that month (for the line chart).
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, totalKg: 0 }));
  const monthsWithData = new Set();

  for (const entry of entries) {
    monthsWithData.add(`${entry.companyId}-${entry.month}`);
    monthlyTrend[entry.month - 1].totalKg += entry.totalWeightKg;
    for (const item of entry.items) {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.weightKg;
    }
  }
  const grandTotalKg = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // ── Missing monthly entries ────────────────────────────────────────────────
  // For each company we expect 12 months. We count how many (company, month)
  // pairs are missing so far this year, and list them for the alert panel.
  const missingByCompany = [];
  for (const company of companies) {
    const missing = [];
    for (let m = 1; m <= 12; m += 1) {
      if (!monthsWithData.has(`${company._id}-${m}`)) missing.push(m);
    }
    if (missing.length) {
      missingByCompany.push({
        companyId: company._id,
        companyName: company.name,
        missingMonths: missing,
      });
    }
  }
  const missingMonthsCount = missingByCompany.reduce((sum, c) => sum + c.missingMonths.length, 0);

  // ── Reports + reporting status ──────────────────────────────────────────────
  const reportMatch = { tenantId, year: reportingYear };
  if (companyIds.length) reportMatch.companyId = { $in: companyIds };
  const reportsThisYear = await AnnualReport.find(reportMatch).sort({ version: -1 });

  // A company is "reported" if it has at least one generated report this year.
  const reportedCompanyIds = new Set(reportsThisYear.map((r) => r.companyId.toString()));
  const reportingStatus = companies.map((c) => ({
    companyId: c._id,
    companyName: c.name,
    bdoRegistrationNumber: c.bdoRegistrationNumber,
    reported: reportedCompanyIds.has(c._id.toString()),
  }));

  // ── Compliance alerts ───────────────────────────────────────────────────────
  // Combine threshold breaches from the latest reports with the missing-data
  // warnings, so the dashboard shows one clear list of things to fix.
  const complianceAlerts = [];
  for (const report of reportsThisYear) {
    if (report.version === Math.max(...reportsThisYear.filter((r) => r.companyId.toString() === report.companyId.toString()).map((r) => r.version))) {
      for (const breach of report.thresholdValidation?.breaches || []) {
        complianceAlerts.push({
          level: breach.type === 'OVER_MAX' ? 'error' : 'warning',
          companyName: report.companyName,
          message: breach.message,
        });
      }
    }
  }
  for (const c of missingByCompany) {
    complianceAlerts.push({
      level: 'info',
      companyName: c.companyName,
      message: `${c.missingMonths.length} month(s) of ${reportingYear} have no waste data yet`,
    });
  }

  // ── Recent reports (across all years) and recent audit activity ─────────────
  const recentReportMatch = { tenantId };
  if (companyIds.length) recentReportMatch.companyId = { $in: companyIds };
  const recentReports = await AnnualReport.find(recentReportMatch)
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('companyId', 'name bdoRegistrationNumber');

  const recentAuditLogs = await AuditLog.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    year: reportingYear,
    metrics: {
      totalCompanies: companies.length,
      totalEntriesThisYear: entries.length,
      reportsGeneratedThisYear: reportsThisYear.length,
      missingMonthsCount,
      grandTotalKg,
    },
    yearSummary: { categoryTotals, grandTotalKg },
    monthlyTrend,
    reportingStatus,
    missingByCompany,
    complianceAlerts,
    recentReports,
    recentAuditLogs,
  };
};

module.exports = { getOverview };
