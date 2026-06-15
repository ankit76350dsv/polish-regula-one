import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchEmployees,
  upsertProfile,
  clearSubmitError,
} from "../store/slices/employeeSlice";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  "Warehouse", "Operations", "Manufacturing", "Logistics",
  "Admin", "HR", "IT", "Finance", "Security",
];

const JOB_ROLES = [
  "Warehouse Operator", "Forklift Driver", "Machine Operator", "Driver",
  "HR Assistant", "Site Manager", "Office Admin", "Engineer",
  "Security Guard", "Team Lead",
];

const SITES = [
  "Warsaw Site", "Krakow Site", "Gdansk Site",
  "Poznan Site", "Warsaw HQ", "Wroclaw Site",
];

const MANAGERS = [
  "Marek Zielinski", "Katarzyna Wozniak",
  "Tomasz Kaczmarek", "Anna Mazur", "Piotr Lewandowski",
];

// These map to the EmployeeProfile schema enum
const CONTRACT_TYPES = [
  { value: "UOP",   label: "UOP — Employment contract (full/part time)" },
  { value: "UZ",    label: "UZ — Contract of mandate (Umowa Zlecenie)" },
  { value: "UOD",   label: "UOD — Contract for specific work" },
  { value: "B2B",   label: "B2B — Business to business" },
  { value: "OTHER", label: "Other" },
];

const RISK_CATEGORIES  = ["Low", "Medium", "High"];
const MEDICAL_EXAM_TYPES = ["Initial", "Periodic", "Control", "Specialized"];
const BHP_FREQUENCIES  = ["Annually", "Every 2 years", "Every 3 years", "Every 5 years"];

const INITIAL_FORM = {
  phone: "",
  dateOfBirth: "",
  pesel: "",
  department: "",
  jobRole: "",
  workSite: "",
  startDate: "",
  contractType: "",
  manager: "",
  employeeStatus: "Active",
  riskCategory: "Medium",
  requiresMedical: true,
  requiresBHP: true,
  requiresSpecialTraining: false,
  medicalExamType: "Periodic",
  initialBHPRequired: true,
  periodicBHPFrequency: "Every 3 years",
};

const STEPS = [
  { id: 1, label: "Select Employee",    description: "Pick from RegulaOne users" },
  { id: 2, label: "Employment Details", description: "Role, site & contract"      },
  { id: 3, label: "Compliance Setup",   description: "Safety & medical config"    },
];

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function FormField({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition
        ${props.disabled
          ? "border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed"
          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"}`}
    />
  );
}

function Select({ children, value, onChange }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
    >
      {children}
    </select>
  );
}

function YesNoToggle({ label, hint, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button type="button" onClick={() => onChange(true)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${value ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
          Yes
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${!value ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
          No
        </button>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function AddEmployee() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const location  = useLocation();

  const { list: employees, loading: listLoading, submitting, submitError } = useSelector((s) => s.employees);

  const [currentStep, setCurrentStep]       = useState(1);
  const [form, setForm]                     = useState(INITIAL_FORM);
  const [selectedUser, setSelectedUser]     = useState(null);
  const [userSearch, setUserSearch]         = useState("");
  const [savedProfile, setSavedProfile]     = useState(null);

  // If navigated from "Setup Profile" button, pre-select the user
  useEffect(() => {
    const pre = location.state?.preselectedUser;
    if (pre) {
      setSelectedUser(pre);
      // If the user already has a partial profile, seed the form
      if (pre.profile) seedFormFromProfile(pre.profile);
    }
  }, []);

  // Load employee list if not already loaded (e.g. direct URL navigation)
  useEffect(() => {
    if (employees.length === 0 && !listLoading) {
      dispatch(fetchEmployees());
    }
  }, []);

  function seedFormFromProfile(profile) {
    setForm((prev) => ({
      ...prev,
      phone:         profile.phone        ?? prev.phone,
      dateOfBirth:   profile.dateOfBirth  ?? prev.dateOfBirth,
      pesel:         profile.pesel        ?? prev.pesel,
      department:    profile.department   ?? prev.department,
      jobRole:       profile.position     ?? prev.jobRole,
      workSite:      profile.site         ?? prev.workSite,
      contractType:  profile.contractType ?? prev.contractType,
      startDate:     profile.startDate    ?? prev.startDate,
      riskCategory:  profile.riskLevel
        ? profile.riskLevel.charAt(0) + profile.riskLevel.slice(1).toLowerCase()
        : prev.riskCategory,
    }));
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Users that don't have a compliance profile yet — these need setup
  const usersNeedingProfile = employees.filter((e) => e.profileMissing);

  const filteredUsers = usersNeedingProfile.filter((u) => {
    if (!userSearch) return true;
    const text = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
    return text.includes(userSearch.toLowerCase());
  });

  function handleSelectUser(user) {
    setSelectedUser(user);
    if (user.profile) seedFormFromProfile(user.profile);
    setUserSearch("");
  }

  async function handleSubmit() {
    if (!selectedUser) return;

    dispatch(clearSubmitError());

    const profileData = {
      phone:       form.phone       || undefined,
      pesel:       form.pesel       || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      department:  form.department  || undefined,
      position:    form.jobRole     || undefined,
      site:        form.workSite    || undefined,
      contractType: form.contractType || undefined,
      startDate:   form.startDate   || undefined,
      isActive:    form.employeeStatus === "Active",
      riskLevel:   form.riskCategory.toUpperCase(),

      // Initialise certificate status as MISSING when required
      medicalCertificate: form.requiresMedical ? { status: "MISSING" } : undefined,
      bhpTraining:        form.requiresBHP     ? { status: "MISSING" } : undefined,
    };

    const result = await dispatch(upsertProfile({ employeeId: selectedUser._id, profileData }));

    if (upsertProfile.fulfilled.match(result)) {
      setSavedProfile({ ...selectedUser, profile: result.payload });
    }
  }

  // ─── Success screen ─────────────────────────────────────────────────────────
  if (savedProfile) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-center text-white shadow-xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-400/30">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Compliance Profile Saved</h2>
            <p className="mt-3 text-slate-300">
              {savedProfile.firstName} {savedProfile.lastName} has been registered in the SafeWork compliance system.
            </p>
            <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Department</p>
                  <p className="mt-1 text-base font-bold">{savedProfile.profile?.department || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Site</p>
                  <p className="mt-1 text-base font-bold">{savedProfile.profile?.site || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Risk Level</p>
                  <p className="mt-1 text-base font-bold">{form.riskCategory}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-200">BHP Required</p>
                  <p className="mt-1 text-base font-bold">{form.requiresBHP ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => { setSavedProfile(null); setForm(INITIAL_FORM); setSelectedUser(null); setCurrentStep(1); }}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-blue-50"
              >
                Add Another
              </button>
              <button
                onClick={() => navigate("/employees")}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                View Employee List
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">

        {/* Page Header */}
        <div className="mb-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-blue-100 ring-1 ring-white/20">
                SafeWork HR Compliance
              </p>
              <h1 className="text-3xl font-bold">Setup Employee Compliance Profile</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Select an existing RegulaOne user and configure their medical, BHP, and compliance requirements.
              </p>
            </div>
            <button
              onClick={() => navigate("/employees")}
              className="self-start rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 lg:self-auto"
            >
              ← Back to List
            </button>
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Stepper */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-1 flex-col items-center text-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                    step.id < currentStep ? "bg-emerald-500 text-white"
                    : step.id === currentStep ? "bg-slate-900 text-white"
                    : "border-2 border-slate-200 text-slate-400"}`}>
                    {step.id < currentStep ? <CheckIcon /> : step.id}
                  </div>
                  <div className="mt-2.5 hidden sm:block">
                    <p className={`text-xs font-bold ${step.id === currentStep ? "text-slate-900" : "text-slate-400"}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-400">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`mt-5 h-px flex-1 transition ${step.id < currentStep ? "bg-emerald-300" : "bg-slate-200"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Step 1: Select a RegulaOne user ────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <SectionCard
              title="Select Employee"
              subtitle="Choose a user from RegulaOne who needs a compliance profile. Identity details are read-only."
            >
              {listLoading ? (
                <div className="flex items-center gap-3 py-4 text-sm text-slate-500">
                  <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  Loading users…
                </div>
              ) : usersNeedingProfile.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
                  All users already have compliance profiles set up.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search box for the user list */}
                  <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  />

                  {/* Scrollable user picker */}
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">No users match your search.</p>
                    ) : (
                      filteredUsers.map((user) => {
                        const isSelected = selectedUser?._id === user._id;
                        return (
                          <button
                            key={user._id}
                            type="button"
                            onClick={() => handleSelectUser(user)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                              isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                          >
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              isSelected ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                              {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="truncate text-xs text-slate-500">{user.email}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                              {user.role?.replace("_", " ")}
                            </span>
                            {isSelected && (
                              <span className="shrink-0 text-blue-600">
                                <CheckIcon />
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Read-only identity preview + editable SafeWork-specific fields */}
            {selectedUser && (
              <SectionCard
                title="Employee Identity"
                subtitle="Name and email come from RegulaOne and cannot be changed here."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="First Name">
                    <Input type="text" value={selectedUser.firstName ?? ""} disabled />
                  </FormField>
                  <FormField label="Last Name">
                    <Input type="text" value={selectedUser.lastName ?? ""} disabled />
                  </FormField>
                  <FormField label="Email Address">
                    <Input type="email" value={selectedUser.email ?? ""} disabled />
                  </FormField>
                  <FormField label="Phone Number">
                    <Input
                      type="tel"
                      placeholder="+48 600 000 000"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Date of Birth">
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => update("dateOfBirth", e.target.value)}
                    />
                  </FormField>
                  <FormField label="PESEL / National ID">
                    <Input
                      type="text"
                      placeholder="Polish national identifier"
                      value={form.pesel}
                      onChange={(e) => update("pesel", e.target.value)}
                    />
                  </FormField>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Step 2: Employment Details ──────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <SectionCard title="Role & Workplace" subtitle="Job role, department, and site assignment">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Department" required>
                  <Select value={form.department} onChange={(e) => update("department", e.target.value)}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </FormField>
                <FormField label="Job Role" required>
                  <Select value={form.jobRole} onChange={(e) => update("jobRole", e.target.value)}>
                    <option value="">Select role</option>
                    {JOB_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </FormField>
                <FormField label="Work Site" required>
                  <Select value={form.workSite} onChange={(e) => update("workSite", e.target.value)}>
                    <option value="">Select site</option>
                    {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Contract Details" subtitle="Employment type, start date, and reporting manager">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Employment Start Date" required>
                  <Input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
                </FormField>
                <FormField label="Contract Type" required>
                  <Select value={form.contractType} onChange={(e) => update("contractType", e.target.value)}>
                    <option value="">Select contract type</option>
                    {CONTRACT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </FormField>
                <FormField label="Manager">
                  <Select value={form.manager} onChange={(e) => update("manager", e.target.value)}>
                    <option value="">Select manager</option>
                    {MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Employment Status" subtitle="Set the initial status for this employee record">
              <div className="flex gap-3">
                {["Active", "Inactive"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => update("employeeStatus", status)}
                    className={`flex-1 rounded-xl border px-4 py-4 text-sm font-bold transition sm:flex-none sm:px-12 ${
                      form.employeeStatus === status
                        ? status === "Active" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── Step 3: Compliance Setup ────────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <SectionCard title="Risk Classification" subtitle="Occupational risk level for this position">
              <div className="grid grid-cols-3 gap-3">
                {RISK_CATEGORIES.map((category) => {
                  const selected = form.riskCategory === category;
                  const colorMap = {
                    Low:    selected ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/60",
                    Medium: selected ? "border-amber-300 bg-amber-50 text-amber-700"       : "border-slate-200 bg-slate-50 text-slate-500 hover:border-amber-200 hover:bg-amber-50/60",
                    High:   selected ? "border-red-300 bg-red-50 text-red-700"             : "border-slate-200 bg-slate-50 text-slate-500 hover:border-red-200 hover:bg-red-50/60",
                  };
                  const dotMap = { Low: "bg-emerald-500", Medium: "bg-amber-500", High: "bg-red-500" };
                  return (
                    <button key={category} type="button" onClick={() => update("riskCategory", category)}
                      className={`rounded-xl border px-4 py-5 text-sm font-bold transition ${colorMap[category]}`}>
                      <span className={`mx-auto mb-2 block h-3 w-3 rounded-full ${dotMap[category]}`} />
                      {category} Risk
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Medical Requirements" subtitle="Occupational health examination configuration">
              <div className="space-y-3">
                <YesNoToggle
                  label="Requires Medical Certificate"
                  hint="Badania medycyny pracy — occupational health examination required"
                  value={form.requiresMedical}
                  onChange={(val) => update("requiresMedical", val)}
                />
                {form.requiresMedical && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <FormField label="Medical Exam Type Required">
                      <Select value={form.medicalExamType} onChange={(e) => update("medicalExamType", e.target.value)}>
                        {MEDICAL_EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </FormField>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="BHP Safety Training" subtitle="Bezpieczenstwo i Higiena Pracy — mandatory occupational safety training">
              <div className="space-y-3">
                <YesNoToggle
                  label="Requires BHP Training"
                  hint="Mandatory safety training under Polish Labour Code"
                  value={form.requiresBHP}
                  onChange={(val) => update("requiresBHP", val)}
                />
                {form.requiresBHP && (
                  <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <YesNoToggle
                      label="Initial BHP Required"
                      hint="One-time onboarding safety training on employment start date"
                      value={form.initialBHPRequired}
                      onChange={(val) => update("initialBHPRequired", val)}
                    />
                    <FormField label="Periodic BHP Frequency">
                      <Select value={form.periodicBHPFrequency} onChange={(e) => update("periodicBHPFrequency", e.target.value)}>
                        {BHP_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                      </Select>
                    </FormField>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Special Training" subtitle="Additional role-specific certifications and qualifications">
              <YesNoToggle
                label="Requires Special Training"
                hint="Equipment licenses, forklift certification, or role-specific qualifications"
                value={form.requiresSpecialTraining}
                onChange={(val) => update("requiresSpecialTraining", val)}
              />
            </SectionCard>

            {/* Compliance preview */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 p-5 shadow-sm">
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-blue-200">Compliance Profile Preview</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-xs text-slate-400">Risk Level</p>
                  <p className={`mt-1 text-sm font-bold ${form.riskCategory === "High" ? "text-red-300" : form.riskCategory === "Medium" ? "text-amber-300" : "text-emerald-300"}`}>
                    {form.riskCategory}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-xs text-slate-400">Medical</p>
                  <p className={`mt-1 text-sm font-bold ${form.requiresMedical ? "text-blue-300" : "text-slate-400"}`}>
                    {form.requiresMedical ? form.medicalExamType : "Not Required"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-xs text-slate-400">BHP Training</p>
                  <p className={`mt-1 text-sm font-bold ${form.requiresBHP ? "text-blue-300" : "text-slate-400"}`}>
                    {form.requiresBHP ? form.periodicBHPFrequency : "Not Required"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-xs text-slate-400">Special Training</p>
                  <p className={`mt-1 text-sm font-bold ${form.requiresSpecialTraining ? "text-blue-300" : "text-slate-400"}`}>
                    {form.requiresSpecialTraining ? "Required" : "Not Required"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/employees")}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={currentStep === 1 && !selectedUser}
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !selectedUser}
                className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save Profile"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default AddEmployee;
