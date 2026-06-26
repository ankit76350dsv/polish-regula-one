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

// Default to mock mode so the app is fully runnable with no backend. Set
// VITE_USE_MOCK="false" in .env to talk to the real RegulaOne backend instead.
export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";

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
