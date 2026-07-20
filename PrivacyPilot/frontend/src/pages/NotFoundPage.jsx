import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileQuestion, Home } from 'lucide-react';

import { useT } from '../i18n';
import { orgPath } from '../lib/paths';

export default function NotFoundPage() {
  const { t } = useT();
  const location = useLocation();
  const tenantId = useSelector((state) => state.auth.user?.tenantId);
  const returnPath = tenantId ? orgPath(tenantId, '/dashboard') : '/';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 font-sans text-slate-950">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <FileQuestion className="h-7 w-7" aria-hidden="true" />
        </div>

        <p className="mt-8 text-sm font-bold uppercase tracking-widest text-amber-700">404 error</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {t('notFound.title')}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{t('notFound.body')}</p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('notFound.requestedPath')}
          </p>
          <p className="mt-1 break-all font-mono text-sm text-slate-800">
            {location.pathname || '/'}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to={returnPath}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-bold text-white shadow-lg shadow-amber-100 transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            {tenantId ? t('notFound.dashboard') : t('notFound.home')}
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('notFound.back')}
          </button>
        </div>
      </section>
    </main>
  );
}
