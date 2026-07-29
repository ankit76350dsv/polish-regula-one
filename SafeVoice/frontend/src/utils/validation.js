/**
 * Tiny, framework-free form validation helpers.
 *
 * Each validator returns either `null` (valid) or an object describing the i18n
 * error key + params, e.g. { key: "validation.minLength", params: { count: 20 } }.
 * Pages translate that with t(err.key, err.params). Keeping validation here means
 * every form reports errors the same way and the rules live in one testable place.
 *
 * NOTE: client-side validation is for UX only. The backend MUST re-validate every
 * field — frontend checks can always be bypassed (a core security requirement).
 */
const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "xml", "docx"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function required(value) {
  return value == null || String(value).trim() === "" ? { key: "validation.required" } : null;
}

export function minLength(value, count) {
  return String(value || "").trim().length < count
    ? { key: "validation.minLength", params: { count } }
    : null;
}

export function maxLength(value, count) {
  return String(value || "").length > count
    ? { key: "validation.maxLength", params: { count } }
    : null;
}

export function notFutureDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d > today ? { key: "validation.futureDate" } : null;
}

export function email(value) {
  if (!value) return null;
  // Pragmatic email shape check (server is the source of truth).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : { key: "validation.email" };
}

export function fileType(name) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext) ? null : { key: "validation.fileType" };
}

export function fileSize(bytes) {
  return bytes > MAX_FILE_BYTES ? { key: "validation.fileSize" } : null;
}

// Run several validators against one value; return the FIRST error or null.
export function firstError(value, validators) {
  for (const v of validators) {
    const result = v(value);
    if (result) return result;
  }
  return null;
}
