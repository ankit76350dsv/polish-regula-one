// const EmployeeProfile = require('../models/Employee');
const { logAudit } = require('../middleware/auditLogger');
const SafeWorkEmployee = require('../models/employee');
const mongoose = require('mongoose');


const getEmployeesByTenant = async (tenantId) => {
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    throw {
      status: 400,
      message: 'Valid tenantId is required',
    };
  }

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

  const employees = await SafeWorkEmployee.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: {
        'user.tenant.$id': tenantObjectId,
      },
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        employeeId: 1,
        dateOfBirth: 1,
        Name: 1,
        name: 1,
        email: 1,
        phone: 1,
        pesel: 1,
        department: 1,
        position: 1,
        site: 1,
        contractType: 1,
        startDate: 1,
        medicalCertificate: 1,
        bhpTraining: 1,
        complianceStatus: 1,
        isBlocked: 1,
        blockReason: 1,
        riskLevel: 1,
        isActive: 1,
        createdBy: 1,
        updatedBy: 1,
        createdAt: 1,
        updatedAt: 1,

        user: {
          _id: '$user._id',
          cognitoSub: '$user.cognitoSub',
          name: '$user.name',
          email: '$user.email',
          role: '$user.role',
          enabled: '$user.enabled',
          tenant: '$user.tenant',
          moduleIds: '$user.moduleIds',
          createdAt: '$user.createdAt',
          updatedAt: '$user.updatedAt',
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  return employees;
};

// Upserts the compliance profile for a given RegulaOne user.
//
// "Add employee" in the UI is treated as creating/updating the compliance
// record — it never modifies the identity data stored in RegulaOne.
// If a profile already exists for employeeId, it is updated; otherwise created.
const upsertEmployeeProfile = async (employeeId, data, actor) => {
  // Fields the caller is not allowed to push through (identity lives in RegulaOne)
  const { email, firstName, lastName, role, ...complianceData } = data;

  const existing = await SafeWorkEmployee.findOne({
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
    profile = await SafeWorkEmployee.create({
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
  const profile = await SafeWorkEmployee.findOne({ employeeId, tenantId });
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
