const express = require('express');
const authController = require('../controllers/authController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();

// WorkPulse does not log users in — RegulaOne SSO owns login. We only read the
// current session (getMe) and record a logout audit entry.
router.get('/me', isAuthenticatedUser, authController.getMe);
router.post('/logout', isAuthenticatedUser, authController.logout);

module.exports = router;
