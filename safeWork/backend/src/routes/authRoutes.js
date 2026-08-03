const express = require('express');
const authController = require('../controllers/authController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();

// NOTE: The old local password login (POST /api/auth/login) has been removed.
// SafeWork no longer logs users in itself. Login is handled centrally by the
// RegulaOne SSO service (POST /api/sso/login on the RegulaOne backend), which
// sets the shared HttpOnly auth cookie. SafeWork only reads that cookie to
// identify the user (see authMiddleware verifying the Cognito token).

// These two routes are on purpose NOT behind the SafeWork permission gate that
// protects /api/admin and /api/dashboard.
//
// Why: they only ever touch the CALLER'S OWN account. /me returns the profile of
// the person already holding the session, and /logout ends that same session.
// Neither one exposes another employee's data, so blocking them would add no
// security — it would only mean a user without SafeWork permission could not
// even log out cleanly, which is worse for everyone.
//
// isAuthenticatedUser is still required, so an anonymous caller gets nothing.
router.get('/me', isAuthenticatedUser, authController.getMe);

router.post('/logout', isAuthenticatedUser, authController.logout);

module.exports = router;