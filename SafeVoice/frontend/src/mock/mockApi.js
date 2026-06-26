/**
 * MOCK API — a fake backend that lives in the browser.
 *
 * SIMPLE EXPLANATION:
 * Every function here pretends to be a network call: it waits a moment (so we see
 * real loading states), then returns data from the in-memory store, or throws an
 * Error the UI can show. State changes (new report, sent message, status update)
 * are kept in memory for the session, so the app behaves like a real product.
 *
 * The service layer (src/services/*) decides — based on config.USE_MOCK — whether
 * to call these functions or the real HTTP client. Components never import this
 * file directly; they go through services + Redux.
 */
import { MOCK_LATENCY_MS } from "../config";
import * as seed from "./db";

// ── In-memory store ──────────────────────────────────────────────────────────
// We deep-clone the seed so edits during a session never mutate the source data.
const store = {
  reports: structuredClone(seed.reports),
  messages: structuredClone(seed.messages),
  users: structuredClone(seed.users),
  auditLogs: structuredClone(seed.auditLogs),
};

// Wait `ms` milliseconds — used to simulate network latency.
const wait = (ms = MOCK_LATENCY_MS) => new Promise((resolve) => setTimeout(resolve, ms));

// A readable error the UI can display (mirrors how services/api.js throws).
function fail(message, errorCode = "MOCK_ERROR") {
  const err = new Error(message);
  err.errorCode = errorCode;
  return err;
}

// A timestamp in the same "YYYY-MM-DD HH:mm" shape the seed data uses.
function now() {
  return new Date().toISOString().replace("T", " ").substring(0, 16);
}

// Add `days` to today and return a "YYYY-MM-DD HH:mm" string.
function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().replace("T", " ").substring(0, 16);
}

// Generate a high-entropy-looking tracking code, e.g. "SV-A1B2-C3D4".
// NOTE: a real PIN/code MUST be generated server-side with a CSPRNG and stored
// only as a hash. This client-side generator is for the mock phase only.
function makeTrackingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no easily confused chars
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `SV-${block()}-${block()}`;
}

function makePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function pushAudit(entry) {
  store.auditLogs.unshift({
    id: `aud-${store.auditLogs.length + 1}-${Date.now()}`,
    timestamp: now().replace(" ", " ") + ":00",
    outcome: "Allowed",
    hashChain: `seal-${store.auditLogs.length + 1}`,
    ...entry,
  });
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const mockApi = {
  async me() {
    await wait(300);
    return structuredClone(seed.mockCurrentUser);
  },

  // ── Public report submission ──────────────────────────────────────────────
  async createReport(payload) {
    await wait();
    const isHrOnly = seed.HR_ONLY_CATEGORIES.includes(payload.category);
    const seq = String(store.reports.length + 1).padStart(3, "0");
    const id = `SV-2026-${seq}`;

    // HR grievances are routed to HR with NO tracking PIN (matches the law's scope).
    const trackingCode = isHrOnly ? "Not issued" : makeTrackingCode();
    const pin = isHrOnly ? null : makePin();

    const report = {
      id,
      trackingCode,
      pin,
      category: payload.category,
      description: payload.facts,
      incidentDate: payload.incidentDate,
      department: payload.area,
      status: "Received",
      severity: "Medium",
      submissionDate: now(),
      acknowledgementDue: plusDays(7),
      feedbackDue: plusDays(90),
      assignedInvestigator: isHrOnly ? "Katarzyna Mazur" : "Unassigned",
      disclosureMode: isHrOnly ? "HR Handoff" : "Anonymous",
      intakeChannel: payload.channel === "oral" ? "Confidential phone line" : "Anonymous web portal",
      lawfulBasis: "Legal obligation and protected follow-up under the Poland 2024 Act",
      controller: "DSV Corporation Pty Ltd - RegulaOne Poland",
      processor: "SafeVoice EEA Processing Cluster",
      riskFlags: payload.requestMeeting ? ["Meeting requested"] : [],
      attachments: (payload.attachments || []).map((a, i) => ({
        id: `${id}-ev-${i + 1}`,
        displayName: a.displayName,
        sizeLabel: a.sizeLabel,
      })),
      retention: {
        state: "Active",
        retentionYears: 3,
        deleteAfter: plusDays(365 * 3),
        irrelevantPersonalDataDeletionDue: plusDays(14),
      },
      timeline: [
        {
          id: `${id}-tl-1`,
          title: "Report received",
          description: "Intake accepted without IP, device, browser, or geolocation storage.",
          timestamp: now(),
          type: "system",
        },
      ],
    };
    store.reports.unshift(report);
    pushAudit({
      actorRole: "System",
      actorRef: "intake-service",
      actionType: "REPORT_RECEIVED",
      subjectId: id,
      metadataNotice: "No reporter telemetry captured.",
    });
    return { caseId: id, trackingCode, pin, isHrOnly };
  },

  // Anonymous reporter looks up their case by tracking code + PIN.
  async trackReport(trackingCode, pin) {
    await wait();
    const report = store.reports.find(
      (r) => r.trackingCode === (trackingCode || "").trim() && r.pin && r.pin === (pin || "").trim(),
    );
    if (!report) throw fail("NOT_FOUND", "NOT_FOUND");
    const thread = store.messages.filter((m) => m.caseId === report.id);
    return { report: structuredClone(report), messages: structuredClone(thread) };
  },

  // ── Staff: cases ──────────────────────────────────────────────────────────
  async listReports() {
    await wait();
    return structuredClone(store.reports);
  },

  async getReport(id) {
    await wait();
    const report = store.reports.find((r) => r.id === id);
    if (!report) throw fail("NOT_FOUND", "NOT_FOUND");
    return structuredClone(report);
  },

  async updateReport(id, patch) {
    await wait(400);
    const report = store.reports.find((r) => r.id === id);
    if (!report) throw fail("NOT_FOUND", "NOT_FOUND");
    const [field, value] = Object.entries(patch)[0] ?? [];
    if (field) {
      const old = report[field];
      report[field] = value;
      report.timeline = [
        ...(report.timeline || []),
        {
          id: `${id}-tl-${(report.timeline?.length || 0) + 1}`,
          title: `${field} updated`,
          description: `${field} changed from "${old}" to "${value}".`,
          timestamp: now(),
          type: "status",
        },
      ];
      pushAudit({
        actorRole: "Compliance Officer",
        actorRef: "usr-2",
        actionType: `${field.toUpperCase()}_UPDATED`,
        subjectId: id,
        oldValue: String(old),
        newValue: String(value),
        metadataNotice: "Change recorded in the immutable audit trail.",
      });
    }
    return structuredClone(report);
  },

  // ── Messages ────────────────────────────────────────────────────────────
  async listMessages(caseId) {
    await wait(400);
    return structuredClone(store.messages.filter((m) => m.caseId === caseId));
  },

  async sendMessage(caseId, { sender, text }) {
    await wait(400);
    if (!text || !text.trim()) throw fail("EMPTY_MESSAGE", "VALIDATION");
    const message = {
      id: `msg-${caseId}-${Date.now()}`,
      caseId,
      sender,
      text: text.trim(),
      timestamp: now(),
      attachments: [],
    };
    store.messages.push(message);
    pushAudit({
      actorRole: sender === "Anonymous Whistleblower" ? "Reporter" : "Compliance Officer",
      actorRef: sender === "Anonymous Whistleblower" ? "anonymous" : "usr-2",
      actionType: "MESSAGE_SENT",
      subjectId: caseId,
      metadataNotice: "Message content is confidential and not shown in the audit trail.",
    });
    return structuredClone(message);
  },

  // ── Users & permissions ─────────────────────────────────────────────────
  async listUsers() {
    await wait();
    return { users: structuredClone(store.users), rolePermissions: structuredClone(seed.rolePermissions) };
  },

  async inviteUser({ name, email, role }) {
    await wait(400);
    const user = {
      id: `usr-${store.users.length + 1}-${Date.now()}`,
      name,
      email,
      role,
      status: "Pending",
      mfaRequired: true,
      lastLoginReview: "Not activated",
    };
    store.users.push(user);
    pushAudit({
      actorRole: "Super Admin",
      actorRef: "usr-1",
      actionType: "OFFICER_INVITED",
      subjectId: user.id,
      newValue: email,
      metadataNotice: "Invitation issued; account pending activation.",
    });
    return structuredClone(user);
  },

  async removeUser(id) {
    await wait(400);
    store.users = store.users.filter((u) => u.id !== id);
    pushAudit({
      actorRole: "Super Admin",
      actorRef: "usr-1",
      actionType: "OFFICER_ACCESS_REMOVED",
      subjectId: id,
      metadataNotice: "Access revoked immediately.",
    });
    return { id };
  },

  // ── Audit & settings ──────────────────────────────────────────────────────
  async listAudit() {
    await wait();
    return structuredClone(store.auditLogs);
  },

  async getSettings() {
    await wait();
    return { complianceReview: structuredClone(seed.complianceReview) };
  },

  // ── Compliance: data subject request (mock acknowledgement) ────────────────
  async submitDataRequest(payload) {
    await wait();
    pushAudit({
      actorRole: "System",
      actorRef: "dsr-service",
      actionType: "DATA_SUBJECT_REQUEST",
      subjectId: payload.type,
      metadataNotice: "Request logged for handling within one month (Art. 12 GDPR).",
    });
    return { received: true };
  },
};

export default mockApi;
