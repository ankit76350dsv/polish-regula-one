import { useTranslation } from "react-i18next";

export function CaseStatusBadge({ status }) {
  const { t } = useTranslation();
  const configs = {
    Received: {
      bg: "bg-sky-50 text-sky-700 border-sky-200",
      dot: "bg-sky-500",
    },
    Acknowledged: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      dot: "bg-emerald-500",
    },
    Triage: {
      bg: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    },
    Investigating: {
      bg: "bg-cyan-50 text-cyan-700 border-cyan-200",
      dot: "bg-cyan-500",
    },
    "Awaiting Reporter": {
      bg: "bg-violet-50 text-violet-755 border-violet-200",
      dot: "bg-violet-500",
    },
    Remediation: {
      bg: "bg-teal-50 text-teal-700 border-teal-200",
      dot: "bg-teal-500",
    },
    Closed: {
      bg: "bg-slate-100 text-slate-705 border-slate-200",
      dot: "bg-slate-400",
    },
  };

  const config = configs[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${config.bg}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
        aria-hidden="true"
      />
      {t(`status.${status}`)}
    </span>
  );
}
