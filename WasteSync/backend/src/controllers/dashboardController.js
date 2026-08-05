const dashboardService = require('../services/dashboardService');
const companyProfileService = require('../services/companyProfileService');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { CAPABILITIES, hasCapability } = require('../config/permissions');

// GET /api/dashboard/overview?year=
// Returns all dashboard data in one payload. Tenant comes from the session.
//
// companyId is no longer accepted. The tenant owns exactly one company, so there
// was never more than one thing to scope to.
const getOverview = async (req, res, next) => {
  try {
    const { year } = req.query;

    // The dashboard's "recent activity" panel is the audit trail. Only send it to
    // someone who is allowed to read the audit trail (admins and auditors, not HR),
    // otherwise the dashboard would become a back door to data the Audit Logs page
    // deliberately keeps from them. req.capabilities is worked out once per request
    // by the auth middleware from the permissions RegulaOne returned.
    const includeAuditActivity = hasCapability(req.capabilities, CAPABILITIES.AUDIT_READ);

    // Read the company name / BDO number live from RegulaOne so the page shows the
    // current details. If RegulaOne is unreachable we do NOT fail the dashboard:
    // the waste figures come from our own database and are still correct, so we
    // pass null and the page shows the numbers without the company name.
    let company = null;
    try {
      company = await companyProfileService.getCompanyProfile(req, req.tenantId);
    } catch (profileError) {
      company = null;
    }

    const data = await dashboardService.getOverview(req.tenantId, {
      year,
      company,
      includeAuditActivity,
    });
    return sendSuccess(res, data, 'Dashboard overview fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getOverview };
