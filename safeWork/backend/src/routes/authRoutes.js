const express = require('express');
const authController = require('../controllers/authController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();

// NOTE: The old local password login (POST /api/auth/login) has been removed.
// SafeWork no longer logs users in itself. Login is handled centrally by the
// RegulaOne SSO service (POST /api/sso/login on the RegulaOne backend), which
// sets the shared HttpOnly auth cookie. SafeWork only reads that cookie to
// identify the user (see authMiddleware verifying the Cognito token).

router.get('/me', isAuthenticatedUser, authController.getMe);

router.post('/logout', isAuthenticatedUser, authController.logout);

module.exports = router;