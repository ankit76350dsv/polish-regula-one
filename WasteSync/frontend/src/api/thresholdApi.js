import axiosClient, { unwrap } from "./axiosClient";

// All legal-threshold API calls. The backend reads the tenant from the session,
// so we never send a tenantId from here. Writing thresholds is admin-only on the
// backend; a non-admin call will come back as a 403.

// Fetch the tenant's thresholds, optionally filtered to one year.
export const fetchThresholds = async (year) => {
  const res = await axiosClient.get("/thresholds", {
    params: year ? { year } : {},
  });
  return unwrap(res); // { count, thresholds }
};

// Create OR update the limit for one category + year. The backend upserts, so
// the same call works whether or not a limit already exists.
export const saveThreshold = async (data) => {
  const res = await axiosClient.post("/thresholds", data);
  return unwrap(res);
};

// Remove a threshold by its id.
export const deleteThreshold = async (id) => {
  const res = await axiosClient.delete(`/thresholds/${id}`);
  return unwrap(res);
};
