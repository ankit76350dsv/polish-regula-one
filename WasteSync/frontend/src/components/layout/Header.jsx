import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../../context/AuthContext";
import { useCapabilities } from "../../hooks/useCapabilities";
import { CAPABILITIES } from "../../config/capabilities";
import { useTranslation } from "../../hooks/useTranslation";
import { useOrgBase } from "../../utils/paths";
import LanguageToggle from "./LanguageToggle";

// The main navigation bar shown on every signed-in page.
//
// Each item names the ONE thing a person must be allowed to do before the link is
// shown. We name a CAPABILITY rather than a job title because "admin or not"
// cannot express the real rules: an auditor must see Waste Entries, Reports and
// Audit Logs, while an HR manager sees everything EXCEPT Audit Logs.
//
// Hiding a link is only about a tidy menu. Every page is also wrapped in
// RequireCapability, and the backend refuses the API calls regardless — typing the
// address by hand gets a person nowhere.
//
// WHAT CHANGED AND WHY: each item used to carry a finished English word in
// `label`. It now carries a `labelKey` instead — the name of an entry in the
// language files. The old way could only ever produce one language, so a Polish
// user read an English menu in an app built for the Polish market. Looking the
// word up while drawing means the menu re-labels itself the moment the PL / EN
// switch is pressed, with no page reload and no second copy of this list.
//
// WHAT CHANGED AND WHY (second change): `to` used to hold the FINISHED address
// ("/reports"). It now holds only the tail of it, and the "/company/{tenantId}"
// start is added below when the menu is drawn. Every page moved under the company
// it belongs to, so a finished address written here would have had to repeat the
// tenant id in six places — and any one of them left behind would have quietly
// dropped the user out of their company URL.
const navItems = [
  { to: "/home", labelKey: "nav.dashboard", end: true, capability: CAPABILITIES.DASHBOARD_READ },
  // One company per customer, read from RegulaOne — so the link is singular.
  { to: "/companies", labelKey: "nav.company", capability: CAPABILITIES.COMPANY_READ },
  { to: "/waste-entries", labelKey: "nav.wasteEntries", capability: CAPABILITIES.WASTE_ENTRY_READ },
  { to: "/reports", labelKey: "nav.reports", capability: CAPABILITIES.REPORT_READ },
  { to: "/thresholds", labelKey: "nav.thresholds", capability: CAPABILITIES.THRESHOLD_READ },
  { to: "/audit-logs", labelKey: "nav.auditLogs", capability: CAPABILITIES.AUDIT_READ },
];

export default function Header() {
  const { logout } = useAuth();
  const user = useSelector((state) => state.auth.user);

  // "/company/{tenantId}" for the signed-in user — the start of every menu link.
  const orgBase = useOrgBase();

  // What this user is allowed to do decides which menu items appear.
  const { can } = useCapabilities();
  const items = navItems.filter((item) => can(item.capability));

  // t() gives us the words for the language the user picked (Polish by default).
  const { t } = useTranslation();

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-[65px] bg-white border-b border-slate-200">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white grid place-items-center font-bold">
            W
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-slate-900">WasteSync</div>
            <div className="text-[11px] text-slate-500">{t("nav.brandTagline")}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              // Full address = the company base + this item's tail. The `|| "/"`
              // only matters in the split second before we know the tenant: an
              // empty address is meaningless, so we point at the app root, which
              // forwards to the company dashboard as soon as /me answers.
              to={`${orgBase}${item.to}` || "/"}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Language + user + logout */}
        <div className="flex items-center gap-3">
          {/* The PL / EN switch. It is deliberately NOT hidden on small screens,
              unlike the e-mail beside it: on a phone the menu collapses away, so
              this would be the only way left to change language. */}
          <LanguageToggle />

          <span className="hidden sm:block text-sm text-slate-600 max-w-[160px] truncate">
            {user?.email || user?.name || t("nav.signedIn")}
          </span>
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50"
          >
            {t("nav.logOut")}
          </button>
        </div>
      </div>
    </header>
  );
}
