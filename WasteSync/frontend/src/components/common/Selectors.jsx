import { recentYears } from "../../utils/constants";

// CompanySelector used to live here — a dropdown for choosing which company a
// page was working with. It was removed because there is nothing to choose
// between: one customer has exactly one company, registered in RegulaOne, and
// every page is now scoped by the tenant the backend reads from the session.

// A dropdown to choose the reporting year.
export function YearSelector({ value, onChange, className = "" }) {
  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-slate-500">Year</span>
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
