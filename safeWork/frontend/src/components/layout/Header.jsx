import { useState, useEffect, useRef } from "react";
import { NavLink, Link } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Home", path: "/" },
  {
    label: "Employees",
    path: "/employees",
    children: [
      { label: "Employee List", path: "/employees" },
      { label: "Add Employee", path: "/employees/add" },
      { label: "Compliance Timeline", path: "/employees/compliance-timeline" },
      { label: "Risk Assessment", path: "/employees/risk-assessment" },
      { label: "Safety Training", path: "/employees/safety-training" },
      { label: "Incident Management", path: "/employees/incident-management" },
    ],
  },
  {
    label: "Audit Reports",
    path: "/employees/compliance-audits",
  },
  { label: "Dashboard", path: "/dashboard" },
  { label: "Reports", path: "/reports" },
  { label: "Contact", path: "/contact" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileExpanded, setMobileExpanded] = useState(null);

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
            to="/"
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
                Poland · HRMS Platform
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav ref={dropdownRef} className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    type="button"
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      openDropdown === item.label
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70"
                    }`}
                  >
                    {item.label}

                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        openDropdown === item.label
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

                  {openDropdown === item.label && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-52 z-50">
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden animate-fade-in-down">
                        <div className="p-1.5">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.path}
                              to={child.path}
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
                              {child.label}
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
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <button className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-emerald-50/70">
              Sign In
            </button>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 active:scale-95"
            >
              Get Started

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
            aria-label="Toggle menu"
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
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div key={item.label}>
                <button
                  onClick={() =>
                    setMobileExpanded(
                      mobileExpanded === item.label ? null : item.label
                    )
                  }
                  className="w-full flex items-center justify-between py-3 text-sm font-medium text-slate-600 hover:text-emerald-700 border-b border-slate-100"
                >
                  {item.label}

                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      mobileExpanded === item.label
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

                {mobileExpanded === item.label && (
                  <div className="pl-4 pb-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
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
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex py-3 text-sm font-medium border-b border-slate-100 ${
                    isActive
                      ? "text-emerald-700 font-semibold"
                      : "text-slate-600 hover:text-emerald-700"
                  }`
                }
              >
                {item.label}
              </NavLink>
            )
          )}

          <div className="mt-5 flex flex-col gap-3">
            <button className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors">
              Sign In
            </button>

            <Link
              to="/contact"
              onClick={() => setMobileOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold text-center shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}