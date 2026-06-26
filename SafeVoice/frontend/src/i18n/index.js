/**
 * Internationalisation (i18n) setup for SafeVoice.
 *
 * SIMPLE EXPLANATION:
 * The app must work in Polish (the primary market) and English. This file turns
 * on the translation engine (i18next) and loads both language dictionaries. Every
 * piece of visible text in the app comes from these dictionaries through the
 * `t("some.key")` function, so switching language re-renders the whole UI.
 *
 * It also keeps the <html lang="…"> attribute in sync with the chosen language,
 * which screen readers rely on (WCAG 2.1 success criterion 3.1.1, Language of Page),
 * and remembers the user's choice in localStorage.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import pl from "./locales/pl.json";
import { DEFAULT_LANGUAGE, STORAGE_KEYS, SUPPORTED_LANGUAGES } from "../config";

// Read a previously saved language, falling back to Polish. We only accept a
// value we actually support so a stale/garbage value can never break the app.
function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.language);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    /* localStorage may be unavailable (private mode) — ignore and use default */
  }
  return DEFAULT_LANGUAGE;
}

// Keep <html lang> correct for assistive technology, and remember the choice.
export function applyLanguageSideEffects(lng) {
  try {
    document.documentElement.lang = lng;
    localStorage.setItem(STORAGE_KEYS.language, lng);
  } catch {
    /* ignore */
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
  },
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes against XSS.
  returnNull: false,
});

// Run once on load and again every time the language changes.
applyLanguageSideEffects(i18n.language);
i18n.on("languageChanged", applyLanguageSideEffects);

export default i18n;
