const express = require('express');
const { body } = require('express-validator');
const employeeController = require('../controllers/employeeController');
const auditController    = require('../controllers/auditController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(isAuthenticatedUser);

// GET /api/admin/employees/:profileId
// Returns a single SafeWork employee record by its SafeWork_Employee _id.
// The profile page uses this to populate all detail fields.
router.get(
  '/employees/:profileId',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_USER', 'COMPLIANCE_OFFICER'),
  employeeController.getEmployeeById
);

// GET /api/admin/employees/:profileId/document-url?docType=medical|bhp
// Returns a short-lived (15 min) pre-signed S3 GET URL so the frontend can
// open or download a stored compliance document directly from S3.
router.get(
  '/employees/:profileId/document-url',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_USER', 'COMPLIANCE_OFFICER'),
  employeeController.getDocumentViewUrl
);

// GET /api/admin/employees/:profileId/upload-url?docType=medical|bhp&fileName=xyz.pdf
// Returns a pre-signed S3 PUT URL. Frontend uploads the file directly to S3,
// then calls PATCH /employees/:profileId/document to save the S3 key reference.
router.get(
  '/employees/:profileId/upload-url',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_USER', 'COMPLIANCE_OFFICER'),
  employeeController.getDocumentUploadUrl
);

// PATCH /api/admin/employees/:profileId/document
// Saves the S3 object key + document metadata after a successful S3 upload.
router.patch(
  '/employees/:profileId/document',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_USER'),
  employeeController.saveDocumentReference
);

// GET /api/admin/users
// Returns all RegulaOne users for the CURRENT tenant merged with their
// EmployeeProfile data. The tenant is taken from the authenticated session
// (req.tenantId) — it is no longer part of the URL.
// Users with no profile are flagged as profileMissing: true.
router.get(
  '/users',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_USER', 'COMPLIANCE_OFFICER'),
  employeeController.getEmployees
);

// PUT /api/admin/employees/:employeeId
// Upserts the compliance profile for a RegulaOne user identified by employeeId.
// Acts as create on first call; subsequent calls update the existing profile.
// Identity fields (name, email) must NOT be sent — they are read from RegulaOne.
router.put(
  '/employees/:employeeId',
  authorizeRoles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER'),
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
// Separate from the profile upsert so compliance officers can update status
// without needing full profile edit permissions.
router.patch(
  '/employees/:employeeId/compliance',
  authorizeRoles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER'),
  employeeController.updateEmployeeCompliance
);

// ── Audit Logs ────────────────────────────────────────────────────────────────

// GET /api/admin/audit-logs
// Returns a paginated, filterable audit trail for the tenant.
// Logs cover every significant event: list views, profile views, document access,
// profile creates/updates, compliance updates, and document uploads.
// COMPLIANCE_OFFICER and above can read; only SUPER_ADMIN can see cross-tenant data.
router.get(
  '/audit-logs',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'COMPLIANCE_OFFICER'),
  auditController.getAuditLogs
);

module.exports = router;
