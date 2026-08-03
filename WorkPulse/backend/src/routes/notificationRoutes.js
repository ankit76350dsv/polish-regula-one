const express = require('express');
const notificationController = require('../controllers/notificationController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// Everything in this file is the caller's OWN alert inbox (break reminders,
// missing clock-out warnings), so one capability covers the whole file. Every
// WorkPulse role has it — a person must always be able to read the warnings the
// system raises about their own working time.
router.use(authorizeCapability(CAPABILITIES.NOTIFICATION_SELF));

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
