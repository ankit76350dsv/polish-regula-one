const mongoose = require('mongoose');
const Company = require('../models/Company');
const { logAudit } = require('../middleware/auditLogger');
const { normaliseBdoNumber } = require('../utils/bdoValidators');

// All company data is scoped to the tenant taken from the session (actor.tenantId).
// The client never chooses the tenant, so one customer can never see or change
// another customer's companies.

// Returns every (non-deleted) company for the tenant, newest first.
const listCompanies = async (tenantId) => {
  return Company.find({ tenantId, deletedAt: null }).sort({ createdAt: -1 });
};

// Returns one company, but only if it belongs to the caller's tenant.
// Throwing a 404 (not 403) avoids revealing that the id exists for someone else.
const getCompanyById = async (companyId, tenantId) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw { status: 400, message: 'Valid company id is required' };
  }

  const company = await Company.findOne({ _id: companyId, tenantId, deletedAt: null });
  if (!company) throw { status: 404, message: 'Company not found' };
  return company;
};

// Creates a new company for the tenant and writes a CREATE audit record.
const createCompany = async (data, actor) => {
  const company = await Company.create({
    ...data,
    bdoRegistrationNumber: normaliseBdoNumber(data.bdoRegistrationNumber),
    tenantId: actor.tenantId,
    createdBy: actor.userId,
    updatedBy: actor.userId,
  });

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'COMPANY_CREATED',
    resource: 'Company',
    resourceId: company._id.toString(),
    oldValue: null,
    newValue: company.toObject(),
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return company;
};

// Updates a company. We load it first (scoped to the tenant), capture the old
// values for the audit diff, apply the changes, then log the before/after.
const updateCompany = async (companyId, data, actor) => {
  const company = await getCompanyById(companyId, actor.tenantId);

  // Snapshot the fields that can change, so the audit log shows what was before.
  const oldValue = company.toObject();

  // Whitelist the fields a client may change — never let them overwrite tenantId,
  // createdBy, timestamps, or the soft-delete marker through the body.
  const updatable = [
    'name',
    'bdoRegistrationNumber',
    'nip',
    'regon',
    'address',
    'contactEmail',
    'contactPhone',
    'isActive',
  ];
  for (const field of updatable) {
    if (data[field] !== undefined) {
      company[field] =
        field === 'bdoRegistrationNumber'
          ? normaliseBdoNumber(data[field])
          : data[field];
    }
  }
  company.updatedBy = actor.userId;
  await company.save();

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'COMPANY_UPDATED',
    resource: 'Company',
    resourceId: company._id.toString(),
    oldValue,
    newValue: company.toObject(),
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return company;
};

module.exports = {
  listCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
};
