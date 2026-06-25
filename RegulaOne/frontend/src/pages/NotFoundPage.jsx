import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileQuestion, Home } from 'lucide-react';

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 font-sans text-slate-950">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-red-50 text-red-700">
          <FileQuestion className="h-7 w-7" aria-hidden="true" />
        </div>

        <p className="mt-8 text-sm font-bold uppercase tracking-widest text-red-700">404 error</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          The route you opened does not exist in RegulaOne. Check the address or return to the
          landing page to continue safely.
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Requested path</p>
          <p className="mt-1 break-all font-mono text-sm text-slate-800">
            {location.pathname || '/'}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Return to Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>
        </div>
      </section>
    </main>
  );
}
