/**
 * Org slice — the signed-in user's own organisation details, for the Profile page.
 * Loaded from RegulaOne via orgService, per the project's Redux rules.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import orgService from "../services/orgService";

export const fetchMyOrg = createAsyncThunk("org/fetchMine", () => orgService.getMyOrg());

const orgSlice = createSlice({
  name: "org",
  initialState: { info: null, status: "idle", error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyOrg.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchMyOrg.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.info = a.payload;
      })
      .addCase(fetchMyOrg.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error?.message || "error";
      });
  },
});

export const selectMyOrg = (s) => s.org.info;
export const selectMyOrgStatus = (s) => s.org.status;

export default orgSlice.reducer;
