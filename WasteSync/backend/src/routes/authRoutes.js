const express = require('express');
const authController = require('../controllers/authController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();

// NOTE: There is no local login route here. Login is handled centrally by the
// RegulaOne SSO service, which sets the shared HttpOnly auth cookie. WasteSync
// only reads that cookie to identify the user.

// Returns the current user's profile (used by the frontend on app load).
router.get('/me', isAuthenticatedUser, authController.getMe);

// Records a logout in the audit log. The cookie itself is cleared by RegulaOne.
router.post('/logout', isAuthenticatedUser, authController.logout);

module.exports = router;
