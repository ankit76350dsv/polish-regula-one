const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// Dashboard and payroll summaries are management views — admin/HR only.
router.get(
  '/overview',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  dashboardController.getOverview
);

router.get(
  '/monthly',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  dashboardController.getMonthly
);

module.exports = router;
