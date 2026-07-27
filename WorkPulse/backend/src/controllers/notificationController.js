const notificationService = require('../services/notificationService');
const notificationStream = require('../services/notificationStream');
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

// GET /api/notifications/unread-count — just the number for the bell badge.
// The bell fetches this once on load; after that the live stream keeps it fresh.
const unreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.countUnread(req.user._id);
    return sendSuccess(res, { unreadCount: count }, 'Unread count retrieved');
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

// PATCH /api/notifications/read-all — clear the whole inbox in one click.
const markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.user._id);
    return sendSuccess(res, result, 'All notifications marked read');
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications/stream — the real-time channel (Server-Sent Events).
//
// The browser opens this once and we hold it open, pushing new alerts down it as
// they happen. This replaces "polling" (asking the server again and again).
// Authentication is the normal shared cookie, checked by isAuthenticatedUser
// before we ever get here, so only the logged-in user can open their own stream.
const stream = (req, res) => {
  const userId = req.user._id;

  // SSE handshake: tell the browser this is an event stream that stays open.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform', // never cache; never let a proxy buffer it
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering so events arrive immediately
  });
  // Flush the headers right away so the browser marks the connection "open".
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // Send an initial event with the current unread count so the badge is correct
  // the instant the page loads, without a separate request.
  notificationService
    .countUnread(userId)
    .then((count) => res.write(`event: ready\ndata: ${JSON.stringify({ unreadCount: count })}\n\n`))
    .catch(() => res.write('event: ready\ndata: {"unreadCount":0}\n\n'));

  // Register this connection so createNotification() can push to it.
  notificationStream.addClient(userId, res);

  // When the browser tab closes or the network drops, clean up so we don't leak
  // the connection or keep firing heartbeats into a dead socket.
  req.on('close', () => notificationStream.removeClient(userId, res));
};

module.exports = { listMine, unreadCount, markRead, markAllRead, stream };
