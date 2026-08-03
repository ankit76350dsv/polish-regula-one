const express = require('express');
const auditController = require('../controllers/auditController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// Same front door as every other WasteSync route file: logged in -> tenant owns
// the module -> this user was given WasteSync. See routes/companyRoutes.js for the
// full table of who may do what.
router.use(isAuthenticatedUser, requireWasteSyncModule, authorizePermissions());

// GET /api/audit — the tenant's audit trail (paginated, filterable).
//
// Needs AUDIT_READ, which admins and auditors have but HR does NOT. Checking the
// audit trail is the auditor's job. If HR could read it, HR could watch which
// colleagues opened or corrected whose figures — staff surveillance with no work
// reason behind it. The query is always limited to the caller's own tenant
// (req.tenantId), so no cross-tenant data is ever shown.
router.get('/', authorizeCapability(CAPABILITIES.AUDIT_READ), auditController.getAuditLogs);

module.exports = router;
