import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as companyApi from "../../api/companyApi";
import { getErrorMessage } from "../../api/axiosClient";

// ── Async actions ────────────────────────────────────────────────────────────
export const fetchCompanies = createAsyncThunk(
  "companies/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      return await companyApi.fetchCompanies();
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load companies"));
    }
  }
);

export const fetchCompany = createAsyncThunk(
  "companies/fetchOne",
  async (id, { rejectWithValue }) => {
    try {
      return await companyApi.fetchCompany(id);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load company"));
    }
  }
);

export const saveCompany = createAsyncThunk(
  "companies/save",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      // If we have an id we update, otherwise we create.
      return id
        ? await companyApi.updateCompany(id, data)
        : await companyApi.createCompany(data);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to save company"));
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const companySlice = createSlice({
  name: "companies",
  initialState: {
    list: [],
    selected: null,
    loading: false,
    error: null,
    submitting: false,
    submitError: null,
    // The company the user is currently working with across pages.
    activeCompanyId: null,
  },
  reducers: {
    setActiveCompany: (state, action) => {
      state.activeCompanyId = action.payload;
    },
    clearSubmitError: (state) => {
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanies.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload?.companies ?? [];
        // Default the active company to the first one if none is chosen yet.
        if (!state.activeCompanyId && state.list.length) {
          state.activeCompanyId = state.list[0]._id;
        }
      })
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(fetchCompany.fulfilled, (state, action) => {
        state.selected = action.payload;
      })

      .addCase(saveCompany.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(saveCompany.fulfilled, (state, action) => {
        state.submitting = false;
        const saved = action.payload;
        const idx = state.list.findIndex((c) => c._id === saved._id);
        if (idx !== -1) state.list[idx] = saved;
        else state.list.unshift(saved);
        state.selected = saved;
      })
      .addCase(saveCompany.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload;
      });
  },
});

export const { setActiveCompany, clearSubmitError } = companySlice.actions;
export default companySlice.reducer;
