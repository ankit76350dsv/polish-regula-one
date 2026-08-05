const companyProfileService = require('../services/companyProfileService');
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

// GET /api/companies/profile
//
// The Company page. Reads the company live from RegulaOne and merges in the one
// value WasteSync owns: the 9-digit BDO registration number.
//
// There is no "create company" or "edit company" endpoint. The company is
// registered once in RegulaOne when the customer signs up, so WasteSync only
// reads it — a second copy typed in here could disagree with the legal record,
// and those details are printed on reports filed with a government register.
const getCompanyProfile = async (req, res, next) => {
  try {
    const company = await companyProfileService.getCompanyProfile(req, req.tenantId);

    // Fire-and-forget VIEW audit — reads must not block on the audit write.
    logAudit({
      ...buildActor(req),
      action: 'COMPANY_PROFILE_VIEWED',
      resource: 'Company',
      resourceId: req.tenantId,
    });

    return sendSuccess(
      res,
      {
        company,
        // Tells the page whether it must still ask for the BDO number before
        // reports can be generated.
        bdoRegistrationMissing: !company.bdoRegistrationNumber,
      },
      'Company profile loaded'
    );
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// PUT /api/companies/profile/bdo
// Sets or corrects the 9-digit BDO registration number — the only company field
// WasteSync owns. Everything else comes from RegulaOne and is read-only here.
const updateBdoRegistration = async (req, res, next) => {
  try {
    const settings = await companyProfileService.saveBdoRegistrationNumber(
      req.body.bdoRegistrationNumber,
      buildActor(req)
    );

    // Return the whole profile, not just the settings row, so the page can
    // re-render from one answer without a second round-trip.
    const company = await companyProfileService.getCompanyProfile(req, req.tenantId);

    return sendSuccess(
      res,
      { company, bdoRegistrationMissing: !settings.bdoRegistrationNumber },
      'BDO registration number saved'
    );
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = {
  getCompanyProfile,
  updateBdoRegistration,
};
