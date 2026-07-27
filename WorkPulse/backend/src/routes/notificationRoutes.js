const express = require('express');
const notificationController = require('../controllers/notificationController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// Real-time channel: the browser opens this once and we push alerts down it.
// (Server-Sent Events — no polling.) Kept above the ":id" route so "stream" is
// never mistaken for a notification id.
router.get('/stream', notificationController.stream);

// Just the unread number for the bell badge (fetched once on page load).
router.get('/unread-count', notificationController.unreadCount);

// A user's own alert inbox (break reminders, missing clock-out, etc.).
router.get('/', notificationController.listMine);

// Clear the whole inbox, or mark a single alert as read.
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markRead);

module.exports = router;
