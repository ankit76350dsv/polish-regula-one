import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../NotificationBell";
import LanguageToggle from "./LanguageToggle";
import { useCapabilities } from "../../hooks/useCapabilities";
import { useTranslation } from "../../hooks/useTranslation";
import { CAPABILITIES } from "../../config/capabilities";

// Navigation items. Each one names the ONE thing a person must be allowed to do
// before the link is shown.
//
// This replaced an `adminOnly` flag. A flag can only say "admin or not", which
// cannot express the real rules: an AUDITOR must see Time Records, the Dashboard
// and Audit, but must NOT see the Clock screen; an HR ADMIN sees everything except
// Audit and Policy. Naming the capability lets each item follow the real policy in
// config/capabilities.js.
//
// `labelKey` is a translation key rather than finished text, so the menu switches
// language with the rest of the app. The words live in src/i18n/pl.js and en.js.
//
// `titleKey` is the screen's FULL name, shown as a tooltip on hover. The menu
// label itself is kept short so eight items fit across one row — Polish names are
// much longer than English ones ("Ewidencja" in the menu, "Ewidencja czasu pracy"
// as the page heading and tooltip).
const NAV_ITEMS = [
  { labelKey: "nav.clock",       titleKey: "nav.clock",         path: "/",             capability: CAPABILITIES.CLOCK_SELF },
  { labelKey: "nav.myTimesheet", titleKey: "timesheet.title",   path: "/my-timesheet", capability: CAPABILITIES.TIME_SELF_READ },
  { labelKey: "nav.absences",    titleKey: "absences.title",    path: "/absences",     capability: CAPABILITIES.ABSENCE_SELF, alsoIf: CAPABILITIES.ABSENCE_READ_ALL },
  { labelKey: "nav.timeRecords", titleKey: "records.title",     path: "/records",      capability: CAPABILITIES.TIME_READ_ALL },
  { labelKey: "nav.dashboard",   titleKey: "dashboard.title",   path: "/dashboard",    capability: CAPABILITIES.DASHBOARD_READ },
  { labelKey: "nav.settlement",  titleKey: "settlement.title",  path: "/settlement",   capability: CAPABILITIES.SETTLEMENT_SELF_READ, alsoIf: CAPABILITIES.SETTLEMENT_READ_ALL },
  { labelKey: "nav.policy",      titleKey: "policy.title",      path: "/policy",       capability: CAPABILITIES.POLICY_READ },
  { labelKey: "nav.audit",       titleKey: "audit.title",       path: "/audit-logs",   capability: CAPABILITIES.AUDIT_READ },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, login, logout } = useAuth();

  // The signed-in person, used to show their name in the corner.
  const user = useSelector((state) => state.auth.user);

  // What this user is allowed to do decides which menu items appear.
  const { can } = useCapabilities();

  // Everything the header shows in words comes from the chosen language.
  const { t } = useTranslation();

  // An item shows when the user holds its capability, OR the second one listed in
  // `alsoIf`. That covers the two screens that serve two audiences: Absences works
  // for a worker asking for leave AND for HR reviewing requests, and Settlement
  // shows either your own balance or the whole tenant's report.
  const items = NAV_ITEMS.filter((i) => can(i.capability) || (i.alsoIf && can(i.alsoIf)));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // `whitespace-nowrap` is the important part: without it a long Polish label
  // ("Nieobecności", "Rozliczenie") breaks across two lines inside its own pill,
  // which is what made the menu look scattered. A menu item must always be one
  // line — if the row runs out of space we switch to the mobile menu instead
  // (see the xl: breakpoint below), rather than letting text wrap.
  const linkClass = ({ isActive }) =>
    `px-2.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
      isActive
        ? "bg-indigo-50 text-indigo-700 font-semibold"
        : "text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/70"
    }`;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-300 ${
        scrolled ? "shadow-md shadow-slate-200/60 border-b border-slate-100" : "border-b border-slate-100/80"
      }`}
    >
      <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-blue-400 to-indigo-600" />

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* flex-nowrap: the three blocks (logo / menu / actions) stay on one
            row. Any shortage of space is handled by switching to the mobile menu
            at the xl: breakpoint, never by wrapping. */}
        <div className="flex items-center justify-between h-16 gap-2 flex-nowrap">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0" onClick={() => setMobileOpen(false)}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
            </div>
            <div className="leading-tight">
              <span className="text-slate-900 font-extrabold text-lg tracking-tight group-hover:text-indigo-700 transition-colors">
                Work<span className="text-indigo-600">Pulse</span>
              </span>
              <p className="text-slate-400 text-[10px] font-medium tracking-widest uppercase leading-none">
                {t("nav.tagline")}
              </p>
            </div>
          </Link>

          {/* Desktop nav.
              Shown from xl (1280px) up, not lg (1024px). Eight Polish menu items
              plus the logo and the action buttons need about 1100px; at 1024px they
              were crushed together. Below xl the hamburger menu is used instead,
              where every item has a full row to itself. */}
          <nav className="hidden xl:flex items-center justify-center gap-0.5 flex-nowrap min-w-0">
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={linkClass}
                // The full screen name on hover, since the label is abbreviated.
                title={t(item.titleKey)}
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>

          {/* Desktop right side. flex-shrink-0 so the sign-out button keeps its
              full width and is never squashed by a long menu. */}
          <div className="hidden xl:flex items-center gap-2 flex-shrink-0">
            {/* PL / EN switch. Placed before the bell so the two icon-style
                controls sit together on the right. */}
            <LanguageToggle />
            {/* Live break/overtime/rest alerts — only for signed-in users. */}
            {isAuthenticated && <NotificationBell />}
            {/* Only on very wide screens: this is the first thing worth dropping
                when space is short, because the person already knows who they are
                and the same email is shown on the account screens. */}
            {user?.name || user?.email ? (
              <span className="hidden 2xl:inline text-xs text-slate-500 max-w-[160px] truncate">
                {user.name || user.email}
              </span>
            ) : null}
            <button
              onClick={() => (isAuthenticated ? logout() : login())}
              className="text-sm font-medium text-white whitespace-nowrap bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 rounded-xl shadow-md shadow-indigo-500/25 hover:from-indigo-400 hover:to-blue-400 transition-all active:scale-95"
            >
              {isAuthenticated ? t("common.signOut") : t("common.signIn")}
            </button>
          </div>

          {/* Mobile / tablet right side: language switch + alerts bell + hamburger.
              Uses xl:hidden to match the nav above exactly — one of the two is
              always showing, never both and never neither. */}
          <div className="xl:hidden flex items-center gap-1 flex-shrink-0">
            <LanguageToggle />
            {isAuthenticated && <NotificationBell />}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex flex-col justify-center items-center w-10 h-10 rounded-xl hover:bg-slate-100 gap-1.5"
              aria-label={t("nav.toggleMenu")}
            >
            <span className={`block w-5 h-0.5 bg-slate-600 transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-slate-600 transition-all ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-0.5 bg-slate-600 transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu.
          Here each item gets a whole row to itself, so there is room for the FULL
          screen name (titleKey) instead of the short one used in the top row. A
          Polish user reading the menu on a phone sees "Ewidencja czasu pracy"
          rather than just "Ewidencja". */}
      <div className={`xl:hidden transition-all duration-300 overflow-hidden ${mobileOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="bg-white border-t border-slate-100 px-4 pb-6 pt-2">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex py-3 text-sm font-medium border-b border-slate-100 ${
                  isActive ? "text-indigo-700 font-semibold" : "text-slate-600 hover:text-indigo-700"
                }`
              }
            >
              {t(item.titleKey)}
            </NavLink>
          ))}
          <button
            onClick={() => {
              setMobileOpen(false);
              isAuthenticated ? logout() : login();
            }}
            className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-semibold"
          >
            {isAuthenticated ? t("common.signOut") : t("common.signIn")}
          </button>
        </div>
      </div>
    </header>
  );
}
