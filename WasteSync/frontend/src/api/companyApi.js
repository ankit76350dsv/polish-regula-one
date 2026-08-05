import axiosClient, { unwrap } from "./axiosClient";

// The company is registered once in the central RegulaOne platform. WasteSync
// only READS it — there is no create, no edit, no list. The backend fetches it
// live from RegulaOne's /api/tenant/info on every call.
//
// The single value WasteSync stores is the 9-digit BDO registration number,
// which RegulaOne does not hold.
//
// The backend takes the tenant from the session, so we never send an id.

// Returns { company, bdoRegistrationMissing }.
export const fetchCompanyProfile = async () => {
  const res = await axiosClient.get("/companies/profile");
  return unwrap(res);
};

// Saves the 9-digit BDO number. Returns the same shape as fetchCompanyProfile.
export const updateBdoNumber = async (bdoRegistrationNumber) => {
  const res = await axiosClient.put("/companies/profile/bdo", { bdoRegistrationNumber });
  return unwrap(res);
};
