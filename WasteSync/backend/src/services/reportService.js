const mongoose = require('mongoose');
const WasteEntry = require('../models/WasteEntry');
const AnnualReport = require('../models/AnnualReport');
const WasteThreshold = require('../models/WasteThreshold');
const { logAudit } = require('../middleware/auditLogger');
const { evaluateThresholds } = require('../utils/bdoValidators');
const { WASTE_CATEGORY_KEYS } = require('../utils/wasteCategories');
const { generateAnnualReportXml } = require('./xmlGeneratorService');
const { generateAnnualReportPdf } = require('./pdfGeneratorService');
const { buildReportKey, uploadBuffer, generateDownloadUrl } = require('../utils/s3');

// NOTE: assertCompanyInTenant() used to live here. It loaded a local Company
// document and checked it belonged to the caller. Both the collection and the
// check are gone — reports are scoped by tenantId, which the auth middleware
// resolves from the verified session and the client can never supply. The
// company's identity now arrives as a plain object read live from RegulaOne (see
// services/companyProfileService.js) and is passed in by the controller.

// Builds the configured legal thresholds for a tenant + year. A tenant-specific
// row wins over the platform default (tenantId = null) for the same category.
const loadThresholds = async (tenantId, year) => {
  const rows = await WasteThreshold.find({
    year: Number(year),
    $or: [{ tenantId }, { tenantId: null }],
  });

  // Prefer tenant rows; fall back to global defaults per category.
  const byCategory = new Map();
  for (const row of rows) {
    const existing = byCategory.get(row.category);
    // A tenant-specific row replaces a global one.
    if (!existing || (row.tenantId && !existing.tenantId)) {
      byCategory.set(row.category, row);
    }
  }
  return Array.from(byCategory.values());
};

// Aggregates the LATEST monthly entries for a year into the numbers a report
// needs: per-category totals, the grand total, a 12-month breakdown, and the
// list of months that had no data.
const aggregateYear = async (tenantId, year) => {
  const entries = await WasteEntry.find({
    tenantId,
    year: Number(year),
    isLatest: true,
  });

  // Start every category at 0 so the report always lists all categories.
  const categoryTotals = {};
  for (const key of WASTE_CATEGORY_KEYS) categoryTotals[key] = 0;

  const monthlyBreakdown = {};
  const monthsWithData = new Set();

  for (const entry of entries) {
    monthsWithData.add(entry.month);
    monthlyBreakdown[entry.month] = monthlyBreakdown[entry.month] || {};
    for (const item of entry.items) {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.weightKg;
      monthlyBreakdown[entry.month][item.category] =
        (monthlyBreakdown[entry.month][item.category] || 0) + item.weightKg;
    }
  }

  const grandTotalKg = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // Which of the 12 months had no recorded data.
  const missingMonths = [];
  for (let m = 1; m <= 12; m += 1) {
    if (!monthsWithData.has(m)) missingMonths.push(m);
  }

  return { categoryTotals, grandTotalKg, monthlyBreakdown, missingMonths, entryCount: entries.length };
};

// Generates the full annual report: builds the figures, runs the threshold
// check, renders the XML + PDF, stores both in S3, and saves an AnnualReport
// document. Each call creates a NEW version, so previous reports are kept.
//
// `company` is the live profile the controller read from RegulaOne (name, NIP,
// REGON, address) with our BDO number merged in. It is passed in rather than
// loaded here so this service never has to know about HTTP requests or tokens.
const generateAnnualReport = async ({ company, year }, actor) => {
  // The BDO registration number identifies the company to the government
  // register and is printed on both the XML and the PDF. RegulaOne does not hold
  // this number, so a tenant that has not set it yet has none. Refuse here rather
  // than produce a report with an empty registration number — an invalid filing.
  if (!company?.bdoRegistrationNumber) {
    throw {
      status: 400,
      message:
        'Add your 9-digit BDO registration number on the Company page before generating a report',
    };
  }

  const { categoryTotals, grandTotalKg, monthlyBreakdown, missingMonths, entryCount } =
    await aggregateYear(actor.tenantId, year);

  if (entryCount === 0) {
    throw { status: 400, message: 'There is no waste data for this year yet' };
  }

  // Run the configured legal threshold check.
  const thresholds = await loadThresholds(actor.tenantId, year);
  const thresholdValidation = evaluateThresholds(categoryTotals, thresholds);

  // Render the two report files.
  const generatedAt = new Date().toISOString();
  const xmlString = generateAnnualReportXml({
    company,
    year,
    categoryTotals,
    grandTotalKg,
    monthlyBreakdown,
  });
  const pdfBuffer = await generateAnnualReportPdf({
    company,
    year,
    categoryTotals,
    grandTotalKg,
    monthlyBreakdown,
    thresholdValidation,
    missingMonths,
    generatedAt,
  });

  // Work out the next version number for this year.
  const previous = await AnnualReport.findOne({
    tenantId: actor.tenantId,
    year: Number(year),
  }).sort({ version: -1 });
  const version = previous ? previous.version + 1 : 1;

  // Store both files in the private, EEA S3 bucket.
  const xmlKey = await uploadBuffer({
    key: buildReportKey({ tenantId: actor.tenantId, year, fileName: `annual-report-v${version}.xml` }),
    body: Buffer.from(xmlString, 'utf-8'),
    contentType: 'application/xml',
  });
  const pdfKey = await uploadBuffer({
    key: buildReportKey({ tenantId: actor.tenantId, year, fileName: `annual-report-v${version}.pdf` }),
    body: pdfBuffer,
    contentType: 'application/pdf',
  });

  // Save the report record. The company identity fields are a SNAPSHOT of what
  // RegulaOne said at this moment, so the filed report stays truthful even if the
  // company is later renamed or moved.
  const report = await AnnualReport.create({
    tenantId: actor.tenantId,
    year: Number(year),
    bdoRegistrationNumber: company.bdoRegistrationNumber,
    companyName: company.name,
    nip: company.nip,
    regon: company.regon,
    categoryTotals,
    grandTotalKg,
    monthlyBreakdown,
    missingMonths,
    thresholdValidation,
    xmlS3Key: xmlKey,
    pdfS3Key: pdfKey,
    status: 'GENERATED',
    version,
    generatedBy: actor.userId,
  });

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'REPORT_GENERATED',
    resource: 'AnnualReport',
    resourceId: report._id.toString(),
    newValue: { year: report.year, version, grandTotalKg, thresholdPassed: thresholdValidation.passed },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return report;
};

// Lists generated reports for the tenant (optionally filtered by year).
//
// The old .populate('companyId', ...) is gone with the Company collection. It is
// not missed: each report already stores its own companyName and BDO number as a
// snapshot, which is the correct thing to show anyway — a list of filings should
// display what was filed, not today's company details.
const listReports = async (tenantId, filters = {}) => {
  const query = { tenantId };
  if (filters.year) query.year = Number(filters.year);

  return AnnualReport.find(query).sort({ year: -1, version: -1 });
};

// Returns one report (scoped to the tenant).
const getReportById = async (reportId, tenantId) => {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    throw { status: 400, message: 'Valid report id is required' };
  }
  const report = await AnnualReport.findOne({ _id: reportId, tenantId });
  if (!report) throw { status: 404, message: 'Report not found' };
  return report;
};

// Creates a short-lived presigned download URL for a report's XML or PDF, and
// logs the download for the audit trail.
const getReportDownloadUrl = async (reportId, format, actor) => {
  const report = await getReportById(reportId, actor.tenantId);

  const key = format === 'xml' ? report.xmlS3Key : format === 'pdf' ? report.pdfS3Key : null;
  if (!key) throw { status: 400, message: "format must be 'xml' or 'pdf'" };

  const url = await generateDownloadUrl(key);

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'REPORT_DOWNLOADED',
    resource: 'AnnualReport',
    resourceId: report._id.toString(),
    newValue: { format, s3Key: key },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return { url, format };
};

// Marks a report as SUBMITTED once the company has uploaded the XML to the BDO
// portal. We load + save (not query-update) and write an audit record.
const markReportSubmitted = async (reportId, actor) => {
  const report = await getReportById(reportId, actor.tenantId);
  const oldStatus = report.status;
  report.status = 'SUBMITTED';
  await report.save();

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'REPORT_SUBMITTED',
    resource: 'AnnualReport',
    resourceId: report._id.toString(),
    oldValue: { status: oldStatus },
    newValue: { status: 'SUBMITTED' },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return report;
};

module.exports = {
  generateAnnualReport,
  listReports,
  getReportById,
  getReportDownloadUrl,
  markReportSubmitted,
};
