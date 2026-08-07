import { useState, useEffect, useRef } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCapabilities } from "../../hooks/useCapabilities";
import { CAPABILITIES } from "../../config/capabilities";
import { useTranslation } from "../../hooks/useTranslation";
import { HOME_SUBPATH, useOrgBase, useOrgHome } from "../../utils/paths";
import LanguageToggle from "./LanguageToggle";

// Every menu item says which ONE thing a user must be allowed to do before the
// link is shown. For example "Audit Reports" needs AUDIT_READ, which admins and
// auditors have but HR does not — so HR simply never sees that menu item instead
// of clicking it and being turned away.
//
// An item with no `capability` is shown to everyone who can open SafeWork.
//
// WHAT CHANGED AND WHY: `path` used to hold the FINISHED address ("/employees").
// It now holds only the tail of it, and the "/company/{tenantId}" start is added
// below when the menu is drawn. Every page moved under the company it belongs to,
// so a finished address written here would have had to repeat the tenant id in
// every row — and any one row left behind would have quietly dropped the user out
// of their company URL. The old nameless landing page also got a real name, so the
// first item points at "/home" instead of "/".
const NAV_ITEMS = [
  { labelKey: "nav.home", path: "/home", capability: CAPABILITIES.DASHBOARD_READ },
  {
    labelKey: "nav.employees",
    path: "/employees",
    capability: CAPABILITIES.EMPLOYEE_READ,
    // children: [
    //   { label: "Employee List", path: "/employees" },
    //   { label: "Add Employee", path: "/employees/add" },
    //   { label: "Compliance Timeline", path: "/employees/compliance-timeline" },
    //   { label: "Risk Assessment", path: "/employees/risk-assessment" },
    //   { label: "Safety Training", path: "/employees/safety-training" },
    //   { label: "Incident Management", path: "/employees/incident-management" },
    // ],
  },
  {
    labelKey: "nav.auditReports",
    path: "/audit-logs",
    capability: CAPABILITIES.AUDIT_READ,
  },
  { labelKey: "nav.dashboard", path: "/dashboard", capability: CAPABILITIES.DASHBOARD_READ },
  // { label: "Reports", path: "/reports" },
  // { label: "Contact", path: "/contact" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileExpanded, setMobileExpanded] = useState(null);

  // Auth state for the Sign In / Sign Out button.
  // login() sends the user to the central RegulaOne login page.
  // logout() clears the shared cookie and returns to the central login page.
  const { isAuthenticated, login, logout } = useAuth();

  // What this user is allowed to do. Used to drop menu items they cannot use.
  const { can } = useCapabilities();

  // t() gives us the words for the language the user picked (Polish by default).
  const { t } = useTranslation();

  // "/company/{tenantId}" — the start of every link in this header, and the full
  // address of the home page for the logo link.
  const orgBase = useOrgBase();
  const orgHome = useOrgHome();

  // Keep only the menu items this user's role covers. Items with no capability
  // set are always kept. We work this out once per render of the header, and both
  // the desktop and mobile menus use the same list so they can never disagree.
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.capability || can(item.capability)
  );

  const dropdownRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-300 ${
        scrolled
          ? "shadow-md shadow-slate-200/60 border-b border-slate-100"
          : "border-b border-slate-100/80"
      }`}
    >
      {/* Top Accent Line */}
      <div className="h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            /* The logo goes home — inside the user's own company. */
            to={orgHome}
            className="flex items-center gap-3 group flex-shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-shadow duration-300">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>

              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse ring-2 ring-white" />
            </div>

            <div className="leading-tight">
              <span className="text-slate-900 font-extrabold text-lg tracking-tight group-hover:text-emerald-700 transition-colors duration-200">
                Safe<span className="text-emerald-600">Work</span>
              </span>

              <p className="text-slate-400 text-[10px] font-medium tracking-widest uppercase leading-none">
                {t("nav.brandTagline")}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav ref={dropdownRef} className="hidden lg:flex items-center gap-1">
            {visibleNavItems.map((item) =>
              item.children ? (
                <div
                  key={item.labelKey}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.labelKey)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    type="button"
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      openDropdown === item.labelKey
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70"
                    }`}
                  >
                    {t(item.labelKey)}

                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        openDropdown === item.labelKey
                          ? "rotate-180 text-emerald-600"
                          : "text-slate-400"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>

                  {openDropdown === item.labelKey && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-52 z-50">
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden animate-fade-in-down">
                        <div className="p-1.5">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.path}
                              to={`${orgBase}${child.path}`}
                              onClick={() => setOpenDropdown(null)}
                              className={({ isActive }) =>
                                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                                  isActive
                                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                                    : "text-slate-600 hover:bg-emerald-50/70 hover:text-emerald-700"
                                }`
                              }
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                              {t(child.labelKey)}
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  key={item.path}
                  // Full address = the company base + this item's tail.
                  to={`${orgBase}${item.path}`}
                  // `end` means "highlight only on an exact match". We want it for
                  // Home only. The other items keep partial matching on purpose, so
                  // "Employees" stays highlighted while you read one person's
                  // profile at …/employees/12.
                  end={item.path === HOME_SUBPATH}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70"
                    }`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              )
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language switch (PL / EN). Polish is the default. */}
            <LanguageToggle />

            <button
              onClick={() => (isAuthenticated ? logout() : login())}
              className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-emerald-50/70"
            >
              {isAuthenticated ? t("nav.signOut") : t("nav.signIn")}
            </button>

            <Link
              to={`${orgBase}/contact`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 active:scale-95"
            >
              {t("nav.getStarted")}

              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex flex-col justify-center items-center w-10 h-10 rounded-xl hover:bg-slate-100 transition-colors duration-200 gap-1.5"
            aria-label={t("nav.toggleMenu")}
          >
            <span
              className={`block w-5 h-0.5 bg-slate-600 transition-all duration-300 ${
                mobileOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />

            <span
              className={`block w-5 h-0.5 bg-slate-600 transition-all duration-300 ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />

            <span
              className={`block w-5 h-0.5 bg-slate-600 transition-all duration-300 ${
                mobileOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden transition-all duration-300 overflow-hidden ${
          mobileOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-white border-t border-slate-100 px-4 pb-6 pt-2">
          {visibleNavItems.map((item) =>
            item.children ? (
              <div key={item.labelKey}>
                <button
                  onClick={() =>
                    setMobileExpanded(
                      mobileExpanded === item.labelKey ? null : item.labelKey
                    )
                  }
                  className="w-full flex items-center justify-between py-3 text-sm font-medium text-slate-600 hover:text-emerald-700 border-b border-slate-100"
                >
                  {t(item.labelKey)}

                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      mobileExpanded === item.labelKey
                        ? "rotate-180 text-emerald-600"
                        : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>

                {mobileExpanded === item.labelKey && (
                  <div className="pl-4 pb-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={`${orgBase}${child.path}`}
                        onClick={() => {
                          setMobileOpen(false);
                          setMobileExpanded(null);
                        }}
                        className={({ isActive }) =>
                          `flex items-center gap-2 py-2.5 text-sm border-b border-slate-50 ${
                            isActive
                              ? "text-emerald-700 font-semibold"
                              : "text-slate-500 hover:text-emerald-700"
                          }`
                        }
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {t(child.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={item.path}
                // Same address rule as the desktop menu above.
                to={`${orgBase}${item.path}`}
                end={item.path === HOME_SUBPATH}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex py-3 text-sm font-medium border-b border-slate-100 ${
                    isActive
                      ? "text-emerald-700 font-semibold"
                      : "text-slate-600 hover:text-emerald-700"
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            )
          )}

          <div className="mt-5 flex flex-col gap-3">
            {/* Same language switch as the desktop header, so a phone user can
                change language without opening anything else. */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-medium text-slate-600">{t("language.label")}</span>
              <LanguageToggle />
            </div>

            <button
              onClick={() => {
                setMobileOpen(false);
                isAuthenticated ? logout() : login();
              }}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              {isAuthenticated ? t("nav.signOut") : t("nav.signIn")}
            </button>

            <Link
              to={`${orgBase}/contact`}
              onClick={() => setMobileOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold text-center shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all"
            >
              {t("nav.getStarted")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}