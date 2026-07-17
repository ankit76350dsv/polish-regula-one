const Notification = require('../models/Notification');

// ─────────────────────────────────────────────────────────────────────────────
// Notification service.
// ─────────────────────────────────────────────────────────────────────────────
// Central place to raise an alert. Cron jobs and services call createNotification;
// the frontend reads them via listForUser and marks them read.
//
// We de-duplicate: the cron jobs run every few minutes, so without a guard they
// would create the same "please take your break" alert over and over. Before
// creating an alert we check whether an unread alert of the same type for the
// same time entry already exists, and skip if so.

// Create one alert, unless an equivalent unread one already exists.
async function createNotification({
  tenantId,
  userId,
  employeeId,
  type,
  title,
  message,
  relatedEntryId,
  channel = 'IN_APP',
}) {
  try {
    if (relatedEntryId) {
      const existing = await Notification.findOne({
        type,
        relatedEntryId,
        status: { $in: ['PENDING', 'SENT'] },
      });
      // Same alert already pending/sent for this entry — don't spam.
      if (existing) return existing;
    }

    return await Notification.create({
      tenantId,
      userId,
      employeeId,
      type,
      title,
      message,
      relatedEntryId,
      channel,
      status: 'PENDING',
    });
  } catch (err) {
    // Never let a notification failure break the job/request that raised it.
    console.error('[NOTIFY] Failed to create notification:', err.message);
    return null;
  }
}

// The alerts for one logged-in user (their in-app inbox), newest first.
async function listForUser(userId, { onlyUnread = false, limit = 50 } = {}) {
  const query = { userId };
  if (onlyUnread) query.status = { $in: ['PENDING', 'SENT'] };
  return Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

// Mark a single alert as read (only if it belongs to this user).
async function markRead(notificationId, userId) {
  const note = await Notification.findOne({ _id: notificationId, userId });
  if (!note) throw { status: 404, message: 'Notification not found' };
  note.status = 'READ';
  note.readAt = new Date();
  await note.save();
  return note;
}

module.exports = {
  createNotification,
  listForUser,
  markRead,
};
