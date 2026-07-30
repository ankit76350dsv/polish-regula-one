import { useState, useEffect, useRef, useCallback } from "react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationStreamUrl,
} from "../api/workpulseApi";
import { useTranslation } from "../hooks/useTranslation";
import { useFormat } from "../hooks/useFormat";

// ─────────────────────────────────────────────────────────────────────────────
// NotificationBell — the live alert inbox shown in the header.
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW IT STAYS LIVE (no polling):
//   On mount we do TWO things:
//     1. Fetch the current list once (so the dropdown has history to show).
//     2. Open a single long-lived connection to the server's event stream
//        (`EventSource`). The server pushes new alerts straight down it, so the
//        badge and list update the instant something happens — the browser never
//        has to keep asking "anything new yet?".
//   `withCredentials: true` sends the shared login cookie, so the stream is
//   authenticated exactly like every other request.

// A small colour + emoji hint for each alert type, so the list is scannable.
const TYPE_META = {
  BREAK_DUE: { icon: "☕", dot: "bg-amber-400" },
  BREAK_VIOLATION: { icon: "⚠️", dot: "bg-red-500" },
  OPEN_BREAK: { icon: "⏸️", dot: "bg-amber-400" },
  MISSING_CLOCK_OUT: { icon: "🕔", dot: "bg-red-500" },
  OVERTIME_APPROVAL: { icon: "⏱️", dot: "bg-indigo-500" },
  REST_VIOLATION: { icon: "🛌", dot: "bg-red-500" },
};

// An alert is "unread" while it is still PENDING or SENT (not yet READ).
const isUnread = (n) => n.status === "PENDING" || n.status === "SENT";

export default function NotificationBell() {
  const { t } = useTranslation();
  const { formatDateTime } = useFormat();

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  const wrapRef = useRef(null);
  const sourceRef = useRef(null);

  // Load the existing inbox once when the bell first appears.
  const loadInitial = useCallback(async () => {
    try {
      const list = await getNotifications({ limit: 30 });
      setItems(Array.isArray(list) ? list : []);
      setUnread((Array.isArray(list) ? list : []).filter(isUnread).length);
    } catch (err) {
      // A failed history load is not fatal — the live stream will still work.
      console.error("Failed to load notifications:", err.message);
    }
  }, []);

  // Open the real-time stream and keep the badge/list in sync with it.
  useEffect(() => {
    loadInitial();

    // Guard against opening a second connection (e.g. React strict-mode remount).
    if (sourceRef.current) return undefined;

    const es = new EventSource(notificationStreamUrl(), { withCredentials: true });
    sourceRef.current = es;

    es.addEventListener("open", () => setConnected(true));

    // The first frame the server sends: the current unread count.
    es.addEventListener("ready", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (typeof data.unreadCount === "number") setUnread(data.unreadCount);
      } catch {
        /* ignore malformed frame */
      }
    });

    // A brand-new alert arrived — put it on top and bump the badge.
    es.addEventListener("notification", (e) => {
      try {
        const { notification, unreadCount } = JSON.parse(e.data);
        if (notification) {
          setItems((prev) => [notification, ...prev].slice(0, 50));
        }
        if (typeof unreadCount === "number") setUnread(unreadCount);
      } catch {
        /* ignore malformed frame */
      }
    });

    // Another tab (or the server) marked things read — sync the badge down.
    es.addEventListener("read", (e) => {
      try {
        const { unreadCount } = JSON.parse(e.data);
        if (typeof unreadCount === "number") setUnread(unreadCount);
      } catch {
        /* ignore malformed frame */
      }
    });

    // The browser's EventSource reconnects on its own after a drop; we only note
    // that we are momentarily offline so we could show it if we wanted to.
    es.addEventListener("error", () => setConnected(false));

    // Close the connection cleanly when the bell unmounts (e.g. on sign-out).
    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [loadInitial]);

  // Close the dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Mark one alert read: update the server, then reflect it locally right away.
  const handleRead = async (id) => {
    const target = items.find((n) => n._id === id);
    if (!target || !isUnread(target)) return;
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, status: "READ" } : n)));
      setUnread((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark read:", err.message);
    }
  };

  // Clear every unread alert at once.
  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, status: "READ" })));
      setUnread(0);
    } catch (err) {
      console.error("Failed to mark all read:", err.message);
    }
  };

  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <div className="relative" ref={wrapRef}>
      {/* Bell button with the unread badge */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/70 transition-colors"
        aria-label={
          unread ? t("notifications.ariaWithUnread", { count: unread }) : t("notifications.aria")
        }
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
            {badge}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-300/40 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm">{t("notifications.title")}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-300"}`}
                title={connected ? t("notifications.live") : t("notifications.reconnecting")}
              />
            </div>
            {unread > 0 && (
              <button
                onClick={handleReadAll}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                {t("notifications.empty")}
              </div>
            ) : (
              items.map((n) => {
                const meta = TYPE_META[n.type] || { icon: "🔔", dot: "bg-slate-300" };
                const unreadItem = isUnread(n);
                return (
                  <button
                    key={n._id}
                    onClick={() => handleRead(n._id)}
                    className={`w-full text-left flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      unreadItem ? "bg-indigo-50/40" : ""
                    }`}
                  >
                    <span className="text-lg leading-none mt-0.5" aria-hidden>
                      {meta.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{n.title}</span>
                        {unreadItem && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 leading-snug">{n.message}</span>
                      <span className="block text-[10px] text-slate-400 mt-1">{formatDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
