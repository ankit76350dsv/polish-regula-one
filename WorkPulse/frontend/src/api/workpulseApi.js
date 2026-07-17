// WorkPulse backend API client.
//
// All calls go to the WorkPulse backend on :8085 and send the shared auth
// cookie (credentials: "include"). The backend reads the tenant from that
// session, so the frontend never sends a tenantId. Every response is wrapped as
// { success, data, message }; this helper unwraps `data` (or throws the error
// message) so pages get clean values.

const WORKPULSE_API =
  (import.meta.env.VITE_WORKPULSE_API_URL ?? "http://localhost:8085") + "/api";

// Low-level request helper. method/path/body in, unwrapped data out.
async function request(path, { method = "GET", body } = {}) {
  const options = {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  const response = await fetch(`${WORKPULSE_API}${path}`, options);
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Surface the backend's message (e.g. the clock-in block reason).
    const message = json?.message || `Server error: ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = json;
    throw err;
  }

  return json?.data ?? json;
}

// ── Clock / time tracking (self-service) ─────────────────────────────────────
export const getEligibility = () => request("/time/eligibility");
export const getStatus = () => request("/time/status");
export const clockIn = (source = "WEB") => request("/time/clock-in", { method: "POST", body: { source } });
export const clockOut = (source = "WEB") => request("/time/clock-out", { method: "POST", body: { source } });
export const startBreak = () => request("/time/break/start", { method: "POST" });
export const endBreak = () => request("/time/break/end", { method: "POST" });
export const getMyEntries = (params = {}) => request(`/time/my-entries${qs(params)}`);

// ── Time records (admin / HR) ────────────────────────────────────────────────
export const listEntries = (params = {}) => request(`/time/entries${qs(params)}`);
export const getEntry = (id) => request(`/time/entries/${id}`);
export const correctEntry = (id, body) => request(`/time/entries/${id}/correct`, { method: "PATCH", body });
export const decideOvertime = (id, body) => request(`/time/entries/${id}/overtime`, { method: "PATCH", body });

// ── Working time policy ──────────────────────────────────────────────────────
export const getPolicy = () => request("/policy");
export const updatePolicy = (body) => request("/policy", { method: "PUT", body });

// ── Absences ─────────────────────────────────────────────────────────────────
export const createAbsence = (body) => request("/absences", { method: "POST", body });
export const getMyAbsences = () => request("/absences/mine");
export const listAbsences = (params = {}) => request(`/absences${qs(params)}`);
export const decideAbsence = (id, status) => request(`/absences/${id}/decision`, { method: "PATCH", body: { status } });

// ── Dashboard & reports ──────────────────────────────────────────────────────
export const getOverview = () => request("/dashboard/overview");
export const getMonthly = (year, month) => request(`/dashboard/monthly${qs({ year, month })}`);

// ── Audit trail ──────────────────────────────────────────────────────────────
export const getAuditLogs = (params = {}) => request(`/audit-logs${qs(params)}`);

// ── Notifications ────────────────────────────────────────────────────────────
export const getNotifications = (params = {}) => request(`/notifications${qs(params)}`);
export const markNotificationRead = (id) => request(`/notifications/${id}/read`, { method: "PATCH" });

// Build a query string, skipping empty values.
function qs(params) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}
