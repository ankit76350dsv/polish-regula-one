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
import { normalizeMessage, normalizeMessages } from "./caseNormalizer";

export const messageService = {
  // Load the whole thread for one case (oldest first), with friendly timestamps.
  async list(caseId) {
    const messages = await staffApi.get(
      `/api/v1/internal/cases/${encodeURIComponent(caseId)}/messages`,
    );
    return normalizeMessages(messages);
  },

  // Post one staff message, optionally with evidence files. The internal endpoint is
  // multipart: a "text" field plus zero or more "files" parts. The sender is labelled
  // from the caller's verified session (not sent here).
  async send(caseId, { text, files = [] }) {
    const form = new FormData();
    form.append("text", text ?? "");
    files.forEach((file) => form.append("files", file));
    const message = await staffApi.postForm(
      `/api/v1/internal/cases/${encodeURIComponent(caseId)}/messages`,
      form,
    );
    return normalizeMessage(message);
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
