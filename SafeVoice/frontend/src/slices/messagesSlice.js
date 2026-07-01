/**
 * Messages slice — the secure two-way thread for a case, used by the staff
 * "Secure inbox" and "Case details" screens. Threads are kept per case id.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import messageService from "../services/messageService";

export const fetchMessages = createAsyncThunk("messages/fetch", async (caseId) => {
  const messages = await messageService.list(caseId);
  return { caseId, messages };
});

export const sendMessage = createAsyncThunk("messages/send", async ({ caseId, sender, text }) => {
  const message = await messageService.send(caseId, { sender, text });
  return { caseId, message };
});

const messagesSlice = createSlice({
  name: "messages",
  initialState: {
    byCase: {}, // { [caseId]: Message[] }
    status: "idle",
    sending: false,
    sendError: null,
    // When the user jumps from a case's detail page to the inbox, we remember which
    // case to open so the inbox can preselect that thread. Cleared once consumed.
    selectedThreadId: null,
  },
  reducers: {
    // Remember which case thread the inbox should open next.
    selectThread(state, action) {
      state.selectedThreadId = action.payload;
    },
    // Forget the remembered thread (after the inbox has used it).
    clearSelectedThread(state) {
      state.selectedThreadId = null;
    },
    // A message arrived live over WebSocket for a case. Append it to that case's thread,
    // unless it is already there (the sender also receives their own broadcast, and the
    // REST reply may have added it first) — so messages never appear twice.
    messageReceived(state, action) {
      const { caseId, message } = action.payload;
      if (!caseId || !message?.id) return;
      const thread = state.byCase[caseId] || (state.byCase[caseId] = []);
      if (!thread.some((m) => m.id === message.id)) {
        thread.push(message);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (s) => {
        s.status = "loading";
      })
      .addCase(fetchMessages.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.byCase[a.payload.caseId] = a.payload.messages;
      })
      .addCase(fetchMessages.rejected, (s) => {
        s.status = "failed";
      })
      .addCase(sendMessage.pending, (s) => {
        s.sending = true;
        s.sendError = null;
      })
      .addCase(sendMessage.fulfilled, (s, a) => {
        s.sending = false;
        const { caseId, message } = a.payload;
        const thread = s.byCase[caseId] || (s.byCase[caseId] = []);
        // Dedup: the live WebSocket broadcast may have already added this message.
        if (!thread.some((m) => m.id === message.id)) {
          thread.push(message);
        }
      })
      .addCase(sendMessage.rejected, (s, a) => {
        s.sending = false;
        s.sendError = a.error?.message || "error";
      });
  },
});

export const { selectThread, clearSelectedThread, messageReceived } = messagesSlice.actions;

export const selectMessagesFor = (caseId) => (s) => s.messages.byCase[caseId] || [];
export const selectMessagesStatus = (s) => s.messages.status;
export const selectSending = (s) => s.messages.sending;
export const selectSelectedThreadId = (s) => s.messages.selectedThreadId;

export default messagesSlice.reducer;
