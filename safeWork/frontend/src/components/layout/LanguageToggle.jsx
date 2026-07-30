import { useTranslation } from "../../hooks/useTranslation";

// The PL / EN switch that lives in the header.
//
// It is built as two small buttons side by side (a "segmented control") rather
// than a dropdown, because there are only two choices and this way the user can
// always SEE which language is active without opening anything.
//
// The choice is stored in Redux and remembered in the browser, so the whole app
// switches at once and stays in that language the next time the user comes back.
// Polish is the default on a first visit.
export default function LanguageToggle({ className = "" }) {
  const { language, change, t } = useTranslation();

  const options = [
    // `short` is what the user sees (PL / EN). `name` is the full language name,
    // used only for the screen-reader label so it reads as a real sentence.
    { code: "pl", short: "PL", name: t("language.polish") },
    { code: "en", short: "EN", name: t("language.english") },
  ];

  return (
    <div
      // "group" tells screen readers these buttons belong together.
      role="group"
      aria-label={t("language.label")}
      className={`inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 ${className}`}
    >
      {options.map((option) => {
        const isActive = language === option.code;

        return (
          <button
            key={option.code}
            type="button"
            onClick={() => change(option.code)}
            // aria-pressed tells assistive software which of the two is on.
            aria-pressed={isActive}
            title={t("language.switchTo", { language: option.name })}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              isActive
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                : "text-slate-500 hover:text-emerald-700"
            }`}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}
