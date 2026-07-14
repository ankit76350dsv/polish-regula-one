import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../../../config";

// Lets the user switch between Polish and English. Changing the value re-renders
// the whole app in the chosen language and updates <html lang> (handled in i18n).
export function LanguageSwitcher({ compact = false }) {
  const { t, i18n } = useTranslation();

  return (
    <label className={`inline-flex items-center gap-1.5 ${compact ? "" : "text-xs"}`}>
      <Globe className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={i18n.language?.startsWith("pl") ? "pl" : i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng.code} value={lng.code}>
            {lng.label}
          </option>
        ))}
      </select>
    </label>
  );
}
