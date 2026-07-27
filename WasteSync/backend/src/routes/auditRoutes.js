const express = require('express');
const auditController = require('../controllers/auditController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');

const router = express.Router();

router.use(isAuthenticatedUser, requireWasteSyncModule);

// GET /api/audit — the tenant's audit trail (paginated, filterable).
router.get('/', auditController.getAuditLogs);

module.exports = router;
