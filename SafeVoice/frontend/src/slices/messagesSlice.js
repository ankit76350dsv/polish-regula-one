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
  },
  reducers: {},
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
        s.byCase[caseId] = [...(s.byCase[caseId] || []), message];
      })
      .addCase(sendMessage.rejected, (s, a) => {
        s.sending = false;
        s.sendError = a.error?.message || "error";
      });
  },
});

export const selectMessagesFor = (caseId) => (s) => s.messages.byCase[caseId] || [];
export const selectMessagesStatus = (s) => s.messages.status;
export const selectSending = (s) => s.messages.sending;

export default messagesSlice.reducer;
