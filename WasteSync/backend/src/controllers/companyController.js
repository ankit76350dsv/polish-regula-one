const companyService = require('../services/companyService');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { logAudit } = require('../middleware/auditLogger');

// The tenant id is resolved once by the auth middleware (req.tenantId).
// Controllers ALWAYS use req.tenantId and never accept a tenant id from the
// client (query/body/params). This is what keeps tenants isolated.

// Builds the "actor" object every service call needs for audit logging.
const buildActor = (req) => ({
  tenantId: req.tenantId,
  userId: req.user._id.toString(),
  userEmail: req.user.email,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

const listCompanies = async (req, res, next) => {
  try {
    const companies = await companyService.listCompanies(req.tenantId);
    return sendSuccess(res, { count: companies.length, companies }, 'Companies fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const getCompany = async (req, res, next) => {
  try {
    const company = await companyService.getCompanyById(req.params.id, req.tenantId);

    // Fire-and-forget VIEW audit — reads must not block on the audit write.
    logAudit({
      ...buildActor(req),
      action: 'COMPANY_VIEWED',
      resource: 'Company',
      resourceId: req.params.id,
    });

    return sendSuccess(res, company, 'Company retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const createCompany = async (req, res, next) => {
  try {
    // Strip any tenantId the client may have sent — we always use the session's.
    const { tenantId: _ignored, ...data } = req.body;
    const company = await companyService.createCompany(data, buildActor(req));
    return sendSuccess(res, company, 'Company created', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const { tenantId: _ignored, ...data } = req.body;
    const company = await companyService.updateCompany(req.params.id, data, buildActor(req));
    return sendSuccess(res, company, 'Company updated');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
};
