import { useTranslation } from "react-i18next";

export function CaseSeverityBadge({ severity }) {
  const { t } = useTranslation();
  const configs = {
    Low: "bg-slate-100 text-slate-700 border-slate-200",
    Medium: "bg-sky-50 text-sky-700 border-sky-200",
    High: "bg-amber-50 text-amber-800 border-amber-200",
    Critical: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${configs[severity]}`}
    >
      {t(`severity.${severity}`)}
    </span>
  );
}
