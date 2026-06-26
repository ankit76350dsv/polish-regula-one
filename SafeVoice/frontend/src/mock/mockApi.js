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
import { caseRefFromHash, generateAccessKey, sha256Hex } from "../utils/accessKey";

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

    // The ONE credential: a single 64-char hex key. It is the case identifier AND
    // the access token. We store ONLY its SHA-256 fingerprint, never the key.
    // HR grievances are routed to HR and get NO anonymous key (matches the law's scope).
    const accessKey = isHrOnly ? null : generateAccessKey();
    const keyHash = accessKey ? await sha256Hex(accessKey) : null;

    // The case reference shown to STAFF is derived from the fingerprint, so it is
    // not a separately generated id and never reveals the key.
    const id = keyHash ? caseRefFromHash(keyHash) : `HR-${store.reports.length + 1}`;

    const report = {
      id,
      keyHash,
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
      metadataNotice: "No reporter telemetry captured. Access key stored as a hash only.",
    });
    // The plaintext key is returned ONCE here for display, then forgotten by the system.
    return { accessKey, isHrOnly };
  },

  // Anonymous reporter looks up their case using ONLY the access key. We hash the
  // provided key and match it against the stored fingerprint — the plaintext key
  // is never stored or compared directly.
  async trackReport(accessKey) {
    await wait();
    const hash = await sha256Hex((accessKey || "").trim());
    const report = store.reports.find((r) => r.keyHash && r.keyHash === hash);
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
