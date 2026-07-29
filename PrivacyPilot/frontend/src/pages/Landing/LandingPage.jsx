import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  DatabaseZap,
  ExternalLink,
  FileCheck2,
  FileLock2,
  Globe2,
  Languages,
  LockKeyhole,
  LogIn,
  ScanSearch,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import { useT } from '../../i18n';
import { orgPath } from '../../lib/paths';
import { redirectToLogin, CENTRAL_SIGNUP_URL } from '../../services/http';
import { selectAuthStatus, selectCurrentUser } from '../../store/slices/authSlice';
import { setLanguage } from '../../store/slices/uiSlice';

function LogoMark() {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm shadow-amber-200 sm:h-10 sm:w-10">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-black uppercase tracking-tight text-slate-950 sm:text-base">PrivacyPilot</p>
          <span className="hidden rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-amber-800 sm:inline">
            RegulaOne
          </span>
        </div>
        <p className="hidden text-xs font-medium text-slate-500 sm:block">{t('landing.tagline')}</p>
      </div>
    </div>
  );
}

function AccessButton({ tenantId, className = '' }) {
  const { t } = useT();
  return (
    <a
      href={orgPath(tenantId, '/dashboard')}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-bold text-white shadow-lg shadow-amber-100 transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 ${className}`}
    >
      {t('landing.access')}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

function SessionActions({ status, tenantId, compact = false }) {
  const { t } = useT();

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
        <span className="hidden sm:inline">{t('landing.checkingSession')}</span>
      </div>
    );
  }

  if (status === 'authenticated' && tenantId) {
    return <AccessButton tenantId={tenantId} className={compact ? 'w-full sm:w-auto' : ''} />;
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={redirectToLogin}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-bold text-white shadow-lg shadow-amber-100 transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
        >
          {t('landing.heroLogin')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <a
          href={CENTRAL_SIGNUP_URL}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
        >
          {t('landing.register')}
          <UserPlus className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={redirectToLogin}
        aria-label={t('landing.login')}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 sm:px-4"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t('landing.login')}</span>
      </button>
      <a
        href={CENTRAL_SIGNUP_URL}
        className="hidden h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white shadow-sm shadow-amber-100 transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 sm:inline-flex"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {t('landing.signup')}
      </a>
    </div>
  );
}

function ComplianceConsole() {
  const { t } = useT();
  const stages = [
    [t('landing.stageRopa'), t('landing.stageRopaDetail'), 'bg-amber-500'],
    [t('landing.stageDpia'), t('landing.stageDpiaDetail'), 'bg-sky-500'],
    [t('landing.stageEvidence'), t('landing.stageEvidenceDetail'), 'bg-violet-500'],
    [t('landing.stageAudit'), t('landing.stageAuditDetail'), 'bg-emerald-500'],
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500" aria-label={t('landing.consoleTitle')}>
      <div className="absolute -left-5 top-12 hidden h-24 w-24 rounded-lg border border-amber-100 bg-amber-50 sm:block" />
      <div className="absolute -right-5 bottom-10 hidden h-20 w-20 rounded-lg border border-sky-100 bg-sky-50 sm:block" />
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white">
              <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">{t('landing.consoleTitle')}</p>
              <p className="text-xs text-slate-500">{t('landing.consoleSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t('landing.auditReady')}
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-white">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{t('landing.posture')}</p>
                <p className="text-xs text-slate-300">{t('landing.postureDetail')}</p>
              </div>
              <FileLock2 className="h-8 w-8 text-amber-300" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Art. 30', t('landing.metricRopa')],
                ['72h', t('landing.metricBreach')],
                ['10y', t('landing.metricRetention')],
                ['EEA', t('landing.metricResidency')],
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
              <div key={title} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950">{title}</p>
                  <p className="truncate text-xs text-slate-500">{detail}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              </div>
            ))}
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                {t('landing.tenantVault')}
              </div>
              <p className="mt-1 text-xs leading-5 text-amber-800">{t('landing.tenantVaultDetail')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityCard({ icon: Icon, title, detail }) {
  return (
    <article className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
    </article>
  );
}

export default function LandingPage() {
  const dispatch = useDispatch();
  const { t, lang } = useT();
  const status = useSelector(selectAuthStatus);
  const user = useSelector(selectCurrentUser);
  const capabilities = [
    { icon: BookOpenCheck, title: t('landing.capRopa'), detail: t('landing.capRopaDetail') },
    { icon: ScanSearch, title: t('landing.capDpia'), detail: t('landing.capDpiaDetail') },
    { icon: FileCheck2, title: t('landing.capRights'), detail: t('landing.capRightsDetail') },
    { icon: DatabaseZap, title: t('landing.capEvidence'), detail: t('landing.capEvidenceDetail') },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-950 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label={t('landing.primaryNav')}>
          <Link to="/" aria-label={t('landing.homeLabel')}><LogoMark /></Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => dispatch(setLanguage(lang === 'pl' ? 'en' : 'pl'))}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              aria-label={t('common.switchLanguage')}
            >
              <Languages className="h-4 w-4" aria-hidden="true" />
              {lang === 'pl' ? 'EN' : 'PL'}
            </button>
            <SessionActions status={status} tenantId={user?.tenantId} />
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
          <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t('landing.eyebrow')}
              </div>
              <h1 className="text-5xl font-bold leading-[1.05] text-slate-950 sm:text-6xl">PrivacyPilot</h1>
              <p className="mt-5 max-w-xl text-2xl font-semibold leading-9 text-slate-800">{t('landing.heroTitle')}</p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{t('landing.heroBody')}</p>
              <div className="mt-8"><SessionActions status={status} tenantId={user?.tenantId} compact /></div>
              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                {[
                  [t('landing.statFramework'), 'GDPR'],
                  [t('landing.statRegister'), 'ROPA'],
                  [t('landing.statAccess'), 'SSO'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                    <dd className="mt-1 text-2xl font-bold text-slate-950">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <ComplianceConsole />
          </div>
        </section>

        <section id="capabilities" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-bold text-amber-700">{t('landing.capabilitiesLabel')}</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">{t('landing.capabilitiesTitle')}</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">{t('landing.capabilitiesBody')}</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {capabilities.map((item) => <CapabilityCard key={item.title} {...item} />)}
            </div>
          </div>
        </section>

        <section id="assurance" className="border-y border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
            <div>
              <p className="text-sm font-bold text-amber-700">{t('landing.assuranceLabel')}</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">{t('landing.assuranceTitle')}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                [Globe2, t('landing.assuranceEea'), t('landing.assuranceEeaDetail')],
                [LockKeyhole, t('landing.assuranceAccess'), t('landing.assuranceAccessDetail')],
                [BadgeCheck, t('landing.assuranceAudit'), t('landing.assuranceAuditDetail')],
              ].map(([Icon, title, detail]) => (
                <div key={title} className="rounded-lg border border-slate-200 bg-white p-5">
                  <Icon className="h-5 w-5 text-amber-700" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-bold text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <LogoMark />
            <p className="mt-3 text-sm text-slate-500">© {new Date().getFullYear()} DSV Corporation Pty Ltd. {t('landing.rights')}</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600" aria-label={t('landing.footerNav')}>
            <a className="hover:text-amber-700" href="#assurance">{t('landing.about')}</a>
            <a className="hover:text-amber-700" href="#assurance">{t('landing.privacy')}</a>
            <a className="hover:text-amber-700" href="#assurance">{t('landing.terms')}</a>
            <a className="hover:text-amber-700" href="mailto:contact@regulaone.eu">{t('landing.contact')}</a>
            <a className="hover:text-amber-700" href="#capabilities">{t('landing.capabilitiesLabel')}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
