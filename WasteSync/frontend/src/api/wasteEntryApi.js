import axiosClient, { unwrap } from "./axiosClient";

// Current monthly figures for a company + year.
export const fetchMonthlyEntries = async ({ companyId, year }) => {
  const res = await axiosClient.get("/waste-entries", { params: { companyId, year } });
  return unwrap(res); // { count, entries }
};

// Full version history of one month (for audits).
export const fetchEntryHistory = async ({ companyId, year, month }) => {
  const res = await axiosClient.get("/waste-entries/history", {
    params: { companyId, year, month },
  });
  return unwrap(res); // { count, history }
};

// Record / correct a month. The backend always saves a new version.
export const recordMonthlyEntry = async (data) => {
  const res = await axiosClient.post("/waste-entries", data);
  return unwrap(res); // the saved entry
};
