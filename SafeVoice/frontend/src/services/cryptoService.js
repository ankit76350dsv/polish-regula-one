/**
 * cryptoService — the BROWSER side of SafeVoice client-side encryption.
 *
 * SIMPLE IDEA:
 *   The report text is locked (encrypted) and unlocked (decrypted) right here in the browser,
 *   using the built-in Web Crypto API (AES-256-GCM). The server NEVER sees the readable text.
 *
 *   The browser never holds an AWS password. Instead it asks the SafeVoice backend for a
 *   one-time "data key" (see the /crypto endpoints). This is the safe way to do client-side
 *   encryption for a SaaS — unlike the demo that put AWS keys straight into the browser.
 *
 * HOW A KEY FLOWS (envelope encryption):
 *   1. Ask the backend for a data key → we get { plaintextKey, wrappedKey }.
 *   2. Lock the text with plaintextKey, then FORGET plaintextKey.
 *   3. Send { ciphertext, iv, wrappedKey } to the backend. It stores them; it cannot read them.
 *   To read later: send the wrappedKey back, the backend unwraps it via AWS KMS and returns the
 *   plaintextKey, and we unlock the text here.
 *
 * DEV NOTE:
 *   Web Crypto needs a "secure context" — https, or http://localhost (which dev uses). If the
 *   backend has no KMS key configured (local dev without AWS), the /crypto calls fail. Set
 *   VITE_SAFEVOICE_ALLOW_PLAINTEXT=true to let the app fall back to sending PLAIN text in that
 *   case (matches the backend's local-testing flag). It defaults to false so production always
 *   encrypts for real.
 */
import { publicApi, staffApi } from "./api";

// Dev-only escape hatch: when true AND encryption is unavailable, send plain text instead of
// failing. Mirrors the backend's safevoice.allow-plaintext-intake-for-local-testing flag.
const ALLOW_PLAINTEXT = import.meta.env.VITE_SAFEVOICE_ALLOW_PLAINTEXT === "true";

// The lock we use everywhere. AES with a 256-bit key in GCM mode (gives both secrecy and a
// built-in tamper check). The browser appends the GCM tag to the ciphertext automatically.
const ALGORITHM = "AES-256-GCM";
const IV_BYTES = 12; // 96-bit IV is the standard, recommended size for AES-GCM

// ── tiny base64 <-> bytes helpers (browser-safe, no Node Buffer) ──────────────────
function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000; // convert in chunks so a big file never blows the call stack
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Turn a base64 "data key" from the backend into a Web Crypto key object we can use.
async function importAesKey(base64Key) {
  const raw = base64ToBytes(base64Key);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// Lock one piece of text with a base64 data key. Returns the three parts we send to the backend.
async function aesEncrypt(plaintext, base64Key) {
  //! plaintextKey IS the base64Key
  const key = await importAesKey(base64Key);
  //? A fresh, random IV EVERY time — never reuse an IV with the same key (that breaks AES-GCM).
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return {
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
    iv: bytesToBase64(iv),
    algorithm: ALGORITHM,
  };
}

// Unlock one piece of text with a base64 data key + the stored iv. Returns the readable string.
async function aesDecrypt({ ciphertext, iv }, base64Key) {
  //! plaintextKey IS the base64Key
  const key = await importAesKey(base64Key);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  );
  return new TextDecoder().decode(plainBuffer);
}

// ── backend crypto endpoints ──────────────────────────────────────────────────────

//! Reporter (anonymous): A reporter asks for a new key to lock a report for a specific organisation (tenantId).
function fetchDataKeyPublic(tenantId) {
  return publicApi.post("/api/safevoice/crypto/data-key", { tenantId });
}

//! Staff (logged in): A staff member asks for a new key to lock a reply. Here the organisation comes from their login session, so no ID is needed.
function fetchDataKeyStaff() {
  return staffApi.post("/api/v1/internal/crypto/data-key", {});
}

//! Reporter: A reporter asks for the keys to read their own case. They prove it's them with their secret accessKey (the code they got when they filed the report).
function fetchCaseKeysPublic(accessKey) {
  return publicApi.post("/api/safevoice/crypto/case-keys", { accessKey });
}

//! Staff: a staff member asks for the keys to read one case. The backend automatically limits this to cases in their own organisation.
function fetchCaseKeysStaff(caseId) {
  return staffApi.get(`/api/v1/internal/crypto/case-keys/${encodeURIComponent(caseId)}`);
}
// ── high-level helpers the services use ────────────────────────────────────────────

/**
 * Lock text for a REPORTER submission/message. Returns either:
 *   { encrypted: { ciphertext, iv, wrappedKey, algorithm } }  (normal, secure path)
 *   { plaintext: text }                                        (dev fallback only)
 */
async function encryptForTenant(text, tenantId) {
  try {
    const { plaintextKey, wrappedKey } = await fetchDataKeyPublic(tenantId);
    const locked = await aesEncrypt(text, plaintextKey);
    return { encrypted: { ...locked, wrappedKey } };
  } catch (err) {
    if (ALLOW_PLAINTEXT) {
      console.warn("[cryptoService] encryption unavailable — sending PLAINTEXT (dev flag on).");
      return { plaintext: text };
    }
    throw err;
  }
}

/**
 * Lock text for a STAFF reply. Same return shape as encryptForTenant.
 */
async function encryptForStaff(text) {
  try {
    const { plaintextKey, wrappedKey } = await fetchDataKeyStaff();
    const locked = await aesEncrypt(text, plaintextKey);
    return { encrypted: { ...locked, wrappedKey } };
  } catch (err) {
    if (ALLOW_PLAINTEXT) {
      console.warn("[cryptoService] encryption unavailable — sending PLAINTEXT (dev flag on).");
      return { plaintext: text };
    }
    throw err;
  }
}

// Decrypt ONE message using an already-fetched keys bundle. If the message is not encrypted
// (plain text / a system notice) it is returned unchanged. On any failure we leave a clear
// placeholder instead of crashing the thread.
async function decryptMessageWithBundle(message, bundle) {
  if (!message?.encryptedText || !bundle) return message;
  const key = bundle.messageKeys?.[message.id];
  if (!key) return message;
  try {
    const text = await aesDecrypt(message.encryptedText, key);
    return { ...message, text };
  } catch (err) {
    console.error("[cryptoService] failed to decrypt message", message.id, err);
    return { ...message, text: "[unable to decrypt this message]" };
  }
}

// Decrypt a report's narrative into `description`, using an already-fetched keys bundle.
async function decryptReportWithBundle(report, bundle) {
  if (!report?.encryptedContent || !bundle?.contentKey) return report;
  try {
    const description = await aesDecrypt(report.encryptedContent, bundle.contentKey);
    return { ...report, description };
  } catch (err) {
    console.error("[cryptoService] failed to decrypt report", report.id, err);
    return { ...report, description: "[unable to decrypt this report]" };
  }
}

/**
 * REPORTER read: given the raw case + messages, fetch the case keys and return decrypted copies.
 * Used by the tracking page.
 */
async function decryptCaseForReporter(accessKey, report, messages) {
  const bundle = await fetchCaseKeysPublic(accessKey);
  const decReport = await decryptReportWithBundle(report, bundle);
  const decMessages = await Promise.all(
    (messages || []).map((m) => decryptMessageWithBundle(m, bundle)),
  );
  return { report: decReport, messages: decMessages };
}

/** STAFF read: fetch the case keys and decrypt the report narrative. */
async function decryptReportForStaff(caseId, report) {
  if (!report?.encryptedContent) return report;
  const bundle = await fetchCaseKeysStaff(caseId);
  return decryptReportWithBundle(report, bundle);
}

/** STAFF read: fetch the case keys and decrypt every message in a thread. */
async function decryptMessagesForStaff(caseId, messages) {
  const list = messages || [];
  // Only pay for the KMS call if at least one message is actually encrypted.
  if (!list.some((m) => m?.encryptedText)) return list;
  const bundle = await fetchCaseKeysStaff(caseId);
  return Promise.all(list.map((m) => decryptMessageWithBundle(m, bundle)));
}

/** REPORTER live message: decrypt one message that just arrived over WebSocket. */
async function decryptIncomingReporterMessage(message, accessKey) {
  if (!message?.encryptedText) return message;
  const bundle = await fetchCaseKeysPublic(accessKey);
  return decryptMessageWithBundle(message, bundle);
}

/** STAFF live message: decrypt one message that just arrived over WebSocket. */
async function decryptIncomingStaffMessage(message, caseId) {
  if (!message?.encryptedText) return message;
  const bundle = await fetchCaseKeysStaff(caseId);
  return decryptMessageWithBundle(message, bundle);
}

export const cryptoService = {
  encryptForTenant,
  encryptForStaff,
  decryptCaseForReporter,
  decryptReportForStaff,
  decryptMessagesForStaff,
  decryptIncomingReporterMessage,
  decryptIncomingStaffMessage,
};

export default cryptoService;
