import { useLocation, Link } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import { stripOrgPrefix, useOrgHome } from "../utils/paths";

export default function Placeholder() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  // Where the "back" button goes: the home page inside the user's own company.
  const orgHome = useOrgHome();

  // Build a readable page name from the address bar, for example
  // "services/risk-assessment" -> "services › risk assessment". When we are at
  // the root there is nothing to build from, so we use the word "Home"/"Start".
  //
  // WHAT CHANGED AND WHY: we now cut the "/company/{tenantId}" start off the
  // address first. Every page moved under that prefix, so without this the title
  // would read "company › 6f3a1b… › services › risk assessment" — it would print an
  // internal id on screen and bury the real page name behind two useless words.
  const name =
    stripOrgPrefix(pathname).split("/").filter(Boolean).join(" › ") ||
    t("placeholder.home");

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-6 shadow-sm shadow-emerald-500/10">
        <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p className="text-emerald-600 text-xs font-semibold tracking-widest uppercase mb-3">{t("placeholder.eyebrow")}</p>
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 capitalize mb-4">{name}</h1>
      <p className="text-slate-500 max-w-md mb-8">{t("placeholder.message", { name })}</p>
      <Link
        to={orgHome}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        {t("placeholder.backHome")}
      </Link>
    </div>
  );
}
