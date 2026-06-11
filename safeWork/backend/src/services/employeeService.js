// const EmployeeProfile = require('../models/Employee');
const { logAudit } = require('../middleware/auditLogger');
const SafeWorkEmployee = require('../models/employee');
const mongoose = require('mongoose');


// OLD signature: getEmployeesByTenant(tenantId)
// NEW signature: getEmployeesByTenant(tenantId, filters)
// Added filters param to support backend search/filter instead of doing it on the frontend.
// Also now returns { employees, summary } so the UI can show tenant-wide totals even
// when filters narrow the employee list.
const getEmployeesByTenant = async (tenantId, filters = {}) => {
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    throw {
      status: 400,
      message: 'Valid tenantId is required',
    };
  }

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const { search, department, site, complianceStatus, page = 1, limit = 10 } = filters;

  // Clamp pagination values — page minimum 1, limit between 1 and 100.
  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip     = (pageNum - 1) * limitNum;

  // Pre-computed date window for the expiring-soon aggregation below.
  // Using live dates instead of the stored complianceStatus field so that a
  // document uploaded months ago with status 'VALID' is still counted as
  // expiring when its expiry date is now within 30 days.
  const now             = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Reusable lookup + unwind + tenant match stages — shared between
  // the filtered query and the summary aggregation below.
  const basePipeline = [
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
  ];

  // Build the filter $match stage from query params.
  // Only includes conditions when the param is actually provided.
  const filterConditions = {};

  if (department) {
    filterConditions.department = department;
  }

  if (site) {
    filterConditions.site = site;
  }

  // complianceStatus from the frontend uses lowercase keys ("compliant", "expiring",
  // "warning", "blocked") — map them to the backend enum values.
  if (complianceStatus) {
    const statusMap = {
      compliant: { complianceStatus: 'COMPLIANT' },
      expiring:  { complianceStatus: 'EXPIRING'  },
      // NON_COMPLIANT is labelled "warning" in the UI
      warning:   { complianceStatus: 'NON_COMPLIANT' },
      // "blocked" is a separate boolean, not a complianceStatus value
      blocked:   { isBlocked: true },
    };
    if (statusMap[complianceStatus]) {
      Object.assign(filterConditions, statusMap[complianceStatus]);
    }
  }

  // Build the full pipeline for the filtered employee list.
  const pipeline = [...basePipeline];

  // Apply department / site / complianceStatus filters if any were provided.
  if (Object.keys(filterConditions).length > 0) {
    pipeline.push({ $match: filterConditions });
  }

  // Apply text search after the lookup so we can match on user.name and user.email.
  // Uses case-insensitive regex across name, email, position, department, and site.
  if (search) {
    const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    pipeline.push({
      $match: {
        $or: [
          { 'user.name':  searchRegex },
          { 'user.email': searchRegex },
          { position:     searchRegex },
          { department:   searchRegex },
          { site:         searchRegex },
        ],
      },
    });
  }

  // Use $facet to do everything in a single MongoDB round-trip:
  //   employees   — projected + sorted + paginated current page
  //   totalCount  — total number of filtered documents (drives pagination metadata)
  //   summary     — compliance counts for ALL filtered documents so the dashboard
  //                 cards always reflect the full filtered set, not just one page
  //
  // OLD: separate $project/$sort push + two independent aggregate() calls.
  // Replaced because once pagination was added, safeList only contained one page
  // so client-side count computation from the list was wrong.
  const projectStage = {
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
      requiresMedicalCertificate: 1,
      requiresBHPTraining: 1,
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
  };

  pipeline.push({
    $facet: {
      employees: [
        projectStage,
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
      ],
      totalCount: [
        { $count: 'count' },
      ],
      summary: [
        {
          $group: {
            _id: null,
            total:     { $sum: 1 },
            compliant: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'COMPLIANT'] }, 1, 0] } },
            // OLD: { $eq: ['$complianceStatus', 'EXPIRING'] }
            // NEW: live date comparison — same fix as dashboardService expiringSoon.
            // The stored complianceStatus / document status fields are written once at
            // upload time and never refreshed, so they go stale as time passes.
            // Comparing the actual expiryDate against today and thirtyDaysFromNow
            // always returns the correct count regardless of when the doc was uploaded.
            expiring: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      {
                        $and: [
                          { $gt:  ['$medicalCertificate.expiryDate', now] },
                          { $lte: ['$medicalCertificate.expiryDate', thirtyDaysFromNow] },
                        ],
                      },
                      {
                        $and: [
                          { $gt:  ['$bhpTraining.expiryDate', now] },
                          { $lte: ['$bhpTraining.expiryDate', thirtyDaysFromNow] },
                        ],
                      },
                    ],
                  },
                  1, 0,
                ],
              },
            },
            blocked:   { $sum: { $cond: ['$isBlocked', 1, 0] } },
          },
        },
      ],
    },
  });

  const [facetResult] = await SafeWorkEmployee.aggregate(pipeline);

  const employees   = facetResult?.employees  ?? [];
  const total       = facetResult?.totalCount?.[0]?.count ?? 0;
  const totalPages  = Math.ceil(total / limitNum) || 1;
  const summaryData = facetResult?.summary?.[0];

  const summary = summaryData
    ? {
        total:     summaryData.total,
        compliant: summaryData.compliant,
        expiring:  summaryData.expiring,
        blocked:   summaryData.blocked,
      }
    : { total: 0, compliant: 0, expiring: 0, blocked: 0 };

  return {
    employees,
    pagination: { total, page: pageNum, limit: limitNum, totalPages },
    summary,
  };
};

// Fetches a single SafeWork employee record by its SafeWork_Employee _id.
// Used by the employee detail/profile page after clicking a row in EmployeeList.
const getEmployeeById = async (profileId) => {
  if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
    throw { status: 400, message: 'Valid profile ID is required' };
  }

  const result = await SafeWorkEmployee.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(profileId) } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        userId: 1,
        employeeId: 1,
        dateOfBirth: 1,
        name: 1,
        email: 1,
        phone: 1,
        pesel: 1,
        department: 1,
        position: 1,
        site: 1,
        contractType: 1,
        startDate: 1,
        requiresMedicalCertificate: 1,
        requiresBHPTraining: 1,
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
  ]);

  if (!result.length) throw { status: 404, message: 'Employee not found' };
  return result[0];
};

// Derives a document status from an expiry date using the 30-day rule.
// Added so status is never manually entered — it is always derived from the date.
// Rules: no date → MISSING; past → EXPIRED; ≤30 days → EXPIRING; else → VALID.
const calculateDocumentStatus = (expiryDate) => {
  if (!expiryDate) return 'MISSING';
  const daysRemaining = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0)  return 'EXPIRED';
  if (daysRemaining <= 30) return 'EXPIRING';
  return 'VALID';
};

// Recalculates isBlocked, blockReason, and complianceStatus after any document change.
// Added so check-in eligibility is always consistent with the stored document state
// without requiring a separate manual compliance update call.
// Block rule: any required document that is EXPIRED or MISSING blocks check-in.
const recalculateComplianceState = (profile) => {
  const BLOCKING = ['EXPIRED', 'MISSING'];

  const medStatus = profile.requiresMedicalCertificate
    ? (profile.medicalCertificate?.status || 'MISSING')
    : null;

  const bhpStatus = profile.requiresBHPTraining
    ? (profile.bhpTraining?.status || 'MISSING')
    : null;

  const reasons = [];
  if (medStatus && BLOCKING.includes(medStatus))
    reasons.push(`Medical certificate is ${medStatus.toLowerCase()}`);
  if (bhpStatus && BLOCKING.includes(bhpStatus))
    reasons.push(`BHP training certificate is ${bhpStatus.toLowerCase()}`);

  profile.isBlocked    = reasons.length > 0;
  profile.blockReason  = reasons.length > 0 ? reasons.join('; ') : undefined;

  const requiredStatuses = [medStatus, bhpStatus].filter(Boolean);
  if (requiredStatuses.some(s => BLOCKING.includes(s))) {
    profile.complianceStatus = 'NON_COMPLIANT';
  } else if (requiredStatuses.some(s => s === 'EXPIRING')) {
    profile.complianceStatus = 'EXPIRING';
  } else {
    profile.complianceStatus = 'COMPLIANT';
  }
};

// Updates a document reference (S3 key + metadata) after the frontend uploads to S3.
// docType is 'medical' or 'bhp'.
const updateDocumentReference = async (profileId, docType, docData, actor) => {
  if (!mongoose.Types.ObjectId.isValid(profileId)) {
    throw { status: 400, message: 'Valid profile ID is required' };
  }

  const profile = await SafeWorkEmployee.findById(profileId);
  if (!profile) throw { status: 404, message: 'Employee profile not found' };

  const oldValue = {
    medicalCertificate: profile.medicalCertificate,
    bhpTraining: profile.bhpTraining,
  };

  if (docType === 'medical') {
    const resolvedExpiry = docData.expiryDate || profile.medicalCertificate?.expiryDate;
    profile.medicalCertificate = {
      ...profile.medicalCertificate,
      documentPath: docData.s3Key,
      expiryDate:   resolvedExpiry,
      // OLD: status: docData.status || 'VALID'
      // NEW: auto-calculated — the client no longer sends a status field
      status: calculateDocumentStatus(resolvedExpiry),
    };
  } else if (docType === 'bhp') {
    const resolvedExpiry = docData.expiryDate || profile.bhpTraining?.expiryDate;
    profile.bhpTraining = {
      ...profile.bhpTraining,
      documentPath:  docData.s3Key,
      expiryDate:    resolvedExpiry,
      completedDate: docData.completedDate || profile.bhpTraining?.completedDate,
      // OLD: status: docData.status || 'VALID'
      // NEW: auto-calculated — the client no longer sends a status field
      status: calculateDocumentStatus(resolvedExpiry),
    };
  } else {
    throw { status: 400, message: 'docType must be medical or bhp' };
  }

  // Re-derive isBlocked, blockReason, and complianceStatus from the updated doc statuses.
  recalculateComplianceState(profile);
  profile.updatedBy = actor.userId;
  await profile.save();

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'DOCUMENT_UPLOADED',
    resource: 'EmployeeProfile',
    resourceId: profile._id.toString(),
    oldValue,
    newValue: { docType, ...docData },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return profile;
};

// Upserts the compliance profile for a given RegulaOne user.
//
// "Add employee" in the UI is treated as creating/updating the compliance
// record — it never modifies the identity data stored in RegulaOne.
// If a profile already exists for employeeId, it is updated; otherwise created.
const upsertEmployeeProfile = async (employeeId, data, actor) => {
  // Strip identity fields — these are owned by RegulaOne, not SafeWork
  const { email, firstName, lastName, role, ...complianceData } = data;

  // OLD: findOne({ employeeId })
  // This was too narrow — early "Add Employee" calls created stub documents with
  // only userId set (no employeeId), so the lookup never matched them and every
  // subsequent edit fell into the CREATE path, producing duplicate records.
  //
  // NEW: dual-field lookup — try employeeId first (fast, indexed), and also
  // match on userId so orphaned stubs (missing employeeId) are found and updated
  // rather than duplicated.
  const userObjectId = mongoose.Types.ObjectId.isValid(employeeId)
    ? new mongoose.Types.ObjectId(employeeId)
    : null;

  const existing = await SafeWorkEmployee.findOne(
    userObjectId
      ? { $or: [{ employeeId }, { userId: userObjectId }] }
      : { employeeId }
  );

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
    // Backfill employeeId if this record was an orphaned stub (created without it).
    // This heals the document on the first successful edit so future lookups work.
    if (!existing.employeeId) {
      existing.employeeId = employeeId;
    }
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
    // CREATE path — first time this user gets a compliance profile.
    // employeeId is the RegulaOne user ObjectId (as string), so we cast it
    // to ObjectId for the userId ref field.
    profile = await SafeWorkEmployee.create({
      ...complianceData,
      employeeId,
      userId: mongoose.Types.ObjectId.isValid(employeeId)
        ? new mongoose.Types.ObjectId(employeeId)
        : undefined,
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
  getEmployeeById,
  updateDocumentReference,
  upsertEmployeeProfile,
  updateEmployeeCompliance,
};
