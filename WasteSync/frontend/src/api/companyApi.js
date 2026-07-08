import axiosClient, { unwrap } from "./axiosClient";

// All company API calls. The backend reads the tenant from the session, so we
// never send a tenantId from here.

export const fetchCompanies = async () => {
  const res = await axiosClient.get("/companies");
  return unwrap(res); // { count, companies }
};

export const fetchCompany = async (id) => {
  const res = await axiosClient.get(`/companies/${id}`);
  return unwrap(res);
};

export const createCompany = async (data) => {
  const res = await axiosClient.post("/companies", data);
  return unwrap(res);
};

export const updateCompany = async (id, data) => {
  const res = await axiosClient.put(`/companies/${id}`, data);
  return unwrap(res);
};
