import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeeSlice";

// ─── Status config ─────────────────────────────────────────────────────────────
const statusConfig = {
  valid:     { label: "Valid",           className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  compliant: { label: "Compliant",       className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  allowed:   { label: "Allowed",         className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  expiring:  { label: "Expiring Soon",   className: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500"   },
  warning:   { label: "Non-Compliant",   className: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500"   },
  expired:   { label: "Expired",         className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  missing:   { label: "Missing",         className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  blocked:   { label: "Blocked",         className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.missing;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function formatDate(dateValue) {
  if (!dateValue) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dateValue));
}

// ─── Data-shape helpers ────────────────────────────────────────────────────────
// API shape (flat): { _id, userId, user: { name, email, role, ... },
//   department, position, site, contractType,
//   medicalCertificate: { status, expiryDate }, bhpTraining: { status, expiryDate },
//   complianceStatus, isBlocked, blockReason, ... }

function displayName(e) {
  return e.user?.name || e.user?.email || "Unknown";
}

// Normalise backend UPPERCASE enum → lowercase statusConfig key
function medicalStatus(e) {
  return e.medicalCertificate?.status?.toLowerCase() ?? "missing";
}

function bhpStatus(e) {
  return e.bhpTraining?.status?.toLowerCase() ?? "missing";
}

function overallStatus(e) {
  const s = e.complianceStatus;
  if (s === "COMPLIANT") return "compliant";
  if (s === "EXPIRING")  return "expiring";
  if (s === "BLOCKED")   return "blocked";
  return "warning"; // NON_COMPLIANT or unknown
}

function clockInStatus(e) {
  return e.isBlocked ? "blocked" : "allowed";
}

function resolveBlockReason(e) {
  const med = e.medicalCertificate;
  const bhp = e.bhpTraining;
  if (med?.status === "EXPIRED") return `Medical expired on ${formatDate(med.expiryDate)}`;
  if (med?.status === "MISSING") return "Medical certificate is missing";
  if (bhp?.status === "EXPIRED") return `BHP training expired on ${formatDate(bhp.expiryDate)}`;
  if (bhp?.status === "MISSING") return "BHP training certificate is missing";
  return e.blockReason || "Compliance block active";
}

// Static option lists — match the values used in AddEmployee and EmployeeProfile.
// Kept here so filter dropdowns work even before any data is loaded.
// Department filter options for the employee list.
// "All" is a special filter value that means "do not filter by department".
// Each item has: value -> what we send to the backend filter (kept as the
// original English name so it matches saved records); label -> what we SHOW
// (bilingual "Polish / English"). MUST stay in sync with the DEPARTMENTS list
// used in AddEmployee.jsx and EmployeeProfile.jsx.
const DEPARTMENTS = [
  { value: "All",                    label: "All Departments" },
  { value: "Warehouse",              label: "Magazyn / Warehouse" },
  { value: "Operations",             label: "Operacje / Operations" },
  { value: "Manufacturing",          label: "Wytwarzanie / Manufacturing" },
  { value: "Production",             label: "Produkcja / Production" },
  { value: "Logistics",              label: "Logistyka / Logistics" },
  { value: "Supply Chain",           label: "Łańcuch dostaw / Supply Chain" },
  { value: "Procurement",            label: "Zakupy / Procurement" },
  { value: "Transport",              label: "Transport" },
  { value: "Distribution",           label: "Dystrybucja / Distribution" },
  { value: "Maintenance",            label: "Utrzymanie ruchu / Maintenance" },
  { value: "Engineering",            label: "Inżynieria / Engineering" },
  { value: "Quality Assurance",      label: "Zapewnienie jakości / Quality Assurance" },
  { value: "Quality Control",        label: "Kontrola jakości / Quality Control" },
  { value: "Research & Development", label: "Badania i rozwój / R&D" },
  { value: "Health & Safety (BHP)",  label: "BHP / Health & Safety" },
  { value: "Environmental",          label: "Ochrona środowiska / Environmental" },
  { value: "Facilities",             label: "Obsługa obiektu / Facilities" },
  { value: "Admin",                  label: "Administracja / Admin" },
  { value: "HR",                     label: "Kadry / HR" },
  { value: "IT",                     label: "Informatyka / IT" },
  { value: "Finance",                label: "Finanse / Finance" },
  { value: "Accounting",             label: "Księgowość / Accounting" },
  { value: "Legal",                  label: "Dział prawny / Legal" },
  { value: "Compliance",             label: "Zgodność / Compliance" },
  { value: "Sales",                  label: "Sprzedaż / Sales" },
  { value: "Marketing",              label: "Marketing" },
  { value: "Customer Service",       label: "Obsługa klienta / Customer Service" },
  { value: "Security",               label: "Ochrona / Security" },
  { value: "Training & Development", label: "Szkolenia i rozwój / Training & Development" },
  { value: "Project Management",     label: "Zarządzanie projektami / Project Management" },
];
const SITES = [
  "All", "Warsaw Site", "Krakow Site", "Gdansk Site",
  "Poznan Site", "Warsaw HQ", "Wroclaw Site",
];

// ─── Component ─────────────────────────────────────────────────────────────────
function EmployeeList() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: employees, pagination, summary, loading, error } = useSelector((s) => s.employees);

  const [searchTerm, setSearchTerm]                 = useState("");
  const [debouncedSearch, setDebouncedSearch]       = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedSite, setSelectedSite]             = useState("All");
  const [selectedStatus, setSelectedStatus]         = useState("All");
  const [currentPage, setCurrentPage]               = useState(1);
  const [itemsPerPage, setItemsPerPage]             = useState(10);

  // Debounce the search input — waits 350 ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Re-fetch whenever any filter OR page value changes.
  // All filtering and pagination is done by the backend.
  useEffect(() => {
    dispatch(fetchEmployees({
      search:           debouncedSearch   || undefined,
      department:       selectedDepartment !== "All" ? selectedDepartment : undefined,
      site:             selectedSite       !== "All" ? selectedSite       : undefined,
      complianceStatus: selectedStatus     !== "All" ? selectedStatus     : undefined,
      page:  currentPage,
      limit: itemsPerPage,
    }));
  }, [debouncedSearch, selectedDepartment, selectedSite, selectedStatus, currentPage, itemsPerPage, dispatch]);

  const safeList = Array.isArray(employees) ? employees : [];

  // Cards use summary from the backend — counts across ALL filtered employees,
  // not just the current page — so the numbers stay correct when paginating.
  const totalCount     = summary?.total     ?? 0;
  const compliantCount = summary?.compliant ?? 0;
  const expiringCount  = summary?.expiring  ?? 0;
  const blockedCount   = summary?.blocked   ?? 0;

  // Helpers to reset the page when a filter changes.
  function handleDepartmentChange(val) { setSelectedDepartment(val); setCurrentPage(1); }
  function handleSiteChange(val)       { setSelectedSite(val);       setCurrentPage(1); }
  function handleStatusChange(val)     { setSelectedStatus(val);     setCurrentPage(1); }
  function handleSearchChange(val)     { setSearchTerm(val);         setCurrentPage(1); }
  function handleLimitChange(val)      { setItemsPerPage(Number(val)); setCurrentPage(1); }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-blue-100 ring-1 ring-white/20">
                SafeWork HR Compliance
              </p>
              <h1 className="text-3xl font-bold">Employee Compliance Register</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Track employee medical certificates, BHP safety training, document expiry status, and clock-in eligibility.
              </p>
            </div>
            <button
              onClick={() => navigate("/employees/add")}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-blue-50"
            >
              + Add Employee
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            Failed to load employees: {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Employees</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? "…" : totalCount}</p>
            <p className="mt-1 text-sm text-slate-400">Active user records</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Compliant</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{loading ? "…" : compliantCount}</p>
            <p className="mt-1 text-sm text-slate-400">Medical + BHP valid</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Expiring Soon</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{loading ? "…" : expiringCount}</p>
            <p className="mt-1 text-sm text-slate-400">Within warning period</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Blocked</p>
            <p className="mt-2 text-3xl font-bold text-red-600">{loading ? "…" : blockedCount}</p>
            <p className="mt-1 text-sm text-slate-400">Clock-in not allowed</p>
          </div>
        </div>

        {/* Filters — values are sent to the backend as query params */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <input
              type="text"
              placeholder="Search name, email, position, site…"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            />
            <select
              value={selectedDepartment}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <select
              value={selectedSite}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            >
              {SITES.map((s) => (
                <option key={s} value={s}>{s === "All" ? "All Sites" : s}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            >
              <option value="All">All Compliance Status</option>
              <option value="compliant">Compliant</option>
              <option value="expiring">Expiring Soon</option>
              <option value="warning">Non-Compliant</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Employee List</h2>
              <p className="text-sm text-slate-500">
                {loading ? "Loading…" : (() => {
                  const from = totalCount === 0 ? 0 : (pagination?.page - 1) * pagination?.limit + 1;
                  const to   = Math.min(pagination?.page * pagination?.limit, totalCount);
                  return `Showing ${from}–${to} of ${totalCount} employee${totalCount !== 1 ? "s" : ""}`;
                })()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Rows per page selector */}
              <label className="flex items-center gap-2 text-sm text-slate-500">
                Rows per page
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleLimitChange(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Export Register
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading employees…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Role / Site</th>
                    <th className="px-3 py-2">Medical</th>
                    <th className="px-3 py-2">BHP</th>
                    <th className="px-3 py-2">Overall</th>
                    <th className="px-3 py-2">Clock-in</th>
                    <th className="px-3 py-2">Expiry</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {safeList.map((employee) => (
                    <tr
                      key={employee._id}
                      className="cursor-pointer bg-slate-50 text-sm transition hover:bg-blue-50"
                      onClick={() => navigate(`/employees/${employee._id}`)}
                    >
                      {/* Identity — sourced from e.user (RegulaOne) */}
                      <td className="rounded-l-xl px-3 py-4">
                        <div>
                          <p className="font-bold text-slate-900">{displayName(employee)}</p>
                          <p className="text-xs text-slate-400">{employee.user?.email}</p>
                          <p className="text-xs font-medium text-slate-500 capitalize">
                            {employee.user?.role?.toLowerCase().replace(/_/g, " ")}
                          </p>
                        </div>
                      </td>

                      {/* Department / contract — from SafeWork profile (top-level) */}
                      <td className="px-3 py-4">
                        <p className="font-medium text-slate-700">{employee.department || "—"}</p>
                        <p className="text-xs text-slate-400">{employee.contractType || "—"}</p>
                      </td>

                      {/* Position / site */}
                      <td className="px-3 py-4">
                        <p className="font-medium text-slate-700">{employee.position || "—"}</p>
                        <p className="text-xs text-slate-400">{employee.site || "—"}</p>
                      </td>

                      <td className="px-3 py-4"><StatusBadge status={medicalStatus(employee)} /></td>
                      <td className="px-3 py-4"><StatusBadge status={bhpStatus(employee)} /></td>
                      <td className="px-3 py-4"><StatusBadge status={overallStatus(employee)} /></td>

                      {/* Clock-in status + block reason */}
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <StatusBadge status={clockInStatus(employee)} />
                          {employee.isBlocked && (
                            <p className="max-w-[230px] text-xs font-medium text-red-600">
                              {resolveBlockReason(employee)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Expiry dates */}
                      <td className="px-3 py-4 text-xs text-slate-500">
                        <p>Medical: {formatDate(employee.medicalCertificate?.expiryDate)}</p>
                        <p>BHP: {formatDate(employee.bhpTraining?.expiryDate)}</p>
                      </td>

                      <td className="rounded-r-xl px-3 py-4 text-right">
                        <div className="flex justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/employees/${employee._id}`)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </button>
                          <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                            Upload
                          </button>
                          <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
                            Alert
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {safeList.length === 0 && !loading && (
                <div className="py-12 text-center">
                  <p className="font-semibold text-slate-700">
                    {!searchTerm && selectedDepartment === "All" && selectedSite === "All" && selectedStatus === "All"
                      ? "No employees in the system"
                      : "No employees match your filters"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {!searchTerm && selectedDepartment === "All" && selectedSite === "All" && selectedStatus === "All"
                      ? "Add your first employee to get started."
                      : "Try changing your filters or search keyword."}
                  </p>
                  {!searchTerm && selectedDepartment === "All" && selectedSite === "All" && selectedStatus === "All" && (
                    <button
                      onClick={() => navigate("/employees/add")}
                      className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      + Add First Employee
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Pagination controls ─────────────────────────────────────────── */}
          {/* OLD: only rendered when totalPages > 1 — hid the bar when all records fit on one page.
              NEW: always show when there is data so the user can see the page info and
              row-count selector. Prev/Next buttons are disabled at the boundaries. */}
          {!loading && totalCount > 0 && (
            <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
              {/* Left: range info */}
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>

              {/* Centre: page buttons */}
              <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ←
                </button>

                {/* Page number buttons — show a window around the current page */}
                {(() => {
                  const total = pagination.totalPages;
                  const cur   = currentPage;
                  const pages = [];

                  // Build the set of page numbers to show
                  const showPage = (n) => n >= 1 && n <= total;
                  const nums = new Set([1, total]);
                  for (let i = cur - 2; i <= cur + 2; i++) if (showPage(i)) nums.add(i);
                  const sorted = [...nums].sort((a, b) => a - b);

                  sorted.forEach((n, idx) => {
                    // Insert ellipsis when there's a gap
                    if (idx > 0 && n - sorted[idx - 1] > 1) {
                      pages.push(
                        <span key={`gap-${n}`} className="px-1 text-sm text-slate-400">…</span>
                      );
                    }
                    pages.push(
                      <button
                        key={n}
                        onClick={() => setCurrentPage(n)}
                        className={`min-w-[2rem] rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                          n === cur
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  });

                  return pages;
                })()}

                {/* Next */}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  →
                </button>
              </div>

              {/* Right: jump-to input — only useful when there are multiple pages */}
              {pagination?.totalPages > 1 && (
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  Go to page
                  <input
                    type="number"
                    min={1}
                    max={pagination.totalPages}
                    defaultValue={currentPage}
                    key={currentPage}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v >= 1 && v <= pagination.totalPages) setCurrentPage(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseInt(e.target.value, 10);
                        if (v >= 1 && v <= pagination.totalPages) setCurrentPage(v);
                      }
                    }}
                    className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm text-slate-700 outline-none focus:border-blue-500"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeList;
