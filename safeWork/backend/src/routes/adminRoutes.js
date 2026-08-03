const express = require('express');
const { body } = require('express-validator');
const employeeController = require('../controllers/employeeController');
const auditController    = require('../controllers/auditController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { guardUnblock } = require('../middleware/complianceGuard');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// ── How access is decided in this file ───────────────────────────────────────
//
// THREE checks run, in this order:
//
//   1. isAuthenticatedUser    -> "are you logged in?"        (Cognito token)
//   2. authorizePermissions   -> "may you use SafeWork at all?"  (front door)
//   3. authorizeCapability    -> "may you do THIS ONE THING?"    (per route)
//
// Checks 1 and 2 use router.use(), so they apply to every route below and a new
// endpoint can never be left unprotected by accident.
//
// Check 3 is written on each route, because it is different for each one. It
// names an ACTION (EMPLOYEE_READ, DOCUMENT_WRITE, ...), never a job title. The
// table in config/permissions.js says which job title is given which actions:
//
//   ACTION                | ADMIN | HR_MANAGER | AUDITOR
//   ----------------------|-------|------------|---------
//   EMPLOYEE_READ         |  yes  |    yes     |  yes
//   EMPLOYEE_WRITE        |  yes  |    yes     |  no
//   DOCUMENT_READ (file)  |  yes  |    yes     |  no   <- health data
//   DOCUMENT_WRITE        |  yes  |    yes     |  no
//   COMPLIANCE_BLOCK      |  yes  |    yes     |  no
//   COMPLIANCE_UNBLOCK    |  yes  |    no      |  no   <- overrides a legal gate
//   AUDIT_READ            |  yes  |    no      |  yes
//
// To change what a job title may do, edit that table — not these routes.
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// GET /api/admin/employees/:profileId
// Returns a single SafeWork employee record by its SafeWork_Employee _id.
// The profile page uses this to populate all detail fields.
router.get(
  '/employees/:profileId',
  authorizeCapability(CAPABILITIES.EMPLOYEE_READ),
  employeeController.getEmployeeById
);

// GET /api/admin/employees/:profileId/document-url?docType=medical|bhp
// Returns a short-lived (15 min) pre-signed S3 GET URL so the frontend can
// open or download a stored compliance document directly from S3.
//
// This opens the DOCTOR'S CERTIFICATE itself, which is health data (GDPR
// Article 9), so it needs DOCUMENT_READ — a stronger permission than seeing the
// employee record. Auditors do NOT have it: the status and expiry date they get
// from the record above already prove a valid certificate existed, so opening
// the file would expose sensitive data for no extra benefit.
router.get(
  '/employees/:profileId/document-url',
  authorizeCapability(CAPABILITIES.DOCUMENT_READ),
  employeeController.getDocumentViewUrl
);

// GET /api/admin/employees/:profileId/upload-url?docType=medical|bhp&fileName=xyz.pdf
// Returns a pre-signed S3 PUT URL. Frontend uploads the file directly to S3,
// then calls PATCH /employees/:profileId/document to save the S3 key reference.
//
// Handing out an upload URL is already the act of uploading, so it is guarded
// with DOCUMENT_WRITE — the same permission as the save step below. If only the
// save step were guarded, someone could still write files into our bucket.
router.get(
  '/employees/:profileId/upload-url',
  authorizeCapability(CAPABILITIES.DOCUMENT_WRITE),
  employeeController.getDocumentUploadUrl
);

// PATCH /api/admin/employees/:profileId/document
// Saves the S3 object key + document metadata after a successful S3 upload.
router.patch(
  '/employees/:profileId/document',
  authorizeCapability(CAPABILITIES.DOCUMENT_WRITE),
  employeeController.saveDocumentReference
);

// GET /api/admin/users
// Returns all RegulaOne users for the CURRENT tenant merged with their
// EmployeeProfile data. The tenant is taken from the authenticated session
// (req.tenantId) — it is no longer part of the URL.
// Users with no profile are flagged as profileMissing: true.
router.get(
  '/users',
  authorizeCapability(CAPABILITIES.EMPLOYEE_READ),
  employeeController.getEmployees
);

// PUT /api/admin/employees/:employeeId
// Upserts the compliance profile for a RegulaOne user identified by employeeId.
// Acts as create on first call; subsequent calls update the existing profile.
// Identity fields (name, email) must NOT be sent — they are read from RegulaOne.
router.put(
  '/employees/:employeeId',
  authorizeCapability(CAPABILITIES.EMPLOYEE_WRITE),
  [
    body('department').optional().isString(),
    body('position').optional().isString(),
    body('riskLevel').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    // Must match the contractType enum in models/Employee.js exactly.
    body('contractType').optional().isIn(['UOP', 'UOP_PROBATION', 'UOP_FIXED', 'UOP_INDEFINITE', 'UZ', 'UOD', 'B2B', 'INTERNSHIP', 'OTHER']),
  ],
  employeeController.upsertEmployeeProfile
);

// PATCH /api/admin/employees/:employeeId/compliance
// Updates only compliance-specific fields (medical cert status, BHP, blocking).
//
// TWO checks, because this one URL can do two very different things:
//   - COMPLIANCE_BLOCK  : the normal permission to change compliance status,
//                         including blocking someone from clocking in. Blocking
//                         ENFORCES the law, so HR may always do it.
//   - guardUnblock      : looks inside the request. If it is trying to REMOVE a
//                         block (isBlocked: false) it demands the admin-only
//                         COMPLIANCE_UNBLOCK permission plus a written reason,
//                         because that switches a legal safety gate off.
// See middleware/complianceGuard.js for the full explanation.
router.patch(
  '/employees/:employeeId/compliance',
  authorizeCapability(CAPABILITIES.COMPLIANCE_BLOCK),
  guardUnblock,
  employeeController.updateEmployeeCompliance
);

// ── Audit Logs ────────────────────────────────────────────────────────────────

// GET /api/admin/audit-logs
// Returns a paginated, filterable audit trail for the tenant.
// Logs cover every significant event: list views, profile views, document access,
// profile creates/updates, compliance updates, and document uploads.
//
// Needs AUDIT_READ, which admins and auditors have but HR does NOT. Checking the
// audit trail is the auditor's job. If HR could read it, HR could watch which
// colleagues opened whose records — staff surveillance with no work reason.
// The query is always limited to the caller's own tenant (req.tenantId), so no
// cross-tenant data is ever shown.
router.get(
  '/audit-logs',
  authorizeCapability(CAPABILITIES.AUDIT_READ),
  auditController.getAuditLogs
);

module.exports = router;
