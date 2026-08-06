import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectLanguage,
  setLanguage,
  toggleLanguage,
  saveLanguage,
  DEFAULT_LANGUAGE,
} from "../store/slices/languageSlice";
import { translations } from "../i18n/translations";

// Which regional format goes with each language.
//
// This matters for more than words. "pl-PL" writes a date as 05.08.2026 and a
// weight as 1 234,5 — "en-GB" writes 05/08/2026 and 1,234.5. Showing a Polish
// user an American-looking date on a document that ends up at a government
// register is exactly the kind of small thing that causes a real mistake, so the
// numbers and dates follow the language and are never left to the browser's own
// guess.
const LOCALES = {
  pl: "pl-PL",
  en: "en-GB",
};

/**
 * Walk a dotted path like "reports.table.company" through a plain object.
 * Returns undefined if any step is missing, so the caller can fall back.
 *
 * @param {object} source the dictionary for one language
 * @param {string} path dotted key, e.g. "dashboard.metrics.totalWaste"
 */
const readPath = (source, path) =>
  path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), source);

/**
 * Put values into a sentence that has {{placeholders}} in it.
 *
 * Example:
 *   fill("Page {{page}} of {{totalPages}}", { page: 2, totalPages: 5 })
 *   -> "Page 2 of 5"
 *
 * This is how we keep word order correct in both languages: Polish often puts
 * the number in a different place than English, and each language file decides
 * where its own placeholder goes.
 */
const fill = (text, values) => {
  if (!values) return text;

  return Object.keys(values).reduce(
    (result, key) => result.replaceAll(`{{${key}}}`, String(values[key] ?? "")),
    text
  );
};

/**
 * The one hook every screen uses to show text, numbers and dates.
 *
 *   const { t, monthNames, formatNumber } = useTranslation();
 *   <h1>{t("reports.title")}</h1>
 *   <p>{t("audit.pagination", { page: 1, totalPages: 4, total: 78 })}</p>
 *   <td>{formatNumber(entry.totalWeightKg)}</td>
 *
 * How a missing word is handled, in order:
 *   1. the chosen language (Polish by default),
 *   2. then English, so a word we have not translated yet still reads properly,
 *   3. then the key itself, which makes the gap obvious during testing instead
 *      of showing an empty space to a real user.
 */
export function useTranslation() {
  const dispatch = useDispatch();
  const language = useSelector(selectLanguage);

  // The dictionary for the current language, picked once per language change.
  const dictionary = useMemo(
    () => translations[language] || translations[DEFAULT_LANGUAGE],
    [language]
  );

  const locale = LOCALES[language] || LOCALES[DEFAULT_LANGUAGE];

  const t = useCallback(
    (key, values) => {
      if (!key) return "";

      const chosen = readPath(dictionary, key);
      if (typeof chosen === "string") return fill(chosen, values);

      // Not translated yet -> use the English wording rather than show nothing.
      const english = readPath(translations.en, key);
      if (typeof english === "string") return fill(english, values);

      // Nothing found at all -> show the key so the gap is easy to spot.
      return key;
    },
    [dictionary]
  );

  // The twelve month names in order, as a plain array.
  //
  // Several screens need to loop over all twelve months (the form dropdown, the
  // monthly table, the charts). Building the array here once means no screen has
  // to remember that month 1 is at position 0.
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, index) => t(`months.${index + 1}`)),
    [t]
  );

  /**
   * The readable name of one waste category, from its code.
   *
   * @param {string} key the backend code, e.g. "PAPER"
   * @returns {string} e.g. "Papier i tektura"
   */
  const categoryLabel = useCallback((key) => t(`categories.${key}`), [t]);

  /**
   * Turn a number into a readable weight or count for the chosen language.
   *
   * A missing or broken value becomes 0 rather than the word "NaN", because a
   * screen full of NaN looks like the data is lost when it is only absent.
   *
   * @param {number|string} value
   * @returns {string} e.g. "1 234,5" in Polish, "1,234.5" in English
   */
  const formatNumber = useCallback(
    (value) => Number(value || 0).toLocaleString(locale),
    [locale]
  );

  /**
   * Show a date the way the chosen language writes dates.
   *
   * @param {string|Date} value an ISO date string or a Date
   * @param {object} [options] Intl options, e.g. { day: "numeric", month: "long" }
   * @returns {string|null} null when there is no usable date, so the caller can
   *                        decide what to show instead of printing "Invalid Date"
   */
  const formatDate = useCallback(
    (value, options) => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date.toLocaleDateString(locale, options);
    },
    [locale]
  );

  /**
   * Same as formatDate but includes the time — used for audit records and for
   * "when was this version saved", where the hour matters.
   */
  const formatDateTime = useCallback(
    (value) => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date.toLocaleString(locale);
    },
    [locale]
  );

  // Switch to a specific language and remember it for next time.
  const change = useCallback(
    (next) => {
      dispatch(setLanguage(next));
      saveLanguage(next);
    },
    [dispatch]
  );

  // Flip between Polish and English — what the header button calls.
  const toggle = useCallback(() => {
    const next = language === "pl" ? "en" : "pl";
    dispatch(toggleLanguage());
    saveLanguage(next);
  }, [dispatch, language]);

  return {
    t,
    language,
    locale,
    change,
    toggle,
    monthNames,
    categoryLabel,
    formatNumber,
    formatDate,
    formatDateTime,
  };
}

export default useTranslation;
