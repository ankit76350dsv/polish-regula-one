/**
 * Access-key helpers for the anonymous whistleblower channel.
 *
 * SIMPLE EXPLANATION:
 * When someone files a report we create ONE long secret key (64 hex characters).
 * That key is the only thing the reporter ever gets — it is both the case's
 * identifier AND the password to view it. We show it once and never again.
 *
 * We NEVER keep the key itself. We keep only its SHA-256 "fingerprint" (hash).
 * To check a key later we hash what the user types and compare fingerprints, so
 * even the stored data cannot reveal anyone's key. This preserves full anonymity.
 *
 * NOTE: in production this generation + hashing happens on the SERVER with a
 * cryptographically secure RNG; the browser only displays the key the server
 * returns. Here (mock phase) the mock "backend" does it with the Web Crypto API,
 * which is also a CSPRNG — so the contract is identical when the real API lands.
 */

// Turn a byte array into a lowercase hex string.
function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate one cryptographically secure 64-character hex key (32 random bytes).
export function generateAccessKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

// SHA-256 fingerprint (hex) of any string — what we store/compare instead of the key.
export async function sha256Hex(message) {
  const data = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

// A short, non-secret case reference DERIVED from the key's fingerprint (not a
// separately generated id). Staff use this to refer to a case; it never reveals
// the key and is a one-way function of it.
export function caseRefFromHash(keyHash) {
  return `SV-${keyHash.slice(0, 10).toUpperCase()}`;
}

// True if the string looks like a valid 64-char hex access key (UX validation only).
export function looksLikeAccessKey(value) {
  return /^[0-9a-fA-F]{64}$/.test((value || "").trim());
}
