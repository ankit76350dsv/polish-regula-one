import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../../context/AuthContext";

// Navigation items. `adminOnly` items are shown only to admins/super admins.
const NAV_ITEMS = [
  { label: "Clock", path: "/" },
  { label: "My Timesheet", path: "/my-timesheet" },
  { label: "Absences", path: "/absences" },
  { label: "Time Records", path: "/records", adminOnly: true },
  { label: "Dashboard", path: "/dashboard", adminOnly: true },
  { label: "Policy", path: "/policy", adminOnly: true },
  { label: "Audit", path: "/audit-logs", adminOnly: true },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, login, logout } = useAuth();

  // Read the user from Redux to decide which nav items to show.
  const user = useSelector((state) => state.auth.user);
  const isAdmin = ["ROLE_ADMIN", "ROLE_SUPER_ADMIN"].includes(user?.role);
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
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
                Poland · Working Time
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {items.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.path === "/"} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-3">
            {user?.name || user?.email ? (
              <span className="text-xs text-slate-500 max-w-[180px] truncate">{user.name || user.email}</span>
            ) : null}
            <button
              onClick={() => (isAuthenticated ? logout() : login())}
              className="text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 rounded-xl shadow-md shadow-indigo-500/25 hover:from-indigo-400 hover:to-blue-400 transition-all active:scale-95"
            >
              {isAuthenticated ? "Sign Out" : "Sign In"}
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex flex-col justify-center items-center w-10 h-10 rounded-xl hover:bg-slate-100 gap-1.5"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-slate-600 transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-slate-600 transition-all ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-slate-600 transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`lg:hidden transition-all duration-300 overflow-hidden ${mobileOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"}`}>
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
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => {
              setMobileOpen(false);
              isAuthenticated ? logout() : login();
            }}
            className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-semibold"
          >
            {isAuthenticated ? "Sign Out" : "Sign In"}
          </button>
        </div>
      </div>
    </header>
  );
}
