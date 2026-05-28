import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

// SafeWork backend runs on 3001; RegulaOne (auth) runs on 8080
const API_BASE_URL = "http://localhost:3001/api";

const authHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Fetches all RegulaOne users for the tenant merged with their EmployeeProfile
// compliance data. Users without a profile are returned with profileMissing: true.
export const fetchEmployees = createAsyncThunk(
  "employees/fetchAll",
  async (_, { getState, rejectWithValue }) => {
    try {
      const tenantId = getState().auth.user?.tenantId;
      
      if (!tenantId) return rejectWithValue("No tenantId found in auth state");

      const response = await axios.get(`${API_BASE_URL}/admin/users/${tenantId}`, {
        withCredentials: true,
        headers: authHeaders(),
      });

      // Backend wraps in { success, message, data: { count, employees: [...] } } — unwrap to array
      return response.data?.data?.employees ?? response.data?.data ?? response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch employees");
    }
  }
);

// Creates or updates the compliance profile for a RegulaOne user.
// employeeId is the user's _id from RegulaOne.
// profileData contains only compliance/employment fields — identity fields are
// stripped on the backend so they are safe (but not required) to omit here.
export const upsertProfile = createAsyncThunk(
  "employees/upsertProfile",
  async ({ employeeId, profileData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/employees/${employeeId}`,
        profileData,
        {
          withCredentials: true,
          headers: authHeaders(),
        }
      );
      return response.data?.data ?? response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to save employee profile");
    }
  }
);

const employeeSlice = createSlice({
  name: "employees",
  initialState: {
    list: [],
    loading: false,
    error: null,
    submitting: false,
    submitError: null,
  },
  reducers: {
    clearEmployees: (state) => {
      state.list = [];
      state.error = null;
    },
    clearSubmitError: (state) => {
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(upsertProfile.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(upsertProfile.fulfilled, (state, action) => {
        state.submitting = false;
        // Merge updated compliance fields back into the list entry (keep user identity)
        const updated = action.payload;
        const idx = state.list.findIndex((e) => e._id === updated._id || e.userId?.toString() === updated.userId?.toString());
        if (idx !== -1) {
          state.list[idx] = { ...state.list[idx], ...updated };
        }
      })
      .addCase(upsertProfile.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload;
      });
  },
});

export const { clearEmployees, clearSubmitError } = employeeSlice.actions;
export default employeeSlice.reducer;
