import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

// Simple, accessible pager. Hidden entirely when there is only one page.
export function Pagination({ page, pageCount, total, onChange }) {
  const { t } = useTranslation();
  if (pageCount <= 1) return null;

  return (
    <nav
      className="flex items-center justify-between gap-3 pt-3 text-xs text-slate-600"
      aria-label={t("common.page")}
    >
      <span>
        {t("common.page")} {page} {t("common.of")} {pageCount}
        {typeof total === "number" ? ` · ${total} ${t("common.results")}` : ""}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label={t("common.back")}
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label={t("common.next")}
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
