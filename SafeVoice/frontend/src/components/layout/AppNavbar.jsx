// The top bar shown on every page.
// It has the mobile menu button, a "live" intake status dot, compliance tags,
// and the public navigation links (submit / track a report).
import { FileCheck2, LogOut, Menu, X } from "lucide-react";
import { NavItem } from "./NavItem";
import { publicRoutes } from "./navRoutes";

export function AppNavbar({ currentPath, navigate, mobileOpen, setMobileOpen, user, onLogout }) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold text-slate-700">Intake active</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-600 border border-slate-200">
          <span>GDPR</span>
          <span className="w-px h-2.5 bg-slate-200" />
          <span>EU 2019/1937</span>
          <span className="w-px h-2.5 bg-slate-200" />
          <span>Poland 2024 Act</span>
        </div>
      </div>

      {/* Right side group: the public links (Submit / Track report) now sit
          right next to the "Page-only rebuild" info block. */}
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-2" aria-label="Public pages">
          {publicRoutes.map((item) => (
            <NavItem key={item.path} item={item} currentPath={currentPath} navigate={navigate} />
          ))}
        </nav>

        {/* When a staff member is signed in via RegulaOne SSO we show who they are
            and a sign-out button. Otherwise we keep the build/status badge. */}
        {user ? (
          <div className="hidden md:flex items-center gap-2.5 border-l border-slate-200 pl-4">
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[12rem]">
                {user.name || user.email}
              </span>
              <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase font-bold tracking-wider">
                {user.role}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="hidden xl:flex items-center gap-2.5 border-l border-slate-200 pl-4">
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-800 leading-none">
                Page-only rebuild
              </span>
              <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase font-bold tracking-wider">
                No auth or APIs
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center font-bold text-cyan-600 text-xs">
              <FileCheck2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
