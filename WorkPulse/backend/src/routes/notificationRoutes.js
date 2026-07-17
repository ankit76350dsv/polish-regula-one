const express = require('express');
const notificationController = require('../controllers/notificationController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// A user's own alert inbox (break reminders, missing clock-out, etc.).
router.get('/', notificationController.listMine);
router.patch('/:id/read', notificationController.markRead);

module.exports = router;
