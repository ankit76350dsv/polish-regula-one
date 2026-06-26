/**
 * Central runtime configuration for SafeVoice.
 *
 * SIMPLE EXPLANATION:
 * This file has one job — decide whether the app runs on FAKE data or the REAL
 * RegulaOne backend. While we finish the user experience we run on fake (mock)
 * data so every screen works without any server. When the backend is ready we
 * flip ONE switch (the VITE_USE_MOCK env value) and the real API takes over.
 *
 * Keeping this decision in a single place is what makes backend integration a
 * small task later: the service layer (src/services/*) reads USE_MOCK and either
 * calls the mock API (src/mock/mockApi.js) or the real HTTP client (src/services/api.js).
 */

// SafeVoice has TWO independent data switches, because authentication and feature
// data become ready at different times:
//
//   USE_MOCK_AUTH — who is signed in. Defaults to REAL: access is decided entirely
//     by the live /api/auth/me response (valid session → in, 401 → central login).
//     There is NO mock auto-login. Set VITE_USE_MOCK_AUTH="true" only for an offline
//     auth demo.
//
//   USE_MOCK_DATA — the feature data (reports, cases, messages, users, audit,
//     settings). Defaults to MOCK, so the app stays fully usable while those backend
//     endpoints are still being built and would otherwise return 404/500. Set
//     VITE_USE_MOCK_DATA="false" once the real SafeVoice endpoints are live.
//
// This lets us run REAL login + MOCK feature data at the same time — exactly the
// state during backend development.
export const USE_MOCK_AUTH = (import.meta.env.VITE_USE_MOCK_AUTH ?? "false") === "true";
export const USE_MOCK_DATA = (import.meta.env.VITE_USE_MOCK_DATA ?? "true") === "true";

// How long the fake API waits before answering, in milliseconds. This lets us
// see real loading spinners and skeletons during development.
export const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 600);

// The two languages SafeVoice ships with today. Polish is the primary market;
// English is the fallback. Adding another EU language later is just one more entry.
export const SUPPORTED_LANGUAGES = [
  { code: "pl", label: "Polski" },
  { code: "en", label: "English" },
];

export const DEFAULT_LANGUAGE = "pl";

// localStorage keys (only non-sensitive UI preferences are ever stored here).
export const STORAGE_KEYS = {
  language: "safevoice_lang",
  theme: "safevoice_theme",
  cookieConsent: "safevoice_cookie_consent",
};
