const SafeWorkEmployee = require('../models/Employee');
const AuditLog         = require('../models/AuditLog');
const mongoose         = require('mongoose');

// Derives document status from expiry date — mirrors employeeService rule.
// Kept local so the dashboard can label documents without a second round-trip.
const calcDocStatus = (expiryDate) => {
  if (!expiryDate) return 'MISSING';
  const days = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
  if (days < 0)   return 'EXPIRED';
  if (days <= 30) return 'EXPIRING';
  return 'VALID';
};

// Human-readable action labels for the audit timeline.
// resourceName: the name of the employee whose record was affected (e.g. "Jan Kowalski").
// Including it in the description answers "who did the action" (userEmail) AND
// "whose record was changed" (resourceName) in one readable line.
const actionLabel = (action, newValue, resourceName) => {
  const subject = resourceName ? `${resourceName}'s` : 'Employee';
  switch (action) {
    case 'EMPLOYEE_PROFILE_CREATED': return `${subject} compliance profile created`;
    case 'EMPLOYEE_PROFILE_UPDATED': return `${subject} compliance profile updated`;
    case 'DOCUMENT_UPLOADED':
      return newValue?.docType === 'medical'
        ? `${subject} medical certificate uploaded`
        : `${subject} BHP training certificate uploaded`;
    case 'COMPLIANCE_UPDATED': return `${subject} compliance status updated`;
    default: return `${subject}: ${action.replace(/_/g, ' ')}`;
  }
};

// Single-endpoint dashboard overview.
//
// Tenant isolation: SafeWork employees do NOT store tenantId directly.
// They link to a User document (via userId) which holds user.tenant (ObjectId).
// All queries join through the users collection and filter on user.tenant.
//
// One $facet aggregation handles all employee-based counts and lists in a
// single MongoDB round-trip; audit log data is fetched in a parallel Promise.all.
const getDashboardOverview = async (tenantId) => {
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    throw { status: 400, message: 'Valid tenantId is required' };
  }

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const now = new Date();
  // Pre-computed for the expiringSoon aggregation below.
  // Passed as a JS Date so MongoDB treats it as a date literal in the pipeline.
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // ── Employee aggregation ───────────────────────────────────────────────────
  // Shared pipeline prefix: join users → unwind → filter by tenant + active.
  const [facetResult] = await SafeWorkEmployee.aggregate([
    {
      $lookup: {
        from:         'users',
        localField:   'userId',
        foreignField: '_id',
        as:           'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    // OLD: { 'user.tenant': tenantObjectId }
    // NEW: { 'user.tenant.$id': tenantObjectId }
    // Reason: the Java RegulaOne backend stores tenant as a MongoDB DBRef
    // ({ "$ref": "...", "$id": ObjectId(...) }), so the filter must target the
    // nested $id field — exactly how getEmployeesByTenant in employeeService.js does it.
    // isActive: { $ne: false } catches employees where the field was never explicitly set
    // (MongoDB default behaviour: missing field ≠ true for equality filter).
    {
      $match: {
        'user.tenant.$id': tenantObjectId,
        isActive: { $ne: false },
      },
    },

    {
      $facet: {

        // ── Metric counters ────────────────────────────────────────────────
        stats: [
          {
            $group: {
              _id: null,

              // Total active employees in this tenant
              total: { $sum: 1 },

              // complianceStatus === COMPLIANT (both required docs valid)
              compliant: {
                $sum: { $cond: [{ $eq: ['$complianceStatus', 'COMPLIANT'] }, 1, 0] },
              },

              // Count employees whose medical OR BHP document expires within the next 30 days.
              //
              // OLD (first attempt): { $eq: ['$complianceStatus', 'EXPIRING'] }
              //   → only counts employees where the stored complianceStatus field is 'EXPIRING'.
              //   Missed cases because complianceStatus is only updated on document upload.
              //
              // OLD (second attempt): check medicalCertificate.status / bhpTraining.status fields.
              //   → same problem: those status fields are written once at upload time and
              //     never updated, so a document uploaded 6 months ago with a far-future
              //     expiry is still stored as 'VALID' even when the date is now < 30 days away.
              //
              // NEW: live calculation against the actual expiryDate field.
              //   We compare expiryDate to now and thirtyDaysFromNow (both JS Date literals
              //   pre-computed above).  This is always accurate regardless of when the document
              //   was last uploaded or whether the status field has ever been refreshed.
              expiringSoon: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        // Medical cert: not yet expired but expires within 30 days
                        {
                          $and: [
                            { $gt:  ['$medicalCertificate.expiryDate', now] },
                            { $lte: ['$medicalCertificate.expiryDate', thirtyDaysFromNow] },
                          ],
                        },
                        // BHP training: not yet expired but expires within 30 days
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

              // isBlocked flag (expired / missing mandatory doc)
              blocked: {
                $sum: { $cond: ['$isBlocked', 1, 0] },
              },

              // Required documents (files) not yet uploaded (status MISSING).
              // OLD: counted EMPLOYEES with at least one missing doc — an employee
              //      missing BOTH medical and BHP counted as 1, which mismatched
              //      the "Files required" label on the card.
              // NEW: count each missing required DOCUMENT separately using $add,
              //      so an employee missing both files contributes 2. This matches
              //      the card's meaning ("number of files still required").
              missingDocs: {
                $sum: {
                  $add: [
                    {
                      $cond: [
                        {
                          $and: [
                            { $eq: ['$requiresMedicalCertificate', true] },
                            { $eq: ['$medicalCertificate.status', 'MISSING'] },
                          ],
                        },
                        1, 0,
                      ],
                    },
                    {
                      $cond: [
                        {
                          $and: [
                            { $eq: ['$requiresBHPTraining', true] },
                            { $eq: ['$bhpTraining.status', 'MISSING'] },
                          ],
                        },
                        1, 0,
                      ],
                    },
                  ],
                },
              },

              // Compliance health "warning" bucket (expiring + non-compliant)
              warning: {
                $sum: {
                  $cond: [
                    { $in: ['$complianceStatus', ['EXPIRING', 'NON_COMPLIANT']] },
                    1, 0,
                  ],
                },
              },
            },
          },
        ],

        // ── Compliance table: top-50 employees ────────────────────────────
        employees: [
          { $sort: { createdAt: -1 } },
          { $limit: 50 },
          {
            $project: {
              _id:              1,
              employeeId:       1,
              name:             { $ifNull: ['$user.name', '$name'] },
              department:       1,
              site:             1,
              medicalStatus:    '$medicalCertificate.status',
              bhpStatus:        '$bhpTraining.status',
              // Include the requirement flags so the table can tell apart
              // "required but not uploaded" (Missing) from "not needed" (Not required).
              requiresMedicalCertificate: 1,
              requiresBHPTraining:        1,
              complianceStatus: 1,
              isBlocked:        1,
              blockReason:      1,
            },
          },
        ],

        // ── Employees with at least one concerning document ────────────────
        concerningDocs: [
          {
            // Only flag a document as concerning when the role actually REQUIRES it.
            // Without the requires* guard, a non-required document (whose status
            // defaults to MISSING in the schema) would wrongly appear here.
            $match: {
              $or: [
                {
                  requiresMedicalCertificate: true,
                  'medicalCertificate.status': { $in: ['EXPIRING', 'EXPIRED', 'MISSING'] },
                },
                {
                  requiresBHPTraining: true,
                  'bhpTraining.status': { $in: ['EXPIRING', 'EXPIRED', 'MISSING'] },
                },
              ],
            },
          },
          { $sort: { updatedAt: -1 } },
          { $limit: 20 },
          {
            $project: {
              _id:          1,
              employeeName: { $ifNull: ['$user.name', '$name'] },
              medicalCertificate: 1,
              bhpTraining:        1,
              requiresMedicalCertificate: 1,
              requiresBHPTraining:        1,
            },
          },
        ],

        // ── Recently added employees ───────────────────────────────────────
        recentEmployees: [
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          {
            $project: {
              _id:        1,
              employeeId: 1,
              name:       { $ifNull: ['$user.name', '$name'] },
              email:      { $ifNull: ['$user.email', '$email'] },
              department: 1,
              position:   1,
              createdAt:  1,
            },
          },
        ],
      },
    },
  ]);

  const statsRaw  = facetResult?.stats?.[0] || {};
  const total     = statsRaw.total     || 0;
  const compliant = statsRaw.compliant || 0;
  const warning   = statsRaw.warning   || 0;
  const blocked   = statsRaw.blocked   || 0;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // ── Audit log queries (parallel with aggregation result) ──────────────────
  const DASHBOARD_ACTIONS = [
    'EMPLOYEE_PROFILE_CREATED',
    'EMPLOYEE_PROFILE_UPDATED',
    'DOCUMENT_UPLOADED',
    'COMPLIANCE_UPDATED',
  ];

  const [recentAuditRaw, recentDocRaw] = await Promise.all([
    AuditLog.find({ tenantId, action: { $in: DASHBOARD_ACTIONS } })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean(),
    AuditLog.find({ tenantId, action: 'DOCUMENT_UPLOADED' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // Build a single employee-name map covering every audit log resourceId —
  // both document-upload logs and profile-update logs reference a SafeWork
  // Employee _id as resourceId.  One lookup round-trip serves both.
  // OLD: only looked up IDs from recentDocRaw, so audit-timeline descriptions
  //      could not include the affected employee's name.
  const allResourceIds = [
    ...new Set(
      [...recentAuditRaw, ...recentDocRaw]
        .map((l) => l.resourceId)
        .filter(Boolean)
    ),
  ];
  let empNameMap = new Map();

  if (allResourceIds.length > 0) {
    const validIds = allResourceIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const nameRows = await SafeWorkEmployee.aggregate([
      { $match: { _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
      {
        $lookup: {
          from: 'users', localField: 'userId', foreignField: '_id', as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, name: { $ifNull: ['$user.name', '$name'] } } },
    ]);
    empNameMap = new Map(nameRows.map((e) => [e._id.toString(), e.name || 'Unknown']));
  }

  // ── Transform: compliance table rows ─────────────────────────────────────
  const employees = (facetResult?.employees || []).map((emp) => {
    const s = emp.complianceStatus;
    const overallStatus = emp.isBlocked           ? 'blocked'
                        : s === 'COMPLIANT'        ? 'compliant'
                        : s === 'EXPIRING'         ? 'expiring'
                        :                           'warning';
    return {
      id:           emp._id,
      name:         emp.name || 'Unknown',
      employeeCode: emp.employeeId,
      department:   emp.department || '—',
      site:         emp.site       || '—',
      // A document that is NOT required by the role must not read "Missing".
      // Missing means "required but not uploaded"; not-required is a calm,
      // neutral state. The raw sub-object status is ignored when not required.
      medicalStatus: emp.requiresMedicalCertificate
        ? (emp.medicalStatus || 'MISSING').toLowerCase()
        : 'not_required',
      bhpStatus: emp.requiresBHPTraining
        ? (emp.bhpStatus || 'MISSING').toLowerCase()
        : 'not_required',
      overallStatus,
      clockInStatus: emp.isBlocked ? 'blocked' : 'allowed',
      blockReason:   emp.blockReason,
    };
  });

  // ── Transform: expiring / missing documents (flat rows per doc type) ──────
  const expiringDocuments = [];
  for (const emp of facetResult?.concerningDocs || []) {
    const addRow = (status, expiry, type) => {
      if (!['EXPIRING', 'EXPIRED', 'MISSING'].includes(status)) return;
      const daysLeft = expiry ? Math.ceil((new Date(expiry) - now) / 86400000) : null;
      expiringDocuments.push({
        id:           `${emp._id}-${type}`,
        employee:     emp.employeeName || 'Unknown',
        documentType: type === 'med' ? 'Medical Certificate' : 'BHP Training',
        expiryDate:   expiry ? new Date(expiry).toLocaleDateString('en-GB') : 'Not set',
        daysLeft,
        level:  !expiry       ? 'Missing Document'
              : daysLeft < 0  ? 'Expired'
              : daysLeft <= 7 ? '7-day warning'
                              : '30-day warning',
      });
    };
    // Only add a row for a document the role actually requires — a non-required
    // document defaults to MISSING in the schema and must not be listed here.
    if (emp.requiresMedicalCertificate)
      addRow(emp.medicalCertificate?.status, emp.medicalCertificate?.expiryDate, 'med');
    if (emp.requiresBHPTraining)
      addRow(emp.bhpTraining?.status, emp.bhpTraining?.expiryDate, 'bhp');
  }

  // ── Transform: recently uploaded documents (from audit logs) ─────────────
  const recentDocuments = recentDocRaw.map((log) => ({
    id:           log._id,
    employeeName: empNameMap.get(log.resourceId) || 'Unknown',
    documentType: log.newValue?.docType === 'medical' ? 'Medical Certificate' : 'BHP Training',
    uploadDate:   log.createdAt,
    expiryDate:   log.newValue?.expiryDate || null,
    status:       calcDocStatus(log.newValue?.expiryDate),
    uploadedBy:   log.userEmail || 'System',
  }));

  // ── Transform: recently added employees ───────────────────────────────────
  const recentEmployees = (facetResult?.recentEmployees || []).map((emp) => ({
    id:         emp._id,
    name:       emp.name       || 'Unknown',
    employeeId: emp.employeeId || '—',
    email:      emp.email      || '—',
    department: emp.department || '—',
    position:   emp.position   || '—',
    createdAt:  emp.createdAt,
  }));

  // ── Transform: audit activity timeline ────────────────────────────────────
  // resourceName is the employee whose record was affected — looked up above.
  // It is embedded in description AND exposed as a separate field so the
  // frontend can display "Updated by: admin@co" + "Record: Jan Kowalski" if needed.
  const recentAuditLogs = recentAuditRaw.map((log) => {
    const resourceName = empNameMap.get(log.resourceId) || null;
    return {
      id:           log._id,
      action:       log.action,
      description:  actionLabel(log.action, log.newValue, resourceName),
      resourceName,
      user:         log.userEmail || 'System',
      time:         log.createdAt,
      resourceId:   log.resourceId,
    };
  });

  return {
    // ── Dashboard card metrics ──────────────────────────────────────────────
    metrics: {
      total:        statsRaw.total        || 0,
      compliant:    statsRaw.compliant    || 0,
      expiringSoon: statsRaw.expiringSoon || 0,
      blocked:      statsRaw.blocked      || 0,
      missingDocs:  statsRaw.missingDocs  || 0,
    },

    // ── Compliance health bar ───────────────────────────────────────────────
    complianceHealth: {
      compliant,
      warning,
      blocked,
      compliantPct: pct(compliant),
      warningPct:   pct(warning),
      blockedPct:   pct(blocked),
    },

    // ── Table data ──────────────────────────────────────────────────────────
    employees,
    expiringDocuments,
    recentDocuments,
    recentEmployees,
    recentAuditLogs,

    // Backward-compat aliases for the existing frontend component keys
    recentUploads:  recentDocuments,
    auditActivity:  recentAuditLogs,
  };
};

// OLD: getDashboardStats — commented out; replaced by getDashboardOverview.
// Reason: queried employees via Employee.find({ tenantId }) but the Employee
// schema has no tenantId field — tenant is on the linked User document.
// Also returned raw Mongoose documents with no transformation, so the shape
// did not match what ComplianceDashboard.jsx expected.
//
// const getDashboardStats = async (tenantId) => { ... };

module.exports = { getDashboardOverview };
