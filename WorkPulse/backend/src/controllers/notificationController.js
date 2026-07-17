const notificationService = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/notifications — the logged-in user's alert inbox.
const listMine = async (req, res, next) => {
  try {
    const onlyUnread = req.query.unread === 'true';
    const list = await notificationService.listForUser(req.user._id, { onlyUnread });
    return sendSuccess(res, list, 'Notifications retrieved');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:id/read — mark one alert as read.
const markRead = async (req, res, next) => {
  try {
    const note = await notificationService.markRead(req.params.id, req.user._id);
    return sendSuccess(res, note, 'Notification marked read');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { listMine, markRead };
