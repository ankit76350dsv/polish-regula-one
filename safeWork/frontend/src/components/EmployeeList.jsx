import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeeSlice";

// ─── Status config ─────────────────────────────────────────────────────────────
// Keys are normalised lowercase strings returned by the helper functions below.
const statusConfig = {
  valid:     { label: "Valid",           className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  compliant: { label: "Compliant",       className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  allowed:   { label: "Allowed",         className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  expiring:  { label: "Expiring Soon",   className: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500"   },
  warning:   { label: "Non-Compliant",   className: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500"   },
  expired:   { label: "Expired",         className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  missing:   { label: "Missing",         className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  blocked:   { label: "Blocked",         className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  setup:     { label: "Setup Required",  className: "bg-violet-50 text-violet-700 ring-violet-200",    dot: "bg-violet-500"  },
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
// The API returns merged objects: { _id, firstName, lastName, email, role, profile, profileMissing }
// All helpers normalise backend UPPERCASE enums to the lowercase statusConfig keys.

function displayName(e) {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.email;
}

function medicalStatus(e) {
  if (e.profileMissing || !e.profile) return "setup";
  return e.profile.medicalCertificate?.status?.toLowerCase() ?? "missing";
}

function bhpStatus(e) {
  if (e.profileMissing || !e.profile) return "setup";
  return e.profile.bhpTraining?.status?.toLowerCase() ?? "missing";
}

// Maps backend COMPLIANT/EXPIRING/NON_COMPLIANT/BLOCKED → statusConfig keys
function overallStatus(e) {
  if (e.profileMissing || !e.profile) return "setup";
  const s = e.profile.complianceStatus;
  if (s === "COMPLIANT")    return "compliant";
  if (s === "EXPIRING")     return "expiring";
  if (s === "BLOCKED")      return "blocked";
  return "warning"; // NON_COMPLIANT
}

function clockInStatus(e) {
  if (e.profileMissing || !e.profile) return "setup";
  return e.profile.isBlocked ? "blocked" : "allowed";
}

function blockReason(e) {
  const med = e.profile?.medicalCertificate;
  const bhp = e.profile?.bhpTraining;
  if (med?.status === "EXPIRED") return `Medical expired on ${formatDate(med.expiryDate)}`;
  if (med?.status === "MISSING") return "Medical certificate is missing";
  if (bhp?.status === "EXPIRED") return `BHP training expired on ${formatDate(bhp.expiryDate)}`;
  if (bhp?.status === "MISSING") return "BHP training certificate is missing";
  return "Compliance block active";
}

// ─── Component ─────────────────────────────────────────────────────────────────
function EmployeeList() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: employees, loading, error } = useSelector((s) => s.employees);

  const [searchTerm, setSearchTerm]               = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedSite, setSelectedSite]           = useState("All");
  const [selectedStatus, setSelectedStatus]       = useState("All");

  useEffect(() => {
    dispatch(fetchEmployees());
  }, [dispatch]);

  const departments = useMemo(
    () => ["All", ...new Set(employees.map((e) => e.profile?.department).filter(Boolean))],
    [employees]
  );
  const sites = useMemo(
    () => ["All", ...new Set(employees.map((e) => e.profile?.site).filter(Boolean))],
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const text = `${displayName(e)} ${e.email} ${e.profile?.department ?? ""} ${e.profile?.position ?? ""} ${e.profile?.site ?? ""}`.toLowerCase();
      const matchSearch     = !searchTerm || text.includes(searchTerm.toLowerCase());
      const matchDept       = selectedDepartment === "All" || e.profile?.department === selectedDepartment;
      const matchSite       = selectedSite === "All" || e.profile?.site === selectedSite;
      const matchStatus     = selectedStatus === "All" || overallStatus(e) === selectedStatus;
      return matchSearch && matchDept && matchSite && matchStatus;
    });
  }, [employees, searchTerm, selectedDepartment, selectedSite, selectedStatus]);

  const totalCount     = employees.length;
  const compliantCount = employees.filter((e) => e.profile?.complianceStatus === "COMPLIANT").length;
  const expiringCount  = employees.filter((e) => e.profile?.complianceStatus === "EXPIRING").length;
  const blockedCount   = employees.filter((e) => e.profile?.isBlocked === true).length;

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

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <input
              type="text"
              placeholder="Search name, email, role, site…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d === "All" ? "All Departments" : d}</option>
              ))}
            </select>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            >
              {sites.map((s) => (
                <option key={s} value={s}>{s === "All" ? "All Sites" : s}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            >
              <option value="All">All Compliance Status</option>
              <option value="compliant">Compliant</option>
              <option value="expiring">Expiring Soon</option>
              <option value="warning">Non-Compliant</option>
              <option value="blocked">Blocked</option>
              <option value="setup">Setup Required</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Employee List</h2>
              <p className="text-sm text-slate-500">
                {loading ? "Loading…" : `Showing ${filteredEmployees.length} employee records`}
              </p>
            </div>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Export Register
            </button>
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
                  {filteredEmployees.map((employee) => (
                    <tr
                      key={employee._id}
                      className={`text-sm transition ${employee.profileMissing ? "bg-violet-50/40" : "cursor-pointer bg-slate-50 hover:bg-blue-50"}`}
                      onClick={() => !employee.profileMissing && navigate(`/employees/${employee._id}`)}
                    >
                      {/* Employee identity — always from RegulaOne */}
                      <td className="rounded-l-xl px-3 py-4">
                        <div>
                          <p className="font-bold text-slate-900">{displayName(employee)}</p>
                          <p className="text-xs text-slate-400">{employee.email}</p>
                          <p className="text-xs font-medium text-slate-500 capitalize">{employee.role?.toLowerCase().replace("_", " ")}</p>
                        </div>
                      </td>

                      {/* Compliance profile fields — null when no profile yet */}
                      <td className="px-3 py-4">
                        {employee.profileMissing ? (
                          <span className="text-xs text-slate-400 italic">Not set up</span>
                        ) : (
                          <>
                            <p className="font-medium text-slate-700">{employee.profile?.department ?? "—"}</p>
                            <p className="text-xs text-slate-400">{employee.profile?.contractType ?? "—"}</p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        {employee.profileMissing ? (
                          <span className="text-xs text-slate-400 italic">Not set up</span>
                        ) : (
                          <>
                            <p className="font-medium text-slate-700">{employee.profile?.position ?? "—"}</p>
                            <p className="text-xs text-slate-400">{employee.profile?.site ?? "—"}</p>
                          </>
                        )}
                      </td>

                      <td className="px-3 py-4"><StatusBadge status={medicalStatus(employee)} /></td>
                      <td className="px-3 py-4"><StatusBadge status={bhpStatus(employee)} /></td>
                      <td className="px-3 py-4"><StatusBadge status={overallStatus(employee)} /></td>

                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <StatusBadge status={clockInStatus(employee)} />
                          {employee.profile?.isBlocked && (
                            <p className="max-w-[230px] text-xs font-medium text-red-600">
                              {blockReason(employee)}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-4 text-xs text-slate-500">
                        {employee.profileMissing ? (
                          <span className="italic text-slate-400">—</span>
                        ) : (
                          <>
                            <p>Medical: {formatDate(employee.profile?.medicalCertificate?.expiryDate)}</p>
                            <p>BHP: {formatDate(employee.profile?.bhpTraining?.expiryDate)}</p>
                          </>
                        )}
                      </td>

                      <td className="rounded-r-xl px-3 py-4 text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {employee.profileMissing ? (
                            // User exists in RegulaOne but has no compliance profile yet
                            <button
                              onClick={() => navigate("/employees/add", { state: { preselectedUser: employee } })}
                              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                            >
                              Setup Profile
                            </button>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && filteredEmployees.length === 0 && (
                <div className="py-12 text-center">
                  <p className="font-semibold text-slate-700">
                    {employees.length === 0 ? "No employees in the system" : "No employees match your filters"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {employees.length === 0
                      ? "Add your first employee to get started."
                      : "Try changing your filters or search keyword."}
                  </p>
                  {employees.length === 0 && (
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
        </div>
      </div>
    </div>
  );
}

export default EmployeeList;
