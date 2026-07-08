import axiosClient, { unwrap } from "./axiosClient";

// List generated reports (optionally filtered by company / year).
export const fetchReports = async (filters = {}) => {
  const res = await axiosClient.get("/reports", { params: filters });
  return unwrap(res); // { count, reports }
};

// One report's stored summary.
export const fetchReport = async (id) => {
  const res = await axiosClient.get(`/reports/${id}`);
  return unwrap(res);
};

// Generate a new annual report (server builds XML + PDF and stores them in S3).
export const generateReport = async ({ companyId, year }) => {
  const res = await axiosClient.post("/reports/generate", { companyId, year });
  return unwrap(res); // the saved report
};

// Get a short-lived presigned download URL for the XML or PDF.
export const getDownloadUrl = async (id, format) => {
  const res = await axiosClient.get(`/reports/${id}/download`, { params: { format } });
  return unwrap(res); // { url, format }
};

// Mark a report as submitted to the BDO portal.
export const submitReport = async (id) => {
  const res = await axiosClient.patch(`/reports/${id}/submit`);
  return unwrap(res);
};
