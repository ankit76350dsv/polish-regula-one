const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');

const router = express.Router();

router.use(isAuthenticatedUser, requireWasteSyncModule);

// GET /api/dashboard/overview — single aggregated dashboard payload.
router.get('/overview', dashboardController.getOverview);

module.exports = router;
