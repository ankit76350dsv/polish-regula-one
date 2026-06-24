// Sets up translations for SafeVoice.
//
// We use react-i18next so every visible string can be shown in the user's language.
// Poland is the main market, so Polish ("pl") is the default. English ("en") is the
// fallback used when a Polish string is missing or another language is selected.
//
// The starting language follows the active jurisdiction (see config/activeJurisdiction).
// A reporter can still switch languages in the top bar; their choice is remembered by the
// language detector. We deliberately keep this in the browser only — no language choice is
// ever sent to a server or used to identify a reporter.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { activeJurisdiction } from "../config/activeJurisdiction";
import en from "./locales/en/common.json";
import pl from "./locales/pl/common.json";

// Each language gets its own bundle of strings under the "common" namespace.
export const resources = {
  en: { common: en },
  pl: { common: pl },
};

i18n
  // Detects a previously chosen language from localStorage / the browser.
  .use(LanguageDetector)
  // Connects i18next to React so components can use the useTranslation() hook.
  .use(initReactI18next)
  .init({
    resources,
    // If detection finds nothing, start in the jurisdiction's default language.
    fallbackLng: activeJurisdiction.defaultLocale || "en",
    supportedLngs: activeJurisdiction.supportedLocales,
    defaultNS: "common",
    interpolation: {
      // React already escapes output, so i18next does not need to.
      escapeValue: false,
    },
    detection: {
      // Remember the choice in localStorage only; never in cookies sent to a server.
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "safevoice_lang",
    },
  });

// Keep the <html lang="..."> attribute in step with the chosen language. Screen readers
// and search tools rely on this to pronounce and index the page correctly (WCAG 3.1.1).
const applyHtmlLang = (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
};
applyHtmlLang(i18n.language || activeJurisdiction.defaultLocale);
i18n.on("languageChanged", applyHtmlLang);

export default i18n;
