import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API_BASE_URL = "http://localhost:8082/api";

const authHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Fetches all SafeWork employees for the tenant (merged with RegulaOne user data).
//
// OLD: accepted no arguments — filtering was done on the frontend with useMemo.
// NEW: accepts an optional filters object and passes them as query params so
//      the backend does the filtering. Returns { employees, summary } where
//      summary contains unfiltered tenant-wide counts for the dashboard cards.
//
// filters shape: { search?, department?, site?, complianceStatus?, page?, limit? }
export const fetchEmployees = createAsyncThunk(
  "employees/fetchAll",
  async (filters = {}, { getState, rejectWithValue }) => {
    try {
      const tenantId = getState().auth.user?.tenantId;
      if (!tenantId) return rejectWithValue("No tenantId found in auth state");

      // Build the query string — only include params that have a real value.
      const params = new URLSearchParams();
      if (filters.search)           params.set("search",           filters.search);
      if (filters.department)       params.set("department",       filters.department);
      if (filters.site)             params.set("site",             filters.site);
      if (filters.complianceStatus) params.set("complianceStatus", filters.complianceStatus);
      if (filters.page)             params.set("page",             String(filters.page));
      if (filters.limit)            params.set("limit",            String(filters.limit));

      const qs = params.toString();
      const url = `${API_BASE_URL}/admin/users/${tenantId}${qs ? `?${qs}` : ""}`;

      const response = await axios.get(url, {
        withCredentials: true,
        headers: authHeaders(),
      });

      // Backend wraps in { success, message, data: { count, employees, summary } }
      return response.data?.data ?? response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch employees");
    }
  }
);

// Fetches a single SafeWork employee by its SafeWork_Employee _id.
// Used by the profile detail page.
export const fetchEmployee = createAsyncThunk(
  "employees/fetchOne",
  async (profileId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/employees/${profileId}`, {
        withCredentials: true,
        headers: authHeaders(),
      });
      return response.data?.data ?? response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch employee");
    }
  }
);

// Creates or updates the compliance profile for a RegulaOne user.
// employeeId is the RegulaOne user _id (used as the SafeWork employeeId field).
// Added getState so tenantId can be included in the body — the backend needs it
// to write a correct audit log (req.user.tenant is a Java DBRef and .toString()
// returns "[object Object]", so the body value is the safe primary source).
export const upsertProfile = createAsyncThunk(
  "employees/upsertProfile",
  async ({ employeeId, profileData }, { getState, rejectWithValue }) => {
    try {
      const tenantId = getState().auth.user?.tenantId;
      const response = await axios.put(
        `${API_BASE_URL}/admin/employees/${employeeId}`,
        { ...profileData, tenantId },
        { withCredentials: true, headers: authHeaders() }
      );
      return response.data?.data ?? response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to save employee profile");
    }
  }
);

// Uploads a compliance document to S3 via a pre-signed URL, then saves the S3 key.
// Workflow: get pre-signed URL → PUT to S3 → PATCH document reference to backend.
// Status is no longer accepted — the backend auto-calculates it from expiryDate.
export const uploadDocument = createAsyncThunk(
  "employees/uploadDocument",
  async (
    { profileId, docType, file, expiryDate, completedDate },
    // Added getState so we can pass tenantId in the PATCH body.
    // The backend needs the correct tenantId string to store in AuditLog so the
    // dashboard's recentDocuments query can find it.  Using getState avoids relying
    // on req.user.tenant (which is a Java DBRef object and breaks plain .toString()).
    { getState, rejectWithValue }
  ) => {
    try {
      if (!profileId) {
        return rejectWithValue("profileId is required");
      }

      if (!docType) {
        return rejectWithValue("docType is required");
      }

      if (!file) {
        return rejectWithValue("File is required");
      }

      // Read tenantId from Redux auth state — this is always the clean ObjectId string.
      const tenantId = getState().auth.user?.tenantId;

      const contentType = file.type || "application/octet-stream";

      // Step 1: get pre-signed S3 PUT URL
      const urlRes = await axios.get(
        `${API_BASE_URL}/admin/employees/${profileId}/upload-url`,
        {
          params: {
            docType,
            fileName: file.name,
            contentType,
          },
          withCredentials: true,
          headers: authHeaders(),
        }
      );

      const { uploadUrl, s3Key } = urlRes.data?.data ?? urlRes.data;

      if (!uploadUrl || !s3Key) {
        return rejectWithValue("Upload URL generation failed");
      }

      // Step 2: upload file directly to S3
      // Important: do not send Authorization or cookies to S3.
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": contentType,
        },
        withCredentials: false,
      });

      // Step 3: save S3 key reference in backend.
      // status is omitted — the backend derives it automatically from expiryDate.
      // tenantId is included so the backend logAudit call stores the correct value
      // regardless of the DBRef shape on req.user.tenant.
      const patchRes = await axios.patch(
        `${API_BASE_URL}/admin/employees/${profileId}/document`,
        {
          docType,
          s3Key,
          expiryDate,
          completedDate,
          tenantId,
        },
        {
          withCredentials: true,
          headers: authHeaders(),
        }
      );

      return patchRes.data?.data ?? patchRes.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Document upload failed"
      );
    }
  }
);

const employeeSlice = createSlice({
  name: "employees",
  initialState: {
    list: [],
    // pagination metadata returned by the backend for the current page/filter.
    pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    // summary: compliance counts across ALL filtered employees (not just one page).
    // Used by the dashboard cards so they reflect the full filtered set.
    summary: { total: 0, compliant: 0, expiring: 0, blocked: 0 },
    loading: false,
    error: null,
    // Single employee detail state
    selected: null,
    selectedLoading: false,
    selectedError: null,
    // Mutation states
    submitting: false,
    submitError: null,
    uploading: false,
    uploadError: null,
  },
  reducers: {
    clearEmployees: (state) => {
      state.list = [];
      state.error = null;
    },
    clearSelected: (state) => {
      state.selected = null;
      state.selectedError = null;
    },
    clearSubmitError: (state) => {
      state.submitError = null;
    },
    clearUploadError: (state) => {
      state.uploadError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAll
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;
        // Backend returns { count, employees, pagination, summary }.
        // Falls back to plain-array shape for safety.
        if (action.payload?.employees) {
          state.list       = action.payload.employees;
          if (action.payload.pagination) state.pagination = action.payload.pagination;
          if (action.payload.summary)    state.summary    = action.payload.summary;
        } else {
          state.list = Array.isArray(action.payload) ? action.payload : [];
        }
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // fetchOne
      .addCase(fetchEmployee.pending, (state) => {
        state.selectedLoading = true;
        state.selectedError = null;
      })
      .addCase(fetchEmployee.fulfilled, (state, action) => {
        state.selectedLoading = false;
        state.selected = action.payload;
      })
      .addCase(fetchEmployee.rejected, (state, action) => {
        state.selectedLoading = false;
        state.selectedError = action.payload;
      })

      // upsertProfile
      .addCase(upsertProfile.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(upsertProfile.fulfilled, (state, action) => {
        state.submitting = false;
        const updated = action.payload;
        // Patch the list so EmployeeList stays fresh without a full refetch
        const idx = state.list.findIndex(
          (e) => e._id === updated._id || e.userId?.toString() === updated.userId?.toString()
        );
        if (idx !== -1) state.list[idx] = { ...state.list[idx], ...updated };
        // Also update selected if it matches
        if (state.selected && state.selected._id === updated._id) {
          state.selected = { ...state.selected, ...updated };
        }
      })
      .addCase(upsertProfile.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload;
      })

      // uploadDocument
      .addCase(uploadDocument.pending, (state) => {
        state.uploading = true;
        state.uploadError = null;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.uploading = false;
        // Update selected with refreshed compliance data
        if (state.selected) {
          const updated = action.payload;
          state.selected = {
            ...state.selected,
            medicalCertificate: updated.medicalCertificate ?? state.selected.medicalCertificate,
            bhpTraining: updated.bhpTraining ?? state.selected.bhpTraining,
            complianceStatus: updated.complianceStatus ?? state.selected.complianceStatus,
            isBlocked: updated.isBlocked ?? state.selected.isBlocked,
          };
        }
      })
      .addCase(uploadDocument.rejected, (state, action) => {
        state.uploading = false;
        state.uploadError = action.payload;
      });
  },
});

export const { clearEmployees, clearSelected, clearSubmitError, clearUploadError } =
  employeeSlice.actions;
export default employeeSlice.reducer;
