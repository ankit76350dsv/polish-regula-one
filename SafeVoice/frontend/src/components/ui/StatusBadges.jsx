/**
 * Status and severity chips. Colour conveys state AND the text label is always
 * present, so meaning never depends on colour alone (WCAG 1.4.1 Use of Color).
 * Labels are translated; colour classes come from the centralised data module.
 */
import { useTranslation } from "react-i18next";
import { severityClasses, statusClasses } from "../../mock/db";

export function StatusBadge({ status }) {
  const { t } = useTranslation();
  const cls = statusClasses[status] || "bg-slate-100 text-slate-700 border-slate-300";
  return (
    <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${cls}`}>
      {t(`status.${status}`, status)}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const { t } = useTranslation();
  const cls = severityClasses[severity] || "bg-slate-100 text-slate-700 border-slate-300";
  return (
    <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${cls}`}>
      {t(`severity.${severity}`, severity)}
    </span>
  );
}
