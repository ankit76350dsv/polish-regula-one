const express = require('express');
const auditController = require('../controllers/auditController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// Reading the audit trail is a compliance/management action — admin/HR only.
router.get('/', authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'), auditController.getAuditLogs);

module.exports = router;
