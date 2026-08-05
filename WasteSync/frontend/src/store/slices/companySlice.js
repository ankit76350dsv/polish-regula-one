import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as companyApi from "../../api/companyApi";
import { getErrorMessage } from "../../api/axiosClient";

// Company state.
//
// WHAT CHANGED AND WHY
// This slice used to hold a LIST of companies, a "selected" one, an
// activeCompanyId that other pages filtered by, and a saveCompany action.
// All of that is gone.
//
// The customer's company is registered once in the central RegulaOne platform.
// One customer = one company, so there is no list to keep and nothing to choose
// between. Waste entries and reports are scoped by the tenant, which the backend
// takes from the session — the browser never picks a company id any more.
//
// What is left: the profile (read live from RegulaOne) and the one value
// WasteSync owns, the 9-digit BDO number.

// ── Async actions ────────────────────────────────────────────────────────────
export const fetchCompanyProfile = createAsyncThunk(
  "companies/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      return await companyApi.fetchCompanyProfile();
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load your company profile"));
    }
  }
);

export const saveBdoNumber = createAsyncThunk(
  "companies/saveBdoNumber",
  async (bdoRegistrationNumber, { rejectWithValue }) => {
    try {
      return await companyApi.updateBdoNumber(bdoRegistrationNumber);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to save the BDO number"));
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const companySlice = createSlice({
  name: "companies",
  initialState: {
    // The company as RegulaOne holds it, plus our BDO number.
    profile: null,
    loading: false,
    error: null,
    // true while no BDO number has been entered yet; reports are blocked.
    bdoRegistrationMissing: false,
    // The BDO save form.
    submitting: false,
    submitError: null,
  },
  reducers: {
    clearSubmitError: (state) => {
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanyProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanyProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload?.company ?? null;
        state.bdoRegistrationMissing = action.payload?.bdoRegistrationMissing ?? false;
      })
      .addCase(fetchCompanyProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(saveBdoNumber.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(saveBdoNumber.fulfilled, (state, action) => {
        state.submitting = false;
        state.profile = action.payload?.company ?? state.profile;
        state.bdoRegistrationMissing = action.payload?.bdoRegistrationMissing ?? false;
      })
      .addCase(saveBdoNumber.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload;
      });
  },
});

export const { clearSubmitError } = companySlice.actions;
export default companySlice.reducer;
