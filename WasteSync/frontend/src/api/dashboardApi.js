import axiosClient, { unwrap } from "./axiosClient";

// Fetches the whole dashboard in one call. Optional companyId narrows to one
// company; optional year picks the reporting year (defaults to the current one).
export const fetchDashboardOverview = async (filters = {}) => {
  const res = await axiosClient.get("/dashboard/overview", { params: filters });
  return unwrap(res);
};
