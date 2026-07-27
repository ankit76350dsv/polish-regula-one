// ─────────────────────────────────────────────────────────────────────────────
// Notification stream — real-time push to the browser using Server-Sent Events.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS (plain words):
//   Before, a reminder was only saved in the database. The browser had no way to
//   know a new reminder arrived unless it kept asking the server again and again
//   (this is called "polling", and it wastes a lot of network traffic). Instead,
//   we keep ONE open connection per logged-in browser tab. When a new alert is
//   made, we push it straight down that open connection. No repeated asking.
//
// HOW IT WORKS:
//   The browser opens GET /api/notifications/stream. That request never finishes
//   normally — we hold it open and write small "data:" lines to it whenever there
//   is something new. This is the standard Server-Sent Events (SSE) protocol,
//   which the browser's built-in `EventSource` understands.
//
// IMPORTANT SCALING NOTE:
//   These open connections live in the memory of ONE server process. If WorkPulse
//   is ever run on several servers at once, a user connected to server A would not
//   receive an alert created on server B. To support many servers, replace the
//   in-memory map below with a shared publish/subscribe bus (for example Redis
//   pub/sub) so every server can reach every connection. For a single instance
//   (the default) this in-memory approach is correct and simple.

// Map of userId (string) -> Set of open response objects for that user.
// One user can have several tabs open, so we keep a Set, not a single response.
const clientsByUser = new Map();

// How often we send a tiny "keep alive" comment. Some proxies close a connection
// that has been silent for a while; a heartbeat every 25 seconds prevents that.
const HEARTBEAT_MS = 25 * 1000;

// Register a freshly opened SSE connection for a user.
// `res` is the Express response object we will keep writing to.
function addClient(userId, res) {
  const key = String(userId);

  if (!clientsByUser.has(key)) {
    clientsByUser.set(key, new Set());
  }
  clientsByUser.get(key).add(res);

  // Send a heartbeat comment on a timer. A line beginning with ":" is a comment
  // in SSE — the browser ignores it, but it keeps the connection alive.
  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch (err) {
      // Writing failed means the socket is gone — stop the timer and clean up.
      clearInterval(heartbeat);
      removeClient(userId, res);
    }
  }, HEARTBEAT_MS);

  // Remember the timer on the response so we can clear it when the client leaves.
  res.__heartbeat = heartbeat;
}

// Remove a connection when the browser tab closes or the network drops.
function removeClient(userId, res) {
  const key = String(userId);
  const set = clientsByUser.get(key);

  if (res.__heartbeat) clearInterval(res.__heartbeat);

  if (set) {
    set.delete(res);
    // No tabs left for this user — drop the empty Set to free memory.
    if (set.size === 0) clientsByUser.delete(key);
  }
}

// Push one event to every open connection belonging to a user.
// `event` is the event name (e.g. "notification"); `payload` is any JSON value.
function publish(userId, event, payload) {
  const set = clientsByUser.get(String(userId));
  if (!set || set.size === 0) return; // Nobody is listening right now — that's fine.

  // SSE frame format: an optional "event:" line, then one "data:" line, then a
  // blank line to mark the end of the message.
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const res of set) {
    try {
      res.write(frame);
    } catch (err) {
      // A broken pipe means this tab is gone — clean it up so we don't leak it.
      removeClient(userId, res);
    }
  }
}

// How many browser tabs are currently connected (handy for health/debugging).
function connectionCount() {
  let total = 0;
  for (const set of clientsByUser.values()) total += set.size;
  return total;
}

module.exports = { addClient, removeClient, publish, connectionCount };
