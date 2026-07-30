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

/**
 * Walk a dotted path like "clock.clockIn" through a plain object.
 * Returns undefined if any step is missing, so the caller can fall back.
 *
 * @param {object} source the dictionary for one language
 * @param {string} path dotted key, e.g. "policy.systems.STANDARD"
 */
const readPath = (source, path) =>
  path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), source);

/**
 * Put values into a sentence that has {{placeholders}} in it.
 *
 * Example:
 *   fill("Page {{page}} of {{total}}", { page: 2, total: 9 })
 *   -> "Page 2 of 9"
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
 * The one hook every screen uses to show text.
 *
 *   const { t, language, toggle } = useTranslation();
 *   <h1>{t("timesheet.title")}</h1>
 *   <p>{t("audit.pageOf", { page: 2, total: 9 })}</p>
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

  return { t, language, change, toggle };
}

export default useTranslation;
