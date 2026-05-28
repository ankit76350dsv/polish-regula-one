const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/dashboard — returns tenant-scoped compliance stats
// Note: the frontend dashboardSlice points to localhost:5000/api/dashboard.
// This server runs on 8080. Update the slice base URL if running a single server.
router.get('/', authenticate, dashboardController.getDashboard);

module.exports = router;
