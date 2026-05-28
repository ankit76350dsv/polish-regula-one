const EmployeeProfile = require('../models/Employee');
const { logAudit } = require('../middleware/auditLogger');

// Base URL of the RegulaOne auth/user service.
// EmployeeProfile stores only compliance data; identity data lives in RegulaOne.
const REGULA_ONE_BASE_URL = process.env.REGULA_ONE_API_URL || 'http://localhost:8080';

// Calls the RegulaOne user API to retrieve all users for a tenant.
// The caller's JWT is forwarded so the RegulaOne service can authorise the request.
const fetchUsersFromRegulaOne = async (tenantId, authToken) => {
  const res = await fetch(`${REGULA_ONE_BASE_URL}/api/admin/users/${tenantId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw {
      status: res.status,
      message: `RegulaOne API error (${res.status}): ${text}`,
    };
  }

  const json = await res.json();
  // RegulaOne wraps responses in { success, data } — unwrap if present
  return Array.isArray(json) ? json : json.data ?? [];
};

// Returns all users for a tenant merged with their EmployeeProfile compliance data.
//
// Merge logic:
//   - For every user returned by RegulaOne, find the matching EmployeeProfile
//     where employeeId === user._id (or user.id).
//   - Users with no profile are returned with profileMissing: true so the
//     frontend can prompt the HR manager to complete their compliance setup.
//   - Users who already have a profile get the full profile embedded.
const getEmployeesByTenant = async (tenantId, authToken) => {
  // Run both fetches in parallel for performance
  const [users, profiles] = await Promise.all([
    fetchUsersFromRegulaOne(tenantId, authToken),
    EmployeeProfile.find({ tenantId, isActive: true }).lean(),
  ]);

  // Build a lookup map: employeeId → profile document
  const profileByEmployeeId = {};
  for (const profile of profiles) {
    profileByEmployeeId[profile.employeeId] = profile;
  }

  // Merge each user with their profile (or mark as missing)
  const merged = users.map((user) => {
    const userId = user._id ?? user.id;
    const profile = profileByEmployeeId[userId] ?? null;
    return {
      // Identity fields from RegulaOne (source of truth — not duplicated in profile)
      _id: userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,

      // Compliance profile — null when HR has not set it up yet
      profile,
      profileMissing: profile === null,
    };
  });

  return merged;
};

// Upserts the compliance profile for a given RegulaOne user.
//
// "Add employee" in the UI is treated as creating/updating the compliance
// record — it never modifies the identity data stored in RegulaOne.
// If a profile already exists for employeeId, it is updated; otherwise created.
const upsertEmployeeProfile = async (employeeId, data, actor) => {
  // Fields the caller is not allowed to push through (identity lives in RegulaOne)
  const { email, firstName, lastName, role, ...complianceData } = data;

  const existing = await EmployeeProfile.findOne({
    employeeId,
    tenantId: actor.tenantId,
  });

  let profile;
  let isNew = false;

  if (existing) {
    // UPDATE path — record the old compliance state for the audit diff
    const oldValue = {
      complianceStatus: existing.complianceStatus,
      isBlocked: existing.isBlocked,
      medicalCertificate: existing.medicalCertificate,
      bhpTraining: existing.bhpTraining,
    };

    Object.assign(existing, complianceData);
    existing.updatedBy = actor.userId;
    profile = await existing.save();

    await logAudit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      userEmail: actor.userEmail,
      action: 'EMPLOYEE_PROFILE_UPDATED',
      resource: 'EmployeeProfile',
      resourceId: profile._id.toString(),
      oldValue,
      newValue: complianceData,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  } else {
    // CREATE path — first time this user gets a compliance profile
    profile = await EmployeeProfile.create({
      ...complianceData,
      employeeId,
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    isNew = true;

    await logAudit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      userEmail: actor.userEmail,
      action: 'EMPLOYEE_PROFILE_CREATED',
      resource: 'EmployeeProfile',
      resourceId: profile._id.toString(),
      oldValue: null,
      newValue: complianceData,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }

  return { profile, isNew };
};

// Updates only compliance status fields (medical cert, BHP, blocking).
// Kept separate from upsert so compliance officers can update status
// without having access to the full profile form.
const updateEmployeeCompliance = async (employeeId, tenantId, updates, actor) => {
  const profile = await EmployeeProfile.findOne({ employeeId, tenantId });
  if (!profile) throw { status: 404, message: 'Employee profile not found' };

  const oldValue = {
    complianceStatus: profile.complianceStatus,
    isBlocked: profile.isBlocked,
    medicalCertificate: profile.medicalCertificate,
    bhpTraining: profile.bhpTraining,
  };

  Object.assign(profile, updates);
  profile.updatedBy = actor.userId;
  await profile.save();

  await logAudit({
    tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'COMPLIANCE_UPDATED',
    resource: 'EmployeeProfile',
    resourceId: profile._id.toString(),
    oldValue,
    newValue: updates,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return profile;
};

module.exports = {
  getEmployeesByTenant,
  upsertEmployeeProfile,
  updateEmployeeCompliance,
};
