const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/dashboard — returns tenant-scoped compliance stats
router.get('/', isAuthenticatedUser, dashboardController.getDashboard);

module.exports = router;
