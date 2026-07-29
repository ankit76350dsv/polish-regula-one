import { useEffect, useState, useCallback } from "react";
import * as api from "../api/workpulseApi";
import { Card, Spinner, ErrorBanner, Badge } from "../components/ui";
import { formatDuration, formatTime } from "../utils/format";

// Ask the browser for the current GPS position. Returns a small
// { latitude, longitude, accuracy } object, or null if the user blocks it or
// the device has no GPS. We NEVER block clock-in just because GPS failed — the
// backend records "no location" and lets HR review it. 8-second timeout so a
// slow GPS fix does not leave the button spinning forever.
function getPosition() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null), // permission denied / unavailable → carry on without it
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

// Work out the break a person is owed for the minutes they have worked.
// Mirrors the backend rule (art. 134): ≥6h → 15m, >9h → 30m, >16h → 45m.
function requiredBreak(workedMinutes) {
  const h = workedMinutes / 60;
  if (h > 16) return 45;
  if (h > 9) return 30;
  if (h >= 6) return 15;
  return 0;
}

// Format a number of seconds as a ticking stopwatch string "H:MM:SS"
// (e.g. 3662 seconds -> "1:01:02"). Minutes and seconds are zero-padded.
function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Compute live worked/break time from the open shift, ticking every second.
// We keep both seconds (for the ticking clock) and minutes (for the tiles).
function computeLive(active) {
  if (!active) return null;
  const now = Date.now();
  const clockIn = new Date(active.clockIn).getTime();
  let breakMs = 0;
  let openBreak = null;
  for (const b of active.breaks || []) {
    const start = new Date(b.breakStart).getTime();
    const end = b.breakEnd ? new Date(b.breakEnd).getTime() : now;
    breakMs += Math.max(0, end - start);
    if (!b.breakEnd) openBreak = b;
  }
  const grossMs = now - clockIn;
  const netMs = Math.max(0, grossMs - breakMs);
  const openBreakMs = openBreak ? now - new Date(openBreak.breakStart).getTime() : 0;
  return {
    netSeconds: netMs / 1000,
    netMinutes: netMs / 60000,
    breakMinutes: breakMs / 60000,
    openBreakSeconds: openBreakMs / 1000,
    openBreakMinutes: openBreakMs / 60000,
    onBreak: active.status === "ON_BREAK",
  };
}

export default function Clock() {
  const [status, setStatus] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [monitoring, setMonitoring] = useState(null); // Art. 22² notice status
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0); // forces a re-render every second

  const load = useCallback(async () => {
    try {
      setError("");
      const [s, p, m] = await Promise.all([
        api.getStatus(),
        api.getPolicy().catch(() => null),
        api.getMonitoringStatus().catch(() => null),
      ]);
      setStatus(s);
      setPolicy(p);
      setMonitoring(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Record that the employee has read the location-monitoring notice, then
  // refresh so the clock-in button becomes available.
  const acknowledgeNotice = async () => {
    setAcknowledging(true);
    setError("");
    try {
      await api.acknowledgeMonitoring();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAcknowledging(false);
    }
  };

  // Clock in / out. When the tenant tracks location we grab the GPS position
  // first and send it along; otherwise we send nothing extra.
  const trackingOn = monitoring?.locationTrackingEnabled;
  const doClock = (which) =>
    act(async () => {
      const location = trackingOn ? await getPosition() : undefined;
      const device = trackingOn ? { platform: "web" } : undefined;
      if (which === "in") await api.clockIn({ location, device });
      else await api.clockOut({ location, device });
    });

  // Tick every second so the live timer updates while a shift is open.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Run a clock action, then refresh. Surfaces the backend message on failure
  // (e.g. the SafeWork block reason if the user is not allowed to clock in).
  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading your clock…" />;

  const eligibility = status?.eligibility;
  const active = status?.active;
  const allowed = eligibility?.allowed;
  // Must the employee accept the location-monitoring notice before clocking in?
  const needsNotice = monitoring?.required && !monitoring?.acknowledged;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <ErrorBanner message={error} />

      {/* ── Location monitoring notice (Art. 22²) — must accept before use ── */}
      {allowed && !active && needsNotice && (
        <MonitoringNotice
          monitoring={monitoring}
          busy={acknowledging}
          onAccept={acknowledgeNotice}
        />
      )}

      {/* ── Not allowed to clock in — show the SafeWork block reason ──────── */}
      {!allowed && !active && (
        <Card className="p-8 text-center border-red-200">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">You cannot clock in</h2>
          <p className="text-slate-600 mt-2 max-w-md mx-auto">{eligibility?.reason}</p>
          {eligibility?.employee?.blockReason && (
            <div className="mt-4">
              <Badge cls="bg-red-50 text-red-700 border-red-200">
                {eligibility.employee.blockReason}
              </Badge>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-6">
            This check comes from your SafeWork compliance record (medical certificate / BHP training).
            Please contact your administrator.
          </p>
        </Card>
      )}

      {/* ── Allowed and not currently clocked in ─────────────────────────── */}
      {allowed && !active && !needsNotice && (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">Welcome back{eligibility?.employee?.name ? `, ${eligibility.employee.name}` : ""}</p>
          <p className="text-4xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Daily norm: {policy?.standardDailyHours ?? 8}h · {policy?.workingTimeSystem ?? "STANDARD"} system
          </p>
          <button
            disabled={busy}
            onClick={() => doClock("in")}
            className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-lg font-bold shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-blue-400 transition-all active:scale-95 disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Clock In"}
          </button>
          <p className="text-xs text-emerald-600 mt-4">✓ Your safety & medical compliance is up to date</p>
          {trackingOn && (
            <p className="text-xs text-slate-400 mt-1">
              📍 Your location will be recorded for this clock-in (you accepted the monitoring notice).
            </p>
          )}
        </Card>
      )}

      {/* ── An active shift is open ──────────────────────────────────────── */}
      {active && (
        <ActiveShift
          active={active}
          policy={policy}
          busy={busy}
          act={act}
          onClockOut={() => doClock("out")}
          tickKey={tick}
        />
      )}
    </div>
  );
}

// The location-monitoring notice card (Art. 22²). Shown before the very first
// clock-in when the tenant tracks location, so the employee is informed and
// agrees before any position is ever recorded.
function MonitoringNotice({ monitoring, busy, onAccept }) {
  return (
    <Card className="p-8 border-indigo-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Location monitoring notice</h2>
          <p className="text-xs text-slate-400">
            Required by art. 22² of the Polish Labour Code · notice v{monitoring?.noticeVersion}
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
        {monitoring?.noticeText}
      </p>

      <div className="mt-6 flex justify-end">
        <button
          disabled={busy}
          onClick={onAccept}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow hover:from-indigo-400 hover:to-blue-400 active:scale-95 disabled:opacity-50"
        >
          {busy ? "Saving…" : "I understand and accept"}
        </button>
      </div>
    </Card>
  );
}

// The live shift panel: worked-so-far, break progress, and the action buttons.
function ActiveShift({ active, policy, busy, act, onClockOut }) {
  const live = computeLive(active);
  const scheduled = active.scheduledMinutes || (policy?.standardDailyHours ?? 8) * 60;
  const req = requiredBreak(live.netMinutes + live.breakMinutes);
  const breakOk = live.breakMinutes >= req;
  const overtime = Math.max(0, live.netMinutes - scheduled);

  return (
    <div className="space-y-5">
      <Card className="p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          {live.onBreak ? (
            <Badge cls="bg-amber-50 text-amber-700 border-amber-200">On break</Badge>
          ) : (
            <Badge cls="bg-indigo-50 text-indigo-700 border-indigo-200">Working</Badge>
          )}
          <span className="text-xs text-slate-400">since {formatTime(active.clockIn)}</span>
        </div>

        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Worked so far</p>
        <p className="text-5xl font-extrabold text-slate-900 mt-1 tabular-nums">
          {formatHMS(live.netSeconds)}
        </p>

        {live.onBreak && (
          <p className="text-sm text-amber-600 mt-2 tabular-nums">
            On break for {formatHMS(live.openBreakSeconds)}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {live.onBreak ? (
            <button
              disabled={busy}
              onClick={() => act(() => api.endBreak())}
              className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold shadow hover:bg-amber-400 active:scale-95 disabled:opacity-50"
            >
              End Break
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => act(() => api.startBreak())}
              className="px-6 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              Start Break
            </button>
          )}
          <button
            disabled={busy}
            onClick={onClockOut}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-blue-400 active:scale-95 disabled:opacity-50"
          >
            Clock Out
          </button>
        </div>
      </Card>

      {/* Break + overtime status tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Break taken</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{formatDuration(live.breakMinutes)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Required: {req}m</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Break status</p>
          <p className={`text-lg font-bold mt-1 ${req === 0 ? "text-slate-500" : breakOk ? "text-emerald-600" : "text-amber-600"}`}>
            {req === 0 ? "Not required yet" : breakOk ? "Compliant" : "Break due"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">6h → 15m · 9h → 30m</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Overtime so far</p>
          <p className={`text-lg font-bold mt-1 ${overtime > 0 ? "text-amber-600" : "text-slate-800"}`}>
            {formatDuration(overtime)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Norm: {formatDuration(scheduled)}</p>
        </Card>
      </div>
    </div>
  );
}
