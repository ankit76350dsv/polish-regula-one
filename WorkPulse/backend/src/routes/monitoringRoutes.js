const express = require('express');
const monitoringController = require('../controllers/monitoringController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// Any authenticated employee can see the notice status and acknowledge it.
router.get('/status', monitoringController.getStatus);
router.post('/acknowledge', monitoringController.acknowledge);

module.exports = router;
