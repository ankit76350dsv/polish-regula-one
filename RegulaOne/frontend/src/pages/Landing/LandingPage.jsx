import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Globe2,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { motion } from 'motion/react';

function dashboardPath(tenantId) {
  return `/company/${tenantId ?? 'platform'}/overview`;
}

function LogoMark({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500 bg-red-600 text-lg font-bold text-white shadow-sm shadow-red-200">
        R
      </div>
      {!compact && (
        <div>
          <p className="text-base font-bold text-slate-950">RegulaOne</p>
          <p className="text-xs font-medium text-slate-500">Enterprise Compliance OS</p>
        </div>
      )}
    </div>
  );
}

function AccessButton({ user, className = '' }) {
  return (
    <a
      href={dashboardPath(user?.tenantId)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 ${className}`}
    >
      Access RegulaOne
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

function HeaderActions({ user }) {
  if (user) {
    return <AccessButton user={user} />;
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        to="/login"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Login
      </Link>
      <Link
        to="/auth/signup"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-bold text-white shadow-sm shadow-red-100 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Sign Up
      </Link>
    </div>
  );
}

function HeroActions({ user }) {
  if (user) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <AccessButton user={user} className="w-full sm:w-auto" />
        <a
          href="#platform"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
        >
          View platform modules
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        to="/auth/signup"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
      >
        Start secure onboarding
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <Link
        to="/login"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
      >
        Login to workspace
        <LogIn className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function ComplianceConsoleGraphic() {
  const statusRows = [
    ['KSeF FA(3)', 'Validated', 'bg-emerald-500'],
    ['RODO exports', 'Ready', 'bg-sky-500'],
    ['BHP records', '12 alerts', 'bg-amber-500'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.1 }}
      className="relative mx-auto w-full max-w-xl"
      aria-label="RegulaOne compliance dashboard illustration"
    >
      <div className="absolute -left-4 top-12 hidden h-20 w-20 rounded-lg border border-sky-100 bg-sky-50 sm:block" />
      <div className="absolute -right-5 bottom-10 hidden h-24 w-24 rounded-lg border border-emerald-100 bg-emerald-50 sm:block" />

      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <LogoMark compact />
            <div>
              <p className="text-sm font-bold text-slate-900">Compliance Command</p>
              <p className="text-xs text-slate-500">Poland and EU readiness</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Audit posture</p>
                  <p className="text-xs text-slate-300">Immutable evidence trail</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-red-300" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['KSeF', 'RODO', 'BHP'].map((label, index) => (
                  <div key={label} className="rounded-lg bg-white/10 p-3">
                    <p className="text-xl font-bold">{index === 2 ? '98' : '100'}%</p>
                    <p className="text-xs text-slate-300">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {statusRows.map(([label, status, color]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                    <span className="truncate text-sm font-semibold text-slate-800">{label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-red-600 text-white">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-slate-900">Zero-trust access</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Tenant isolation, MFA-ready sessions, and encrypted records.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-bold text-slate-900">Retention vault</p>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Invoices</span>
                    <span>10y</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 w-full rounded-full bg-red-500" />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Audit logs</span>
                    <span>10y</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 w-full rounded-full bg-sky-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                EEA hosted
              </div>
              <p className="mt-1 text-xs leading-5 text-emerald-700">
                Designed for EU data residency and audit retrieval.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ModulePill({ icon: Icon, title, detail }) {
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

export default function LandingPage({ user }) {
  const modules = [
    {
      icon: FileCheck2,
      title: 'KSeFFlow',
      detail: 'FA(3) e-invoices, XML validation, KSeF IDs, UPO retention, and offline queueing.',
    },
    {
      icon: Building2,
      title: 'WorkPulse and SafeWork',
      detail: 'Time tracking, overtime controls, BHP training, medical certificates, and HR audit records.',
    },
    {
      icon: ShieldCheck,
      title: 'SafeVoice',
      detail: 'Protected whistleblower case intake, encrypted records, and reviewer workflows.',
    },
    {
      icon: Globe2,
      title: 'WasteSync and PrivacyPilot',
      detail: 'BDO reporting, GDPR records, DPIA signals, ROPA generation, and export-ready evidence.',
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-950 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav
          className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
          aria-label="Primary navigation"
        >
          <Link to="/" aria-label="RegulaOne home">
            <LogoMark />
          </Link>
          <HeaderActions user={user} />
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
          <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Audit-ready compliance for Poland and the EU
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-slate-950 sm:text-6xl">
                RegulaOne
              </h1>
              <p className="mt-5 max-w-xl text-2xl font-semibold leading-9 text-slate-800">
                One secure operating layer for enterprise compliance.
              </p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                RegulaOne unifies KSeF e-invoicing, labour compliance, BHP readiness,
                whistleblower intake, BDO reporting, and GDPR governance in a
                multi-tenant platform built for audit trails, EEA data residency, and
                legally defensible workflows.
              </p>

              <div className="mt-8">
                <HeroActions user={user} />
              </div>

              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">Retention</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">10y</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">Hosting</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">EEA</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">Security</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">MFA</dd>
                </div>
              </dl>
            </motion.div>

            <ComplianceConsoleGraphic />
          </div>
        </section>

        <section id="platform" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-bold text-red-700">Platform modules</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
                Designed around regulated Polish business operations.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Each module keeps tenant data isolated, validates critical inputs on the
                server, and preserves evidence needed for government audits and internal
                governance reviews.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {modules.map((module) => (
                <ModulePill key={module.title} {...module} />
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="border-y border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
            <div>
              <p className="text-sm font-bold text-red-700">Enterprise assurance</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">Built for auditability from day one.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['Immutable logs', 'Critical actions preserve user, tenant, timestamp, and before/after context.'],
                ['Tenant isolation', 'Access patterns are designed around company boundaries and least privilege.'],
                ['Encrypted records', 'Sensitive certificates, reports, and documents stay protected throughout their lifecycle.'],
              ].map(([title, detail]) => (
                <div key={title} className="rounded-lg border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-bold text-slate-950">{title}</h3>
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
            <p className="mt-3 text-sm text-slate-500">
              © {new Date().getFullYear()} DSV Corporation Pty Ltd. All rights reserved.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600" aria-label="Footer">
            <a className="hover:text-red-700" href="#about">About</a>
            <a className="hover:text-red-700" href="#about">Privacy Policy</a>
            <a className="hover:text-red-700" href="#about">Terms of Service</a>
            <a className="hover:text-red-700" href="mailto:contact@regulaone.eu">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
