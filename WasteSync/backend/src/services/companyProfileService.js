const CompanySettings = require('../models/CompanySettings');
const { fetchTenantProfile } = require('./regulaOneClient');
const { logAudit } = require('../middleware/auditLogger');
const { normaliseBdoNumber, isValidBdoNumber } = require('../utils/bdoValidators');

// ── The company profile: RegulaOne + one local number ────────────────────────
//
// WHY THIS REPLACED companyService.js
// The old service managed a local Company collection — create, update, list,
// look up by id. All of that existed to hold data RegulaOne already owns. With
// one company per tenant, the tenant id IS the company id, so the collection and
// its foreign keys were pure duplication.
//
// What is left is genuinely small:
//   - read the company live from RegulaOne  (getCompanyProfile)
//   - read / write the 9-digit BDO number   (the only field we own)
//
// Nothing about the company is cached. That is deliberate: a cache is what let
// the two copies drift apart in the first place. The trade-off is that reports
// cannot be generated while RegulaOne is unreachable — which is correct, because
// a report must carry the company's CURRENT legal identity, not a stale guess.

// Turns the RegulaOne tenant payload plus our BDO number into the single
// "company" object the rest of the module uses (report XML, report PDF, screens).
//
// RegulaOne keeps the address flat (address / city / postalCode) while the report
// generators expect it nested, so we translate here — in ONE place.
const buildCompanyProfile = (tenant, bdoRegistrationNumber = null) => ({
  // Identity — owned by RegulaOne, read-only everywhere in WasteSync.
  name: (tenant.name || '').trim(),
  nip: (tenant.nip || '').trim(),
  regon: (tenant.regon || '').trim(),
  contactEmail: (tenant.email || '').trim().toLowerCase(),
  contactPhone: (tenant.phone || '').trim(),
  address: {
    street: (tenant.address || '').trim(),
    city: (tenant.city || '').trim(),
    postalCode: (tenant.postalCode || '').trim(),
    // RegulaOne has no country field. Every tenant here files with the Polish
    // BDO register, so Poland is the correct default and keeps the XML valid.
    country: 'Poland',
  },
  // A suspended or closed tenant must not look active in a compliance report.
  isActive: String(tenant.status || '').toUpperCase() === 'ACTIVE',

  // When this company was registered in RegulaOne. Used to avoid claiming a
  // filing deadline was missed for a year before the customer even joined the
  // platform — see utils/bdoDeadlines.js.
  registeredAt: tenant.createdAt || null,

  // Owned by WasteSync. null until an admin sets it.
  bdoRegistrationNumber: bdoRegistrationNumber || null,
});

// Reads the saved BDO number for a tenant, or null if it was never set.
const getBdoRegistrationNumber = async (tenantId) => {
  const settings = await CompanySettings.findOne({ tenantId });
  return settings ? settings.bdoRegistrationNumber : null;
};

/**
 * Loads the full company profile for the caller.
 *
 * Asks RegulaOne who this tenant is (forwarding the caller's own credentials, so
 * one customer can never read another's details) and merges in our BDO number.
 *
 * @param {object} req      the Express request — used only to forward credentials
 * @param {string} tenantId resolved by the auth middleware, never from the client
 * @throws {{status:503}}   when RegulaOne cannot be reached
 * @throws {{status:502}}   when RegulaOne answers with something unusable
 */
const getCompanyProfile = async (req, tenantId) => {
  const tenant = await fetchTenantProfile(req, req.authToken);

  if (!tenant) {
    throw {
      status: 503,
      message:
        'Your company details could not be read from RegulaOne right now. Please try again shortly.',
    };
  }

  // A nameless company would poison every report generated from it, so we refuse
  // rather than carry on with empty values.
  if (!tenant.name) {
    throw {
      status: 502,
      message: 'RegulaOne returned incomplete company details. Please contact support.',
    };
  }

  const bdoRegistrationNumber = await getBdoRegistrationNumber(tenantId);
  return buildCompanyProfile(tenant, bdoRegistrationNumber);
};

/**
 * Sets or corrects the 9-digit BDO registration number.
 *
 * This is the ONLY company value WasteSync may change. It is printed on every
 * report the authority receives, so it is validated here (never trusting the
 * browser) and always written to the immutable audit trail with before/after.
 */
const saveBdoRegistrationNumber = async (bdoRegistrationNumber, actor) => {
  const cleaned = normaliseBdoNumber(bdoRegistrationNumber);

  // Re-check server-side even though the route validator already did. A second
  // check costs nothing and means this function is safe to call from anywhere.
  if (!isValidBdoNumber(cleaned)) {
    throw { status: 400, message: 'BDO registration number must be exactly 9 digits' };
  }

  const existing = await CompanySettings.findOne({ tenantId: actor.tenantId });

  // Nothing to do — return early so we do not write a misleading audit entry
  // saying the number "changed" from 123456789 to 123456789.
  if (existing && existing.bdoRegistrationNumber === cleaned) return existing;

  const oldValue = existing ? existing.toObject() : null;

  const settings = existing || new CompanySettings({
    tenantId: actor.tenantId,
    createdBy: actor.userId,
  });
  settings.bdoRegistrationNumber = cleaned;
  settings.updatedBy = actor.userId;
  await settings.save();

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    // A first entry is SET; a change is UPDATED, so the audit trail makes the
    // difference obvious to whoever reviews it later.
    action: existing ? 'COMPANY_BDO_NUMBER_UPDATED' : 'COMPANY_BDO_NUMBER_SET',
    resource: 'CompanySettings',
    resourceId: settings._id.toString(),
    oldValue,
    newValue: settings.toObject(),
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return settings;
};

module.exports = {
  buildCompanyProfile,
  getBdoRegistrationNumber,
  getCompanyProfile,
  saveBdoRegistrationNumber,
};
