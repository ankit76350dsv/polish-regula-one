import { recentYears } from "../../utils/constants";
import { useTranslation } from "../../hooks/useTranslation";

// CompanySelector used to live here — a dropdown for choosing which company a
// page was working with. It was removed because there is nothing to choose
// between: one customer has exactly one company, registered in RegulaOne, and
// every page is now scoped by the tenant the backend reads from the session.

// A dropdown to choose the reporting year.
export function YearSelector({ value, onChange, className = "" }) {
  // The word "Year" next to the dropdown follows the chosen language. The year
  // NUMBERS themselves are never translated — 2026 is 2026 everywhere.
  const { t } = useTranslation();

  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-slate-500">{t("common.year")}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
      >
        {recentYears().map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
