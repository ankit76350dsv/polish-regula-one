/**
 * Settings slice — compliance review decisions shown on the settings page, plus
 * the GDPR data-subject-request submission used by the public privacy pages.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import settingsService from "../services/settingsService";

export const fetchSettings = createAsyncThunk("settings/fetch", () => settingsService.get());

export const submitDataRequest = createAsyncThunk("settings/dataRequest", (payload) =>
  settingsService.submitDataRequest(payload),
);

const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    complianceReview: [],
    status: "idle",
    error: null,
    dataRequestStatus: "idle",
  },
  reducers: {
    resetDataRequest(state) {
      state.dataRequestStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchSettings.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.complianceReview = a.payload.complianceReview;
      })
      .addCase(fetchSettings.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error?.message || "error";
      })
      .addCase(submitDataRequest.pending, (s) => {
        s.dataRequestStatus = "loading";
      })
      .addCase(submitDataRequest.fulfilled, (s) => {
        s.dataRequestStatus = "succeeded";
      })
      .addCase(submitDataRequest.rejected, (s) => {
        s.dataRequestStatus = "failed";
      });
  },
});

export const { resetDataRequest } = settingsSlice.actions;
export const selectComplianceReview = (s) => s.settings.complianceReview;
export const selectSettingsStatus = (s) => s.settings.status;
export const selectDataRequestStatus = (s) => s.settings.dataRequestStatus;

export default settingsSlice.reducer;
