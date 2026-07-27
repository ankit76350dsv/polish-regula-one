const Notification = require('../models/Notification');
const notificationStream = require('./notificationStream');

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
//
// REAL-TIME DELIVERY: right after an alert is saved we also PUSH it to the user's
// open browser connection (see notificationStream). This means the bell in the
// header updates instantly, without the browser having to keep asking the server
// ("polling"). If nobody is connected the push is simply skipped — the alert is
// still safely stored and will show the next time they open the app.

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

    const note = await Notification.create({
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

    // Push the new alert straight to the user's open browser tab(s) in real time.
    // This is wrapped on its own so a streaming hiccup can never undo the save.
    if (userId) {
      try {
        const unreadCount = await countUnread(userId);
        notificationStream.publish(userId, 'notification', {
          notification: toClient(note),
          unreadCount,
        });
      } catch (streamErr) {
        console.error('[NOTIFY] Live push failed (alert still saved):', streamErr.message);
      }
    }

    return note;
  } catch (err) {
    // Never let a notification failure break the job/request that raised it.
    console.error('[NOTIFY] Failed to create notification:', err.message);
    return null;
  }
}

// Trim a stored notification to the small shape the frontend needs. Keeps the
// payload we push over the wire lean and free of any internal-only fields.
function toClient(note) {
  return {
    _id: note._id,
    type: note.type,
    title: note.title,
    message: note.message,
    status: note.status,
    relatedEntryId: note.relatedEntryId,
    createdAt: note.createdAt,
  };
}

// How many alerts a user has not read yet (PENDING or SENT). Used for the badge
// number on the bell and included in every real-time push.
async function countUnread(userId) {
  return Notification.countDocuments({
    userId,
    status: { $in: ['PENDING', 'SENT'] },
  });
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

  // Tell the user's other open tabs the unread count dropped, so every tab's
  // badge stays in sync (e.g. reading on the phone clears the badge on desktop).
  notificationStream.publish(userId, 'read', { unreadCount: await countUnread(userId) });
  return note;
}

// Mark every unread alert for a user as read in one go ("clear all" in the bell).
async function markAllRead(userId) {
  const result = await Notification.updateMany(
    { userId, status: { $in: ['PENDING', 'SENT'] } },
    { $set: { status: 'READ', readAt: new Date() } }
  );
  notificationStream.publish(userId, 'read', { unreadCount: 0 });
  return { updated: result.modifiedCount || 0 };
}

module.exports = {
  createNotification,
  listForUser,
  countUnread,
  markRead,
  markAllRead,
};
