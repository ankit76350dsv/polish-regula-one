import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  ArrowRight,
  FileLock2,
  Inbox,
  Languages,
  Lock,
  LogIn,
  ScrollText,
  Shield,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { LanguageSwitcher, ThemeToggle } from "../../components/ui";
import { SiteFooter } from "../../components/layout";
import {
  CENTRAL_SIGNUP_URL,
  redirectToLogin,
} from "../../services/api";
import {
  initSession,
  selectAuthStatus,
  selectCurrentUser,
  selectIsAuthenticated,
} from "../../slices/authSlice";

// ── SafeVoice landing page ────────────────────────────────────────────────────
// SIMPLE EXPLANATION:
// This is the public "front door" of SafeVoice, built in the same spirit as the
// KSeFFlow and RegulaOne landing pages. It is the ONLY public page that looks at
// the sign-in session, because its job is to show the right buttons:
//   • not signed in  → "Login" + "Sign Up"
//   • signed in       → a single "Access SafeVoice" button
// The anonymous report / track pages never mount this page, so a whistleblower's
// surface still never touches a session (anonymity requirement of EU 2019/1937).

// The small brand mark, reused in the header.
function LogoMark() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-sm shadow-cyan-200">
        <Shield className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <p className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
            {t("common.appName")}
          </p>
          <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-cyan-700">
            RegulaOne
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500">{t("landing.tagline")}</p>
      </div>
    </div>
  );
}

// The header / hero buttons. Their look depends on whether a session was found.
function AccessButton({ onClick, className = "" }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 text-sm font-bold text-white shadow-lg shadow-cyan-100 transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200 ${className}`}
    >
      {t("landing.access")}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function HeaderActions({ status, onLogin, onAccess }) {
  const { t } = useTranslation();

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
        {t("landing.checkingSession")}
      </div>
    );
  }

  if (status === "authenticated") {
    return <AccessButton onClick={onAccess} />;
  }

  // Not signed in (or a transient error) → offer Login + Sign Up.
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onLogin}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {t("landing.login")}
      </button>
      <a
        href={CENTRAL_SIGNUP_URL}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-bold text-white shadow-sm shadow-cyan-100 transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {t("landing.signup")}
      </a>
    </div>
  );
}

function HeroActions({ status, onLogin, onAccess }) {
  const { t } = useTranslation();

  if (status === "authenticated") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <AccessButton onClick={onAccess} className="w-full sm:w-auto" />
        <a
          href="#capabilities"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
        >
          {t("landing.viewCapabilities")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onLogin}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 text-sm font-bold text-white shadow-lg shadow-cyan-100 transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
      >
        {t("landing.heroLoginCta")}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
      <a
        href={CENTRAL_SIGNUP_URL}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
      >
        {t("landing.registerOrg")}
        <UserPlus className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}

// The reassuring "secure intake" illustration on the right of the hero.
function IntakeConsoleGraphic() {
  const { t } = useTranslation();
  const stages = [
    [t("landing.stage1Title"), t("landing.stage1Detail"), "bg-slate-400"],
    [t("landing.stage2Title"), t("landing.stage2Detail"), "bg-cyan-500"],
    [t("landing.stage3Title"), t("landing.stage3Detail"), "bg-amber-500"],
    [t("landing.stage4Title"), t("landing.stage4Detail"), "bg-emerald-500"],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.08 }}
      className="relative mx-auto w-full max-w-xl"
      aria-label={t("landing.panelTitle")}
    >
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white">
              <Inbox className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{t("landing.panelTitle")}</p>
              <p className="text-xs text-slate-500">{t("landing.panelSubtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t("landing.panelStatusLabel")}
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{t("landing.panelPostureTitle")}</p>
                <p className="text-xs text-slate-300">{t("landing.panelPostureSubtitle")}</p>
              </div>
              <FileLock2 className="h-8 w-8 text-cyan-300" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["AES-256", t("landing.metricEncryption")],
                ["10y", t("landing.metricRetention")],
                ["EEA", t("landing.metricResidency")],
                ["SSO", t("landing.metricAccess")],
              ].map(([value, label]) => (
                <div key={value} className="rounded-lg bg-white/10 p-3">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-slate-300">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {stages.map(([title, detail, color], index) => (
              <div
                key={title}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{title}</p>
                  <p className="truncate text-xs text-slate-500">{detail}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              </div>
            ))}

            <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-cyan-800">
                <Lock className="h-4 w-4" aria-hidden="true" />
                {t("landing.vaultTitle")}
              </div>
              <p className="mt-1 text-xs leading-5 text-cyan-700">{t("landing.vaultDesc")}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CapabilityCard({ icon: Icon, title, detail }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

export default function LandingPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);
  const user = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Check the session exactly ONCE. The thunk's `condition` (and this idle guard)
  // make sure /api/auth/me is never called more than once across the whole app —
  // the staff area reuses this same cached result instead of asking again.
  useEffect(() => {
    if (status === "idle") dispatch(initSession());
  }, [dispatch, status]);

  // "Login": hand off to the central RegulaOne login page (the browser leaves and
  // returns to /auth/sso-callback once signed in).
  const handleLogin = () => {
    redirectToLogin();
  };

  // "Access SafeVoice": go into the gated workspace. navigate() rewrites this to
  // /company/{tenantId}/dashboard using the signed-in user's organisation.
  const handleAccess = () => navigate("/dashboard");

  const capabilities = [
    { icon: Lock, title: t("landing.cap1Title"), detail: t("landing.cap1Desc") },
    { icon: Inbox, title: t("landing.cap2Title"), detail: t("landing.cap2Desc") },
    { icon: ScrollText, title: t("landing.cap3Title"), detail: t("landing.cap3Desc") },
    { icon: ShieldCheck, title: t("landing.cap4Title"), detail: t("landing.cap4Desc") },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-950 antialiased flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-cyan-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        {t("nav.skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav
          className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
          aria-label={t("nav.publicPages")}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label={t("common.appName")}
          >
            <LogoMark />
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <HeaderActions status={status} onLogin={handleLogin} onAccess={handleAccess} />
          </div>
        </nav>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
          <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-700">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t("landing.badge")}
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-slate-950 sm:text-6xl">
                {t("common.appName")}
              </h1>
              <p className="mt-5 max-w-xl text-2xl font-semibold leading-9 text-slate-800">
                {t("landing.subtitle")}
              </p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                {t("landing.description")}
              </p>

              {isAuthenticated && user?.email && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <Shield className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" />
                  {t("auth.signedInAs")} <span className="font-mono">{user.email}</span>
                </p>
              )}

              <div className="mt-8">
                <HeroActions status={status} onLogin={handleLogin} onAccess={handleAccess} />
              </div>

              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">{t("landing.stat1Label")}</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">{t("landing.stat1Value")}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">{t("landing.stat2Label")}</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">{t("landing.stat2Value")}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">{t("landing.stat3Label")}</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">{t("landing.stat3Value")}</dd>
                </div>
              </dl>
            </motion.div>

            <IntakeConsoleGraphic />
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              {t("landing.capabilitiesTitle")}
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              {t("landing.capabilitiesSubtitle")}
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((c) => (
              <CapabilityCard key={c.title} icon={c.icon} title={c.title} detail={c.detail} />
            ))}
          </div>

          {/* Compliance reassurance strip */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-600" aria-hidden="true" />
              {t("landing.complianceEu")}
            </span>
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {t("landing.complianceGdpr")}
            </span>
            <span className="inline-flex items-center gap-2">
              <Languages className="h-4 w-4 text-slate-500" aria-hidden="true" />
              {t("landing.compliancePl")}
            </span>
          </div>
        </section>
      </main>

      <SiteFooter navigate={navigate} />
    </div>
  );
}
