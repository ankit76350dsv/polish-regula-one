import { Link } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import { useOrgBase, useOrgHome } from "../utils/paths";

// The numbers stay the same in every language; only the label under them changes,
// so we store the label as a translation key and look it up when drawing.
const stats = [
  { value: "12K+", labelKey: "home.statCompanies" },
  { value: "99.8%", labelKey: "home.statComplianceRate" },
  { value: "50+", labelKey: "home.statSectors" },
  { value: "24/7", labelKey: "home.statSupport" },
];

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    titleKey: "home.featureAudits",
    descKey: "home.featureAuditsDesc",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    titleKey: "home.featureRisk",
    descKey: "home.featureRiskDesc",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
    titleKey: "home.featureTraining",
    descKey: "home.featureTrainingDesc",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    titleKey: "home.featureIncidents",
    descKey: "home.featureIncidentsDesc",
  },
];

export default function Home() {
  // t() gives the wording for the chosen language (Polish by default).
  const { t } = useTranslation();

  // "/company/{tenantId}" and "/company/{tenantId}/home" — the buttons below stay
  // inside the signed-in user's own company.
  const orgBase = useOrgBase();
  const orgHome = useOrgHome();

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(255,255,255,0.07),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_10%,rgba(255,255,255,0.05),transparent_50%)]" />
        {/* subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        {/* decorative circles */}
        <div className="absolute -right-32 -top-32 w-[500px] h-[500px] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-80 h-80 rounded-full bg-teal-500/20 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold tracking-wide mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {t("home.badge")}
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6 text-white">
              {t("home.titleLine1")}
              <br />
              <span className="text-emerald-200">{t("home.titleLine2")}</span>
            </h1>

            <p className="text-lg sm:text-xl text-emerald-100 leading-relaxed mb-10 max-w-2xl">
              {t("home.subtitle")}
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                to={`${orgBase}/contact`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-emerald-700 font-semibold text-base shadow-xl shadow-emerald-900/20 hover:bg-emerald-50 transition-all duration-200 active:scale-95"
              >
                {t("home.startTrial")}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                /* "View dashboard" now opens the real compliance dashboard at
                   …/home. It used to point at "/dashboard", which is the address of
                   THIS very page — so the button reloaded the page the reader was
                   already on instead of showing them any figures. */
                to={orgHome}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-white/30 text-white font-semibold text-base hover:bg-white/10 hover:border-white/50 transition-all duration-200"
              >
                {t("home.viewDashboard")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.labelKey} className="text-center">
                <div className="text-3xl font-extrabold text-emerald-600 mb-1">{s.value}</div>
                <div className="text-sm text-slate-500 font-medium">{t(s.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t("home.featuresTitle")}</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">{t("home.featuresSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.titleKey}
                className="group p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-default shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-slate-900 font-semibold mb-2">{t(f.titleKey)}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
