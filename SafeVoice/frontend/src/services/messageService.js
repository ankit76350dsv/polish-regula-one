/**
 * Message service — the staff side of the secure two-way case thread.
 *
 * These are the INTERNAL compliance endpoints (/api/v1/internal/cases/{id}/messages),
 * so every call goes through `staffApi`, which authenticates with the shared idToken
 * cookie. The backend identifies the caller from that verified session and records the
 * message under their SafeVoice role, so we do not send a "sender" — only the text.
 *
 * (The anonymous reporter's own messages are handled separately, by reportService
 * through the public endpoint, so the two worlds never cross.)
 */
import { staffApi } from "./api";
import { cryptoService } from "./cryptoService";
import { normalizeMessage, normalizeMessages } from "./caseNormalizer";

export const messageService = {
  // Load the whole thread for one case (oldest first). Encrypted messages are UNLOCKED in the
  // browser (staff key path) before being normalised, so the chat shows the readable words.
  async list(caseId) {
    const messages = await staffApi.get(
      `/api/v1/internal/cases/${encodeURIComponent(caseId)}/messages`,
    );
    const decrypted = await cryptoService.decryptMessagesForStaff(caseId, messages);
    return normalizeMessages(decrypted);
  },

  // Post one staff message, optionally with evidence files. The text is LOCKED in the browser
  // first and sent as the encrypted parts (ciphertext/iv/wrappedKey). The sender is labelled from
  // the caller's verified session (not sent here).
  async send(caseId, { text, files = [] }) {
    const form = new FormData();
    let plaintextEcho = "";
    if (text && text.trim()) {
      const locked = await cryptoService.encryptForStaff(text);
      if (locked.encrypted) {
        form.append("ciphertext", locked.encrypted.ciphertext);
        form.append("iv", locked.encrypted.iv);
        form.append("wrappedKey", locked.encrypted.wrappedKey);
        form.append("algorithm", locked.encrypted.algorithm);
      } else {
        form.append("text", locked.plaintext); // dev fallback only
      }
      plaintextEcho = text;
    }
    files.forEach((file) => form.append("files", file));
    const message = await staffApi.postForm(
      `/api/v1/internal/cases/${encodeURIComponent(caseId)}/messages`,
      form,
    );
    // The server stores it encrypted and returns text=null; show the sender what they typed.
    const normalized = normalizeMessage(message);
    return { ...normalized, text: plaintextEcho || normalized.text };
  },

  // Fetch the bytes of one file attached to a thread message (staff side; gated to the
  // export roles server-side). Returns { blob, filename } for preview + download in the modal.
  fetchAttachment(caseId, messageId, attachmentId) {
    return staffApi.downloadFile(
      `/api/v1/internal/cases/${encodeURIComponent(caseId)}/messages/${encodeURIComponent(
        messageId,
      )}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  },
};

export default messageService;
