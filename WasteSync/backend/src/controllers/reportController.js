const reportService = require('../services/reportService');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { logAudit } = require('../middleware/auditLogger');

const buildActor = (req) => ({
  tenantId: req.tenantId,
  userId: req.user._id.toString(),
  userEmail: req.user.email,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

// POST /api/reports/generate — build XML + PDF, store in S3, save the report.
const generateReport = async (req, res, next) => {
  try {
    const { companyId, year } = req.body;
    const report = await reportService.generateAnnualReport({ companyId, year }, buildActor(req));
    return sendSuccess(res, report, 'Annual report generated', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/reports?companyId=&year= — list generated reports.
const listReports = async (req, res, next) => {
  try {
    const { companyId, year } = req.query;
    const reports = await reportService.listReports(req.tenantId, { companyId, year });
    return sendSuccess(res, { count: reports.length, reports }, 'Reports fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/reports/:id — one report's stored summary.
const getReport = async (req, res, next) => {
  try {
    const report = await reportService.getReportById(req.params.id, req.tenantId);
    return sendSuccess(res, report, 'Report retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/reports/:id/download?format=xml|pdf — short-lived presigned URL.
const downloadReport = async (req, res, next) => {
  try {
    const { format } = req.query;
    const result = await reportService.getReportDownloadUrl(req.params.id, format, buildActor(req));
    return sendSuccess(res, result, 'Download URL generated');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// PATCH /api/reports/:id/submit — mark a report as submitted to BDO.
const submitReport = async (req, res, next) => {
  try {
    const report = await reportService.markReportSubmitted(req.params.id, buildActor(req));
    return sendSuccess(res, report, 'Report marked as submitted');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = {
  generateReport,
  listReports,
  getReport,
  downloadReport,
  submitReport,
};
