/**
 * Central runtime configuration for SafeVoice.
 *
 * SafeVoice now talks ONLY to the real backend — there is no mock data and no data
 * switches. Authentication is the central RegulaOne SSO session; the feature data
 * (reports, cases, messages) comes from the SafeVoice backend. The HTTP clients and
 * their base URLs live in src/services/api.js.
 */

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
  cookieConsent: "safevoice_cookie_consent",
};
