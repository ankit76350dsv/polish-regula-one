const express = require('express');
const auditController = require('../controllers/auditController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// Reading the audit trail needs AUDIT_READ, which admins and auditors have but HR
// does NOT. Checking the trail is the auditor's whole job. If HR could read it, HR
// could watch which colleagues looked at whose working-time records — staff
// surveillance with no work reason behind it. The query is always limited to the
// caller's own tenant, so no cross-tenant data is ever shown.
router.get('/', authorizeCapability(CAPABILITIES.AUDIT_READ), auditController.getAuditLogs);

module.exports = router;
