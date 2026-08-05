import axiosClient, { unwrap } from "./axiosClient";

// Fetches the whole dashboard in one call. The optional year picks the reporting
// year (defaults to the current one). There is no company filter: one tenant has
// one company, and the backend takes the tenant from the session.
export const fetchDashboardOverview = async (filters = {}) => {
  const res = await axiosClient.get("/dashboard/overview", { params: filters });
  return unwrap(res);
};
