const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  authController.login
);

router.get('/me', isAuthenticatedUser, authController.getMe);

router.post('/logout', isAuthenticatedUser, authController.logout);

module.exports = router;