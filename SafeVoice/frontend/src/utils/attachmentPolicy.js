/**
 * Attachment policy — the ONE place the allowed file rules live on the frontend.
 *
 * These MUST mirror the SafeVoice backend (AllowedFileExtension enum + the 10 MB multipart
 * limit) so the browser never lets a user pick a file the server will only reject. Used by
 * both the report-submission uploader and the case-thread message composer.
 *
 * NOTE: ".jpeg" is intentionally NOT allowed — the backend enum has JPG only, so a file named
 * "photo.jpeg" would be rejected server-side. We reject it here too, to match exactly.
 */
export const ALLOWED_EXTENSIONS = ["PDF", "PNG", "JPG", "XML", "DOCX"];

// The matching HTML "accept" hint for the OS file picker (must mirror the list above).
export const ACCEPT_ATTR = ".pdf,.png,.jpg,.xml,.docx";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_FILES = 5; // total attachments per report/message

// Return the upper-case extension if it is one we accept, otherwise null.
export function allowedExtensionOf(name) {
  const ext = name && name.includes(".") ? name.split(".").pop().toUpperCase() : "";
  return ALLOWED_EXTENSIONS.includes(ext) ? ext : null;
}

// Human-friendly size label, e.g. "2.4 MB" / "812 KB".
export function formatSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate ONE file against the policy. Returns null when the file is fine, or an i18n key
 * ("evidence.*") describing the problem so the caller can show a translated message.
 */
export function validateFile(file) {
  if (!allowedExtensionOf(file.name)) return "evidence.unsupported";
  if (file.size === 0) return "evidence.empty";
  if (file.size > MAX_FILE_BYTES) return "evidence.tooLarge";
  return null;
}
