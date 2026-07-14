// The top bar shown on every staff page: mobile menu button, live intake status,
// compliance tags, public links, language + theme controls, and the signed-in user.
import { LogOut, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavItem } from "./NavItem";
import { publicRoutes } from "./navRoutes";
import { LanguageSwitcher } from "../ui";

export function AppNavbar({ currentPath, navigate, mobileOpen, setMobileOpen, user, onLogout, tenantId }) {
  const { t } = useTranslation();

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={t("nav.toggleNav")}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold text-slate-700">{t("nav.intakeActive")}</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-600 border border-slate-200">
          <span>GDPR</span>
          <span className="w-px h-2.5 bg-slate-200" />
          <span>EU 2019/1937</span>
          <span className="w-px h-2.5 bg-slate-200" />
          <span>PL 2024</span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <nav className="hidden sm:flex items-center gap-2" aria-label={t("nav.publicPages")}>
          {publicRoutes.map((item) => (
            <NavItem key={item.path} item={item} currentPath={currentPath} navigate={navigate} tenantId={tenantId} />
          ))}
        </nav>

        <LanguageSwitcher />

        {user && (
          <div className="hidden md:flex items-center gap-2.5 border-l border-slate-200 pl-4">
            {/* Clicking the name/role opens the profile page. */}
            <button
              type="button"
              onClick={() => navigate("/profile")}
              title={t("profile.title")}
              aria-label={t("profile.title")}
              className="flex flex-col items-end rounded-md px-1 py-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <span className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[12rem]">{user.name || user.email}</span>
              <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase font-bold tracking-wider">{t(`roles.${user.safeVoiceRole || user.role}`, user.safeVoiceRole || user.role)}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              aria-label={t("common.signOut")}
              title={t("common.signOut")}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
