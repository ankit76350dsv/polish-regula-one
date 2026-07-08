import axios from "axios";

// One shared axios instance for every call to the WasteSync backend.
//
// withCredentials: true means the browser automatically attaches the shared
// HttpOnly auth cookie (set by RegulaOne at login) on every request. We never
// read or store the token in JavaScript, so an XSS attacker cannot steal it.
const WASTESYNC_API_URL =
  (import.meta.env.VITE_WASTESYNC_API_URL ?? "http://localhost:8083") + "/api";

const axiosClient = axios.create({
  baseURL: WASTESYNC_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Every backend response is wrapped as { success, message, data }. This helper
// unwraps it so callers get the useful "data" part directly.
export const unwrap = (response) => response?.data?.data ?? response?.data;

// Turns an axios error into a clean message string for the UI / Redux.
export const getErrorMessage = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message || err?.message || fallback;

export default axiosClient;
