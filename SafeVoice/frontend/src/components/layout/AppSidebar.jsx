// The left sidebar shown on large screens: staff navigation + the signed-in user.
import { ChevronLeft, Lock, LogOut, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavItem } from "./NavItem";
import { staffRoutes } from "./navRoutes";
import { can } from "../../utils/permissions";

// Build initials for the round avatar (e.g. "Zofia Wiśniewska" → "ZW").
function initialsOf(user) {
  const source = user?.name || user?.email || "";
  const parts = source.trim().split(/[\s@.]+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AppSidebar({ currentPath, navigate, collapsed, setCollapsed, user, onLogout, tenantId }) {
  const { t } = useTranslation();

  return (
    <aside
      className={`hidden lg:flex bg-white border-r border-slate-200 flex-col h-screen text-slate-700 transition-all duration-300 relative ${collapsed ? "w-16" : "w-64"}`}
      aria-label={t("common.appName")}
    >
      <div className="border-b border-slate-200 p-4 flex items-center justify-between">
        {!collapsed ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-cyan-600">
              <Shield className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="font-bold text-sm tracking-widest text-slate-900 uppercase">{t("common.appName")}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider font-semibold uppercase mt-0.5">
              {t("common.tagline")}
            </span>
          </div>
        ) : (
          <Shield className="w-6 h-6 text-cyan-600 mx-auto" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          aria-expanded={!collapsed}
          className="absolute -right-3 top-5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-full p-1 hover:bg-slate-50 z-10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label={t("nav.authorizedStaff")}>
        <div>
          {!collapsed && (
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-semibold">
                {t("nav.authorizedStaff")}
              </span>
              <span className="text-[9px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 uppercase font-mono">MFA</span>
            </div>
          )}
          <ul className="space-y-1">
            {staffRoutes
              .filter((item) => !item.cap || can(user, item.cap))
              .map((item) => (
                <li key={item.path}>
                  <NavItem item={item} currentPath={currentPath} navigate={navigate} compact={collapsed} tenantId={tenantId} />
                </li>
              ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-slate-200 p-4 space-y-3">
        {user &&
          (!collapsed ? (
            <div className="flex items-center gap-2.5">
              {/* Clicking the user's name/avatar opens their profile page. */}
              <button
                type="button"
                onClick={() => navigate("/profile")}
                title={t("profile.title")}
                aria-label={t("profile.title")}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-lg p-1 -m-1 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <div className="w-8 h-8 shrink-0 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center font-bold text-cyan-700 text-[11px]">
                  {initialsOf(user)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">{user.name || user.email}</p>
                  <p className="text-[10px] text-slate-500 truncate">{t(`roles.${user.safeVoiceRole || user.role}`, user.safeVoiceRole || user.role)}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={onLogout}
                aria-label={t("common.signOut")}
                title={t("common.signOut")}
                className="shrink-0 text-slate-400 hover:text-rose-600 p-1 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              aria-label={t("common.signOut")}
              title={t("common.signOut")}
              className="w-full flex justify-center text-slate-400 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          ))}

        {!collapsed ? (
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center gap-1.5 text-[10px] font-mono font-semibold text-slate-700 leading-none">
            <Lock className="w-3 h-3 text-emerald-600" aria-hidden="true" />
            {t("dashboard.posture.telemetryValue")}
          </div>
        ) : (
          <div className="flex justify-center text-emerald-600">
            <Lock className="w-4 h-4" aria-hidden="true" />
          </div>
        )}
      </div>
    </aside>
  );
}
