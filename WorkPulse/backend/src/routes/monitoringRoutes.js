const express = require('express');
const monitoringController = require('../controllers/monitoringController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// The monitoring notice is a legal duty owed TO the employee: the employer must
// inform staff about monitoring before it starts (Kodeks pracy art. 22(2) §7).
// So every WorkPulse role can read the notice and acknowledge it — this is the
// person's own record, not a privilege, and nobody may be locked out of it.
router.get('/status', authorizeCapability(CAPABILITIES.MONITORING_SELF), monitoringController.getStatus);
router.post('/acknowledge', authorizeCapability(CAPABILITIES.MONITORING_SELF), monitoringController.acknowledge);

module.exports = router;
