import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  LockKeyhole,
  LogIn,
  Network,
  ReceiptText,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { motion } from 'motion/react';

import { CENTRAL_LOGIN, CENTRAL_SIGNUP } from '../lib/serviceHosts';

function appPath(tenantId) {
  return `/company/${tenantId || 'platform'}/dashboard`;
}

function LogoMark({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-700 text-sm font-black leading-none text-white shadow-sm shadow-red-200">
        R1
      </div>
      {!compact && (
        <div>
          <div className="flex items-baseline gap-2">
            <p className="text-base font-black uppercase tracking-tight text-slate-900">RegulaOne</p>
            <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-red-700">
              KSeFFlow
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">Poland e-invoicing compliance node</p>
        </div>
      )}
    </div>
  );
}

function AccessButton({ tenantId, className = '' }) {
  return (
    <a
      href={appPath(tenantId)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 ${className}`}
    >
      Access KSeFFlow
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

function HeaderActions({ isAuthenticated, isAuthLoading, tenantId }) {
  if (isAuthLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-700" />
        Checking session
      </div>
    );
  }

  if (isAuthenticated) {
    return <AccessButton tenantId={tenantId} />;
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
      <a
        href={CENTRAL_SIGNUP}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-bold text-white shadow-sm shadow-red-100 transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Sign Up
      </a>
    </div>
  );
}

function HeroActions({ isAuthenticated, tenantId }) {
  if (isAuthenticated) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <AccessButton tenantId={tenantId} className="w-full sm:w-auto" />
        <a
          href="#capabilities"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
        >
          View capabilities
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        to="/login"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
      >
        Login with RegulaOne SSO
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <a
        href={CENTRAL_SIGNUP}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
      >
        Register organization
        <UserPlus className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}

function InvoiceConsoleGraphic() {
  const stages = [
    ['Draft', 'DTO validated', 'bg-slate-400'],
    ['FA(3) XML', 'Schema ready', 'bg-sky-500'],
    ['KSeF submit', 'Queued securely', 'bg-red-600'],
    ['UPO', 'Stored 10 years', 'bg-emerald-500'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.08 }}
      className="relative mx-auto w-full max-w-xl"
      aria-label="KSeFFlow e-invoice workflow illustration"
    >
      <div className="absolute -left-4 top-12 hidden h-20 w-20 rounded-lg border border-sky-100 bg-sky-50 sm:block" />
      <div className="absolute -right-5 bottom-10 hidden h-24 w-24 rounded-lg border border-emerald-100 bg-emerald-50 sm:block" />

      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <LogoMark compact />
            <div>
              <p className="text-sm font-bold text-slate-900">Invoice Control Center</p>
              <p className="text-xs text-slate-500">FA(3), KSeF ID, and UPO lifecycle</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Sandbox ready
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Submission posture</p>
                <p className="text-xs text-slate-300">Tenant-scoped invoice operations</p>
              </div>
              <ReceiptText className="h-8 w-8 text-red-300" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-2xl font-bold">FA(3)</p>
                <p className="text-xs text-slate-300">XML standard</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-2xl font-bold">10y</p>
                <p className="text-xs text-slate-300">UPO retention</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-2xl font-bold">TLS</p>
                <p className="text-xs text-slate-300">Secure transit</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-2xl font-bold">EEA</p>
                <p className="text-xs text-slate-300">Data residency</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {stages.map(([title, detail, color], index) => (
              <div key={title} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
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

            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-red-800">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Certificate vault
              </div>
              <p className="mt-1 text-xs leading-5 text-red-700">
                Auth credentials and qualified seals stay protected outside invoice UI state.
              </p>
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

export default function LandingPage({ isAuthenticated = false, isAuthLoading = false, tenantId = null }) {
  const capabilities = [
    {
      icon: FileText,
      title: 'FA(3) invoice generation',
      detail: 'Generate compliant sales invoices with server-side validation before KSeF submission.',
    },
    {
      icon: Network,
      title: 'KSeF API workflow',
      detail: 'Submit, track, and reconcile invoices with KSeF identifiers and retry-safe operations.',
    },
    {
      icon: BadgeCheck,
      title: 'UPO and evidence storage',
      detail: 'Keep official receipt evidence export-ready for audits and statutory retention windows.',
    },
    {
      icon: ShieldCheck,
      title: 'Tenant-isolated controls',
      detail: 'Protect organization data with SSO, role-aware navigation, and backend-enforced permissions.',
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-950 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
          <Link to="/" aria-label="KSeFFlow home">
            <LogoMark />
          </Link>
          <HeaderActions isAuthenticated={isAuthenticated} isAuthLoading={isAuthLoading} tenantId={tenantId} />
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
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                KSeF e-invoicing operations for regulated Polish companies
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-slate-950 sm:text-6xl">
                KSeFFlow
              </h1>
              <p className="mt-5 max-w-xl text-2xl font-semibold leading-9 text-slate-800">
                Issue, submit, and audit Polish e-invoices from one secure workflow.
              </p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                KSeFFlow connects RegulaOne SSO, FA(3) XML validation, certificate-aware
                KSeF submission, offline fallback handling, UPO retention, and audit
                evidence into a focused finance workspace.
              </p>

              <div className="mt-8">
                <HeroActions isAuthenticated={isAuthenticated} tenantId={tenantId} />
              </div>

              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">Schema</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">FA(3)</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">Receipts</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">UPO</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold text-slate-500">Access</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">SSO</dd>
                </div>
              </dl>
            </motion.div>

            <InvoiceConsoleGraphic />
          </div>
        </section>

        <section id="capabilities" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-bold text-red-700">Core capabilities</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
                Built around the invoice lifecycle your audit team cares about.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Every screen is designed for traceability: validated invoice data, clear
                status transitions, role-aware controls, and evidence that can be retrieved
                when finance, tax, or compliance teams need it.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {capabilities.map((capability) => (
                <CapabilityCard key={capability.title} {...capability} />
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="border-y border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
            <div>
              <p className="text-sm font-bold text-red-700">Operational assurance</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">A safer path from draft to KSeF receipt.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['Server validation', 'Payloads are checked outside the browser before regulated invoice actions proceed.'],
                ['Offline resilience', 'Unavailable KSeF sessions can be queued and retried without losing local workflow state.'],
                ['Audit context', 'Invoice actions preserve the tenant, user role, timestamps, and operational outcome.'],
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
            <a className="hover:text-red-700" href="#capabilities">Capabilities</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
