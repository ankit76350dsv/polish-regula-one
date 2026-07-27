import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm shadow-indigo-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
            </div>
            <span className="text-slate-500 text-sm">
              © 2026 <span className="text-slate-800 font-semibold">Work<span className="text-indigo-600">Pulse</span></span> Poland. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-400">
            <span className="text-slate-400">Working-time evidence · Kodeks pracy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
