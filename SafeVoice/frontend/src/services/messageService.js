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

  // Post one staff message. The internal endpoint takes the raw text as a plain-string
  // body and labels the sender from the caller's session (not from any header), so we
  // send just the text (as text/plain, via postText).
  async send(caseId, { text }) {
    const message = await staffApi.postText(
      `/api/v1/internal/cases/${encodeURIComponent(caseId)}/messages`,
      text,
    );
    return normalizeMessage(message);
  },
};

export default messageService;
