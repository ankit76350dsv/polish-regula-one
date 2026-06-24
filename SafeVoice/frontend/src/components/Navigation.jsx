import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertOctagon,
  ChevronLeft,
  FileCheck2,
  Home,
  Inbox,
  Languages,
  Lock,
  Settings,
  Shield,
  ShieldCheck,
  Terminal,
  UserCheck,
} from "lucide-react";
import { useJurisdiction } from "../config/activeJurisdiction";

export function AppSidebar({
  currentPath,
  onNavigate,
  activeRole,
  unreadCount = 0,
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const isPublic = activeRole === "Public User";

  const publicMenuItems = [
    { label: t("nav.submitReport"), path: "/report", icon: Shield },
    { label: t("nav.trackReport"), path: "/track", icon: ShieldCheck },
  ];

  const adminMenuItems = [
    { label: t("nav.caseOperations"), path: "/dashboard", icon: Home },
    { label: t("nav.caseRegister"), path: "/cases", icon: AlertOctagon },
    {
      label: t("nav.secureInbox"),
      path: "/messages",
      icon: Inbox,
      count: unreadCount,
    },
    { label: t("nav.auditTrail"), path: "/audits", icon: Terminal },
    { label: t("nav.accessControls"), path: "/users", icon: UserCheck },
    { label: t("nav.complianceSettings"), path: "/settings", icon: Settings },
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col h-screen text-slate-700 transition-all duration-300 relative ${
        collapsed ? "w-16" : "w-64"
      }`}
      aria-label={t("app.name")}
    >
      <div className="border-b border-slate-200 p-4 flex items-center justify-between">
        {!collapsed && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-cyan-600">
              <Shield className="w-5 h-5 shrink-0" />
              <span className="font-bold text-sm tracking-widest text-slate-900 uppercase">
                {t("app.name")}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider font-semibold uppercase mt-0.5">
              {t("app.tagline")}
            </span>
          </div>
        )}
        {collapsed && <Shield className="w-6 h-6 text-cyan-600 mx-auto" />}

        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={
            collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")
          }
          aria-expanded={!collapsed}
          className="absolute -right-3 top-5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-full p-1 cursor-pointer hover:bg-slate-550 hover:bg-slate-50 z-10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <ChevronLeft
            className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
        aria-label={t("nav.reporterPortal")}
      >
        <div>
          {!collapsed && (
            <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase px-3 mb-2 font-semibold">
              {t("nav.reporterPortal")}
            </p>
          )}
          <ul className="space-y-1">
            {publicMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath.startsWith(item.path);
              return (
                <li key={item.path}>
                  <button
                    onClick={() => onNavigate(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isActive
                        ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                        : "hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          {!collapsed && (
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-semibold">
                {t("nav.authorizedStaff")}
              </span>
              <span className="text-[9px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 uppercase font-mono">
                {t("nav.mfa")}
              </span>
            </div>
          )}
          <ul className="space-y-1">
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath.startsWith(item.path);
              return (
                <li key={item.path}>
                  <button
                    onClick={() =>
                      onNavigate(isPublic ? "/access-denied" : item.path)
                    }
                    title={isPublic ? t("nav.switchRoleHint") : item.label}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={isActive && !isPublic ? "page" : undefined}
                    aria-disabled={isPublic}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors relative focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isPublic
                        ? "cursor-not-allowed text-slate-400 border border-transparent"
                        : isActive
                          ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                          : "hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent cursor-pointer"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                    {item.count &&
                      item.count > 0 &&
                      !collapsed &&
                      !isPublic && (
                        <span className="absolute right-3 top-2.5 bg-cyan-600 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-bold select-none">
                          {item.count}
                        </span>
                      )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="border-t border-slate-200 p-4">
        {!collapsed ? (
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-slate-700 leading-none">
              <Lock className="w-3 h-3 text-emerald-600" />{" "}
              {t("nav.noTelemetryTitle")}
            </div>
            <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">
              {t("nav.noTelemetryBody")}
            </p>
          </div>
        ) : (
          <div className="flex justify-center text-emerald-600">
            <Lock className="w-4 h-4" />
          </div>
        )}
      </div>
    </aside>
  );
}

export function AppNavbar({ activeRole, setActiveRole }) {
  const { t, i18n } = useTranslation();
  const jurisdiction = useJurisdiction();
  const roles = [
    "Public User",
    "Super Admin",
    "Compliance Officer",
    "Investigator",
    "HR Manager",
    "Auditor",
  ];

  const isPublic = activeRole === "Public User";

  // Short compliance chip for the active country (EU-adaptable; Poland shows its 2024 Act).
  const jurisdictionChip =
    jurisdiction.code === "PL" ? "Poland 2024 Act" : jurisdiction.countryName;

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold text-slate-700">
            {t("navbar.intakeActive")}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-600 border border-slate-200">
          <span>GDPR</span>
          <span className="w-px h-2.5 bg-slate-200" />
          <span>EU 2019/1937</span>
          <span className="w-px h-2.5 bg-slate-200" />
          <span>{jurisdictionChip}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 relative">
        {/* Language switcher — supports Polish-first localisation and EU-wide reuse. */}
        <div className="flex items-center gap-1.5">
          <Languages className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <label htmlFor="language-select" className="sr-only">
            {t("language.label")}
          </label>
          <select
            id="language-select"
            value={i18n.language?.split("-")[0]}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-white text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg px-2 py-1.5 outline-none cursor-pointer focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          >
            {jurisdiction.supportedLocales.map((locale) => (
              <option key={locale} value={locale}>
                {t(`language.${locale}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="role-simulator"
            className="text-xs text-slate-500 font-medium hidden sm:inline"
          >
            {t("navbar.roleSimulator")}
          </label>
          <select
            id="role-simulator"
            value={activeRole}
            onChange={(e) => setActiveRole(e.target.value)}
            className="bg-white text-xs font-semibold text-cyan-700 border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden lg:flex items-center gap-2.5 border-l border-slate-200 pl-4">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-800 leading-none">
              {isPublic
                ? t("navbar.anonymousSession")
                : t(`roles.${activeRole}`)}
            </span>
            <span className="text-[10px] font-mono text-slate-550 mt-1 uppercase font-bold tracking-wider">
              {isPublic ? t("navbar.noLogin") : t("navbar.mfaIdle")}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center font-bold text-cyan-600 text-xs">
            <FileCheck2 className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
