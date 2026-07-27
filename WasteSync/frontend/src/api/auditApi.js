import axiosClient, { unwrap } from "./axiosClient";

// Fetches the tenant's audit trail, newest first, with optional filters.
export const fetchAuditLogs = async (filters = {}) => {
  const res = await axiosClient.get("/audit", { params: filters });
  return unwrap(res); // { logs, pagination }
};
