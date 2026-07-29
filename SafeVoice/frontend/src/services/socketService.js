/**
 * SafeVoice realtime client (STOMP over SockJS).
 *
 * One module-level client at a time. There are two ways to authenticate, matching the
 * backend:
 *   • staff()           — relies on the shared "idToken" SSO cookie, which SockJS sends on
 *                         the handshake automatically. No credential is passed in JS.
 *   • reporter(key)     — passes the case access key in the STOMP CONNECT headers
 *                         ("X-Access-Key"); the connection is pinned to that one case.
 *
 * The service only manages the CONNECTION and raw subscribe/publish. Feature wiring
 * (dispatching into Redux) comes in later phases; for Phase 0 we expose connect/disconnect,
 * subscribe/publish, and a ping() used to verify the pipeline end to end.
 */
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { SAFEVOICE_API_BASE } from "./api";

let client = null;
// Subscriptions we re-create automatically after a reconnect: dest → { callback, sub }.
const subscriptions = new Map();
let onReadyCallbacks = [];

const WS_URL = `${SAFEVOICE_API_BASE}/ws`;

// Open a connection. `connectHeaders` carries the reporter access key (empty for staff).
function connect({ connectHeaders = {}, onReady } = {}) {
  // Already connected/connecting → just register the ready callback.
  if (client) {
    if (onReady) (client.connected ? onReady() : onReadyCallbacks.push(onReady));
    return;
  }
  if (onReady) onReadyCallbacks.push(onReady);

  client = new Client({
    // SockJS handles the transport (and sends cookies with credentials for staff auth).
    webSocketFactory: () => new SockJS(WS_URL),
    connectHeaders,
    // Auto-reconnect with a small backoff; STOMP heartbeats detect dead links.
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      // Re-establish any subscriptions requested before/again after a reconnect.
      subscriptions.forEach((entry, dest) => {
        entry.sub = client.subscribe(dest, entry.callback);
      });
      const cbs = onReadyCallbacks;
      onReadyCallbacks = [];
      cbs.forEach((cb) => cb());
    },
    onStompError: (frame) => {
      // Server rejected the frame (e.g. failed CONNECT auth or unauthorized SUBSCRIBE).
      console.error("[socket] STOMP error:", frame.headers["message"], frame.body);
    },
  });

  client.activate();
}

// Subscribe to a destination; survives reconnects. Returns an unsubscribe function.
function subscribe(destination, callback) {
  const entry = { callback, sub: null };
  subscriptions.set(destination, entry);
  if (client && client.connected) {
    entry.sub = client.subscribe(destination, callback);
  }
  return () => {
    entry.sub?.unsubscribe();
    subscriptions.delete(destination);
  };
}

// Send a message to an /app destination.
function publish(destination, body = {}) {
  if (!client || !client.connected) return;
  client.publish({ destination, body: JSON.stringify(body) });
}

// Tear down the connection and forget subscriptions (e.g. on sign-out / page leave).
function disconnect() {
  subscriptions.clear();
  onReadyCallbacks = [];
  if (client) {
    client.deactivate();
    client = null;
  }
}

function isConnected() {
  return Boolean(client && client.connected);
}

// ── Phase-0 verification ──────────────────────────────────────────────────────
// Subscribe to the private pong queue, send a ping, and report the server's reply.
function ping() {
  subscribe("/user/queue/pong", (msg) => {
    try {
      console.info("[socket] pong:", JSON.parse(msg.body));
    } catch {
      console.info("[socket] pong (raw):", msg.body);
    }
  });
  publish("/app/ping", {});
}

export const socketService = {
  // Connect as staff (cookie auth) and run a verification ping once connected.
  connectStaff(onReady) {
    connect({ onReady });
  },
  // Connect as a reporter for one case, authenticated by the access key.
  connectReporter(accessKey, onReady) {
    connect({ connectHeaders: { "X-Access-Key": accessKey }, onReady });
  },
  subscribe,
  publish,
  disconnect,
  isConnected,
  ping,
};

export default socketService;
