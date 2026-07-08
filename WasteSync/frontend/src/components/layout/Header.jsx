import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../../context/AuthContext";

// The main navigation bar shown on every signed-in page.
const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/companies", label: "Companies" },
  { to: "/waste-entries", label: "Waste Entries" },
  { to: "/reports", label: "Reports" },
  { to: "/thresholds", label: "Thresholds" },
  { to: "/audit-logs", label: "Audit Logs" },
];

export default function Header() {
  const { logout } = useAuth();
  const user = useSelector((state) => state.auth.user);

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
            <div className="text-[11px] text-slate-500">BDO Reporting</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-slate-600 max-w-[160px] truncate">
            {user?.email || user?.name || "Signed in"}
          </span>
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
