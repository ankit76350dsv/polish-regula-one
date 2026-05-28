const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  authController.login
);

// GET /api/auth/me  — requires valid JWT
router.get('/me', authenticate, authController.getMe);

// POST /api/auth/logout — requires valid JWT
router.post('/logout', authenticate, authController.logout);

module.exports = router;
