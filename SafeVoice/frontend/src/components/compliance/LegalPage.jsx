/**
 * Shared layout for legal / compliance content pages (privacy, terms, cookies,
 * accessibility, how-it-works, external reporting). Gives them one consistent,
 * readable typographic treatment with a back link and "last updated" date.
 */
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LegalPage({ title, lastUpdated = "2026-06-26", navigate, children }) {
  const { t } = useTranslation();
  return (
    <article className="max-w-3xl mx-auto leading-relaxed">
      <button
        type="button"
        onClick={() => navigate?.("/report")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-cyan-700 mb-5 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> {t("compliance.backToApp")}
      </button>

      <header className="border-b border-slate-200 pb-4 mb-6">
        <div className="flex items-center gap-2 text-cyan-600 mb-2">
          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            {t("common.appName")} · RegulaOne
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-balance">{title}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {t("compliance.lastUpdated")}: <span className="font-medium text-slate-600">{lastUpdated}</span>
        </p>
      </header>

      <div className="space-y-6">{children}</div>
    </article>
  );
}

// One titled section of body text inside a LegalPage.
export function LegalSection({ title, children }) {
  return (
    <section>
      {title ? <h2 className="text-sm font-bold text-slate-900 mb-1.5">{title}</h2> : null}
      <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
