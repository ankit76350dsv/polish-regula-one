import { recentYears } from "../../utils/constants";

// A dropdown to choose which company the page is working with.
export function CompanySelector({ companies, value, onChange, className = "" }) {
  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-slate-500">Company</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
      >
        {companies.length === 0 && <option value="">No companies</option>}
        {companies.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name} ({c.bdoRegistrationNumber})
          </option>
        ))}
      </select>
    </label>
  );
}

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
