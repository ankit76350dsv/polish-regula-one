import { useMemo } from "react";
import { useTranslation } from "./useTranslation";
import * as fmt from "../utils/format";

// Maps our short language codes to the full locale names the browser's date
// formatter understands. "pl-PL" gives "30 lip 2026" and a 24-hour clock;
// "en-GB" gives "30 Jul 2026" and also a 24-hour clock, which is what a
// working-time record should use (no am/pm on a timesheet).
const LOCALES = {
  pl: "pl-PL",
  en: "en-GB",
};

/**
 * Formatting helpers that already know the chosen language.
 *
 *   const { formatDate, formatDuration, breakStatus } = useFormat();
 *   <td>{formatDate(entry.workDate)}</td>       // 30 lip 2026  /  30 Jul 2026
 *   <td>{formatDuration(entry.netWorkedMinutes)}</td>  // 8 godz. 30 min / 8h 30m
 *
 * Why a hook instead of importing utils/format.js directly: the raw helpers need
 * the locale and the unit words passed in every time. Doing that at ~40 call
 * sites would be repetitive and easy to get wrong. This hook fills them in once.
 *
 * Because it reads the language from Redux, every component using it re-renders
 * automatically when the user presses the PL / EN switch — dates and durations
 * change language at the same moment as everything else on screen.
 */
export function useFormat() {
  const { t, language } = useTranslation();

  return useMemo(() => {
    const locale = LOCALES[language] || LOCALES.pl;

    // The unit words for durations, taken from the current language file.
    const hourLabel = t("common.hourShort");
    const minuteLabel = t("common.minuteShort");

    // Turn a { labelKey, fallback } result from utils/format.js into real words.
    const label = (meta) =>
      meta.labelKey ? t(meta.labelKey) : meta.fallback ?? "—";

    return {
      // Raw language for the rare component that needs it (e.g. an html lang attr).
      language,
      locale,

      formatDuration: (minutes) => fmt.formatDuration(minutes, hourLabel, minuteLabel),
      formatTime: (value) => fmt.formatTime(value, locale),
      formatDate: (value) => fmt.formatDate(value, locale),
      formatDateTime: (value) => fmt.formatDateTime(value, locale),

      // Break compliance: { label, cls } ready to drop into a <Badge>.
      breakStatus: (status) => {
        const meta = fmt.breakStatusMeta(status);
        return { label: label(meta), cls: meta.cls };
      },

      // Time-entry lifecycle: { label, cls } ready to drop into a <Badge>.
      entryStatus: (status) => {
        const meta = fmt.entryStatusMeta(status);
        return { label: label(meta), cls: meta.cls };
      },

      // The readable name of an absence type, e.g. "Urlop wypoczynkowy".
      // An unknown code is shown as-is rather than hidden.
      absenceType: (type) => (type ? t(`absenceType.${type}`) : "—"),

      // The readable name of an absence decision (Pending / Approved / …).
      absenceStatus: (status) => (status ? t(`absenceStatus.${status}`) : "—"),
    };
  }, [t, language]);
}

export default useFormat;
