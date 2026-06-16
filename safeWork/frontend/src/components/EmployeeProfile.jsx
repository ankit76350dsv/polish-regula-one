import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
  fetchEmployee,
  clearSelected,
  upsertProfile,
  uploadDocument,
  clearSubmitError,
  clearUploadError,
} from "../store/slices/employeeSlice";

const API_BASE_URL = "http://localhost:8082/api";
// We no longer read a token from localStorage or send an Authorization header.
// The auth token travels in an HttpOnly cookie, which axios attaches
// automatically when we set `withCredentials: true` on the request.

// ─── Constants (mirrored from AddEmployee) ─────────────────────────────────────
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
const CONTRACT_TYPES = [
  { value: "UOP",   label: "UOP — Employment contract" },
  { value: "UZ",    label: "UZ — Contract of mandate" },
  { value: "UOD",   label: "UOD — Contract for specific work" },
  { value: "B2B",   label: "B2B — Business to business" },
  { value: "OTHER", label: "Other" },
];
const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"];
const MEDICAL_EXAM_TYPES = ["Initial", "Periodic", "Control", "Specialized"];
const BHP_FREQUENCIES = ["Annually", "Every 2 years", "Every 3 years", "Every 5 years"];
const DOC_STATUSES = [
  { value: "VALID",    label: "Valid" },
  { value: "EXPIRING", label: "Expiring Soon" },
  { value: "EXPIRED",  label: "Expired" },
  { value: "MISSING",  label: "Missing" },
];

// ─── Status config ─────────────────────────────────────────────────────────────
const statusConfig = {
  valid:     { label: "Valid",          className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  compliant: { label: "Compliant",      className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  allowed:   { label: "Allowed",        className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  expiring:  { label: "Expiring Soon",  className: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500"   },
  warning:   { label: "Non-Compliant",  className: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500"   },
  expired:   { label: "Expired",        className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  missing:   { label: "Missing",        className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  blocked:   { label: "Blocked",        className: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  inactive:  { label: "Inactive",       className: "bg-slate-100 text-slate-600 ring-slate-200",      dot: "bg-slate-400"   },
};

function StatusBadge({ status }) {
  const cfg = statusConfig[status?.toLowerCase()] || statusConfig.missing;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

// Mirrors the backend calculateDocumentStatus rule so the UI preview is always
// consistent with what the server will persist.
function computeDocumentStatus(expiryDate) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0)   return "EXPIRED";
  if (days <= 30) return "EXPIRING";
  return "VALID";
}

function toInputDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function daysUntil(d) {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(d); expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / 86400000);
}

function normalisedStatus(rawStatus) {
  if (!rawStatus) return "missing";
  const s = rawStatus.toUpperCase();
  if (s === "COMPLIANT")    return "compliant";
  if (s === "EXPIRING")     return "expiring";
  if (s === "BLOCKED")      return "blocked";
  if (s === "NON_COMPLIANT") return "warning";
  if (s === "VALID")        return "valid";
  if (s === "EXPIRED")      return "expired";
  if (s === "MISSING")      return "missing";
  return s.toLowerCase();
}

function riskColor(level) {
  if (level === "HIGH")   return "text-red-400";
  if (level === "MEDIUM") return "text-amber-400";
  return "text-emerald-400";
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

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
          ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"}`}
    />
  );
}

function SelectInput({ value, onChange, children, disabled }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-400"
    >
      {children}
    </select>
  );
}

function Toggle({ label, hint, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button type="button" onClick={() => onChange(true)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${value ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
          Yes
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${!value ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
          No
        </button>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-5 border-b border-slate-100 pb-4">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

// ─── Document Upload Modal ────────────────────────────────────────────────────
function UploadModal({ docType, profileId, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const { uploading, uploadError } = useSelector((s) => s.employees);
  const fileRef = useRef(null);
  // OLD: form included a manual "status" field
  // NEW: status is auto-derived from expiryDate — no manual selection needed
  const [form, setForm] = useState({ expiryDate: "", completedDate: "" });
  const [localFile, setLocalFile] = useState(null);

  function update(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  // Computed status preview — mirrors the server-side calculateDocumentStatus rule
  const computedStatus = computeDocumentStatus(form.expiryDate);

  async function handleSubmit() {
    if (!localFile) return;
    dispatch(clearUploadError());
    const result = await dispatch(uploadDocument({
      profileId,
      docType,
      file: localFile,
      expiryDate:    form.expiryDate    || undefined,
      completedDate: form.completedDate || undefined,
      // status removed — backend calculates it from expiryDate
    }));
    if (uploadDocument.fulfilled.match(result)) onSuccess();
  }

  const ismedical = docType === "medical";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-900">
            Upload {ismedical ? "Medical Certificate" : "BHP Training Certificate"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            File is uploaded securely to S3. Only the reference is stored in the database.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          {uploadError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {uploadError}
            </div>
          )}

          {/* File picker */}
          <FormField label="Select File" required>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50"
            >
              <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {localFile ? (
                <p className="text-sm font-semibold text-blue-600">{localFile.name}</p>
              ) : (
                <p className="text-sm text-slate-500">Click to choose PDF, DOCX, or image</p>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setLocalFile(e.target.files[0] || null)}
              />
            </div>
          </FormField>

          {/* BHP only: completed date */}
          {!ismedical && (
            <FormField label="Training Completed Date">
              <Input type="date" value={form.completedDate} onChange={(e) => update("completedDate", e.target.value)} />
            </FormField>
          )}

          {/* Expiry date */}
          <FormField label="Expiry Date" required>
            <Input type="date" value={form.expiryDate} onChange={(e) => update("expiryDate", e.target.value)} />
          </FormField>

          {/* Calculated status — read-only, derived from expiry date */}
          {computedStatus && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-600">Calculated Status</p>
              <StatusBadge status={computedStatus} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!localFile || !form.expiryDate || uploading}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clock-in Eligibility Tab ──────────────────────────────────────────────────
// Extracted into its own component so it can declare local derived variables
// without polluting the main EmployeeProfile scope.
function EligibilityTab({ employee }) {
  const medRequired = employee.requiresMedicalCertificate;
  const bhpRequired = employee.requiresBHPTraining;
  const medStatus   = employee.medicalCertificate?.status ?? "MISSING";
  const bhpStatus   = employee.bhpTraining?.status        ?? "MISSING";

  // Block rule: EXPIRED or MISSING on a required document prevents check-in.
  // EXPIRING (within 30 days) still allows check-in — document is still valid.
  const BLOCKING    = ["EXPIRED", "MISSING"];
  const medBlocked  = medRequired && BLOCKING.includes(medStatus);
  const bhpBlocked  = bhpRequired && BLOCKING.includes(bhpStatus);
  const isBlocked   = !employee.isActive || medBlocked || bhpBlocked;

  const blockMessages = [];
  if (!employee.isActive) blockMessages.push("Employee account is inactive — contact an administrator");
  if (medBlocked) blockMessages.push(`Medical certificate is ${medStatus.toLowerCase()} — upload a valid document to restore access`);
  if (bhpBlocked) blockMessages.push(`BHP training certificate is ${bhpStatus.toLowerCase()} — upload a valid certificate to restore access`);

  const checks = [
    {
      label:  "Employee Active",
      ok:     employee.isActive,
      detail: employee.isActive ? "Active" : "Inactive — contact an administrator",
      sub:    null,
    },
    {
      label:  "Medical Certificate",
      ok:     !medBlocked,
      detail: !medRequired
        ? "Not required for this role"
        : medBlocked
          ? `Certificate is ${medStatus.toLowerCase()} — upload a new document to unblock`
          : medStatus,
      sub: medRequired ? formatDate(employee.medicalCertificate?.expiryDate) : null,
    },
    {
      label:  "BHP Training",
      ok:     !bhpBlocked,
      detail: !bhpRequired
        ? "Not required for this role"
        : bhpBlocked
          ? `Training is ${bhpStatus.toLowerCase()} — upload a new certificate to unblock`
          : bhpStatus,
      sub: bhpRequired ? formatDate(employee.bhpTraining?.expiryDate) : null,
    },
  ];

  return (
    <Card className={isBlocked ? "border-red-100" : "border-emerald-100"}>
      <SectionTitle
        title="Clock-in Eligibility"
        subtitle="Checks whether the employee can start a work shift"
      />
      <div className={`rounded-2xl p-5 ${isBlocked ? "bg-red-50" : "bg-emerald-50"}`}>
        <div className="mb-5 flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${isBlocked ? "bg-red-100" : "bg-emerald-100"}`}>
            {isBlocked ? "✗" : "✓"}
          </div>
          <div>
            <h3 className={`text-xl font-bold ${isBlocked ? "text-red-700" : "text-emerald-700"}`}>
              {isBlocked ? "Clock-in Blocked" : "Clock-in Allowed"}
            </h3>
            {isBlocked && blockMessages.length > 0 && (
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                {blockMessages.map((msg) => (
                  <li key={msg} className="text-sm text-red-600">{msg}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {checks.map((check) => (
            <div key={check.label} className="rounded-xl bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">{check.label}</p>
                <span className={`text-base font-bold ${check.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {check.ok ? "✓" : "✗"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{check.detail}</p>
              {check.sub && <p className="mt-0.5 text-xs text-slate-400">Expires: {check.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { selected: employee, selectedLoading, selectedError, submitting, submitError } =
    useSelector((s) => s.employees);

  const [activeTab, setActiveTab]   = useState("overview");
  const [editMode, setEditMode]     = useState(false);
  const [uploadModal, setUploadModal] = useState(null); // "medical" | "bhp" | null
  const [editForm, setEditForm]     = useState(null);
  // viewingDoc tracks which document type is currently being fetched (for loading state).
  const [viewingDoc, setViewingDoc] = useState(null); // "medical" | "bhp" | null
  const [viewDocError, setViewDocError] = useState(null);

  useEffect(() => {
    if (id) dispatch(fetchEmployee(id));
    return () => { dispatch(clearSelected()); };
  }, [id, dispatch]);

  // Seed edit form whenever employee data loads or changes
  useEffect(() => {
    if (employee) {
      setEditForm({
        phone:       employee.phone       ?? "",
        dateOfBirth: toInputDate(employee.dateOfBirth),
        pesel:       employee.pesel       ?? "",
        department:  employee.department  ?? "",
        position:    employee.position    ?? "",
        site:        employee.site        ?? "",
        contractType: employee.contractType ?? "",
        startDate:   toInputDate(employee.startDate),
        isActive:    employee.isActive    ?? true,
        riskLevel:   employee.riskLevel   ?? "MEDIUM",
        // OLD: inferred from certificate presence — ambiguous because the schema
        //      default creates the sub-object for every employee.
        // NEW: read the explicit boolean field; fall back to the old inference
        //      for existing records that pre-date this field.
        requiresMedical: employee.requiresMedicalCertificate
          ?? !!employee.medicalCertificate?.documentPath,
        requiresBHP: employee.requiresBHPTraining
          ?? !!employee.bhpTraining?.documentPath,
        medicalExamType:      "Periodic",
        periodicBHPFrequency: "Every 3 years",
        initialBHPRequired:   true,
        requiresSpecialTraining: false,
      });
    }
  }, [employee]);

  function updateEdit(k, v) { setEditForm((p) => ({ ...p, [k]: v })); }

  async function handleEditSave() {
    if (!editForm || !employee) return;
    dispatch(clearSubmitError());

    const profileData = {
      phone:        editForm.phone       || undefined,
      pesel:        editForm.pesel       || undefined,
      dateOfBirth:  editForm.dateOfBirth || undefined,
      department:   editForm.department  || undefined,
      position:     editForm.position    || undefined,
      site:         editForm.site        || undefined,
      contractType: editForm.contractType || undefined,
      startDate:    editForm.startDate   || undefined,
      isActive:     editForm.isActive,
      riskLevel:    editForm.riskLevel,
      // Save the explicit requirement flags so the Documents tab can
      // conditionally show upload sections without inferring from status.
      requiresMedicalCertificate: editForm.requiresMedical,
      requiresBHPTraining:        editForm.requiresBHP,
      medicalCertificate: editForm.requiresMedical
        ? (employee.medicalCertificate ?? { status: "MISSING" })
        : undefined,
      bhpTraining: editForm.requiresBHP
        ? (employee.bhpTraining ?? { status: "MISSING" })
        : undefined,
    };

    // PUT uses the RegulaOne user _id (stored as employeeId in SafeWork_Employee)
    const result = await dispatch(upsertProfile({
      employeeId: employee.userId,
      profileData,
    }));
    if (upsertProfile.fulfilled.match(result)) {
      setEditMode(false);
      dispatch(fetchEmployee(id)); // refresh to get latest merged data
    }
  }

  // Fetches a short-lived pre-signed S3 GET URL from the backend and opens
  // the document in a new browser tab.  The URL expires in 15 minutes.
  async function handleViewDocument(docType) {
    setViewingDoc(docType);
    setViewDocError(null);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/employees/${id}/document-url`,
        {
          params: { docType },
          // Send the auth cookie with the request.
          withCredentials: true,
        }
      );
      const viewUrl = response.data?.data?.viewUrl ?? response.data?.viewUrl;
      if (!viewUrl) throw new Error("No URL returned from server");
      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setViewDocError(err.response?.data?.message || err.message || "Failed to open document");
    } finally {
      setViewingDoc(null);
    }
  }

  // ─── Loading / Error states ─────────────────────────────────────────────────
  if (selectedLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading employee profile…</p>
        </div>
      </div>
    );
  }

  if (selectedError || !employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-2 font-bold text-red-700">Failed to load employee</p>
          <p className="text-sm text-red-600">{selectedError || "Employee not found"}</p>
          <button onClick={() => navigate("/employees")}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
            ← Back to List
          </button>
        </div>
      </div>
    );
  }

  const initials = (employee.user?.name ?? "??").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const medStatus = normalisedStatus(employee.medicalCertificate?.status);
  const bhpStatus = normalisedStatus(employee.bhpTraining?.status);
  const overallStatus = normalisedStatus(employee.complianceStatus);
  const clockStatus = employee.isBlocked ? "blocked" : "allowed";
  const medDays = daysUntil(employee.medicalCertificate?.expiryDate);
  const bhpDays = daysUntil(employee.bhpTraining?.expiryDate);

  const TABS = [
    { key: "overview",     label: "Overview"          },
    { key: "employment",   label: "Employment"        },
    { key: "documents",    label: "Documents"         },
    { key: "eligibility",  label: "Clock-in"          },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      {uploadModal && (
        <UploadModal
          docType={uploadModal}
          profileId={id}
          onClose={() => { setUploadModal(null); dispatch(clearUploadError()); }}
          onSuccess={() => { setUploadModal(null); dispatch(fetchEmployee(id)); }}
        />
      )}

      <div className="mx-auto max-w-7xl">

        {/* ── Profile Header ─────────────────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold ring-1 ring-white/20">
                {initials}
              </div>
              <div>
                <button
                  onClick={() => navigate("/employees")}
                  className="mb-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  ← Back to list
                </button>
                <h1 className="text-3xl font-bold">{employee.user?.name ?? "—"}</h1>
                <p className="mt-1 text-sm text-slate-300">
                  {employee.user?.email}
                  {employee.position ? ` • ${employee.position}` : ""}
                  {employee.department ? ` • ${employee.department}` : ""}
                  {employee.site ? ` • ${employee.site}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-400 capitalize">
                  {employee.user?.role?.toLowerCase().replace(/_/g, " ")}
                  {" • "}
                  {employee.isActive ? "Active" : "Inactive"}
                </p>
              </div>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 text-center">
                <p className="mb-2 text-xs text-slate-300">Compliance</p>
                <StatusBadge status={overallStatus} />
              </div>
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 text-center">
                <p className="mb-2 text-xs text-slate-300">Clock-in</p>
                <StatusBadge status={clockStatus} />
              </div>
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 text-center">
                <p className="mb-1 text-xs text-slate-300">Risk</p>
                <p className={`text-sm font-bold ${riskColor(employee.riskLevel)}`}>
                  {employee.riskLevel ?? "—"}
                </p>
              </div>
            </div>

            {/* Edit button */}
            <button
              onClick={() => { setEditMode(true); setActiveTab("employment"); }}
              className="self-start rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 lg:self-auto"
            >
              Edit Profile
            </button>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key !== "employment") setEditMode(false); }}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === tab.key ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB: Overview
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* Personal Info */}
            <Card className="lg:col-span-2">
              <SectionTitle title="Personal Information" subtitle="Identity and contact details" />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label="Full Name"    value={employee.user?.name} />
                <InfoRow label="Email"        value={employee.user?.email} />
                <InfoRow label="Phone"        value={employee.phone} />
                <InfoRow label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                <InfoRow label="PESEL"        value={employee.pesel} />
                <InfoRow label="Status"       value={employee.isActive ? "Active" : "Inactive"} />
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <h4 className="mb-4 text-sm font-bold text-slate-700">Employment Details</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoRow label="Department"   value={employee.department} />
                  <InfoRow label="Position"     value={employee.position} />
                  <InfoRow label="Work Site"    value={employee.site} />
                  <InfoRow label="Contract Type" value={employee.contractType} />
                  <InfoRow label="Start Date"   value={formatDate(employee.startDate)} />
                  <InfoRow label="Risk Level"   value={employee.riskLevel} />
                </div>
              </div>
            </Card>

            {/* Compliance Summary */}
            <div className="space-y-4">
              {/* Medical */}
              <Card>
                <SectionTitle title="Medical Certificate" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Status</span>
                    <StatusBadge status={medStatus} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Expiry</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {formatDate(employee.medicalCertificate?.expiryDate)}
                    </span>
                  </div>
                  {medDays !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Days Left</span>
                      <span className={`text-sm font-bold ${medDays < 0 ? "text-red-600" : medDays < 30 ? "text-amber-600" : "text-emerald-600"}`}>
                        {medDays < 0 ? `${Math.abs(medDays)} overdue` : `${medDays} days`}
                      </span>
                    </div>
                  )}
                  {employee.medicalCertificate?.documentPath && (
                    <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Document stored</p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-blue-600">
                        {employee.medicalCertificate.documentPath}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* BHP */}
              <Card>
                <SectionTitle title="BHP Safety Training" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Status</span>
                    <StatusBadge status={bhpStatus} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Completed</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {formatDate(employee.bhpTraining?.completedDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Expiry</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {formatDate(employee.bhpTraining?.expiryDate)}
                    </span>
                  </div>
                  {bhpDays !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Days Left</span>
                      <span className={`text-sm font-bold ${bhpDays < 0 ? "text-red-600" : bhpDays < 30 ? "text-amber-600" : "text-emerald-600"}`}>
                        {bhpDays < 0 ? `${Math.abs(bhpDays)} overdue` : `${bhpDays} days`}
                      </span>
                    </div>
                  )}
                  {employee.bhpTraining?.documentPath && (
                    <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Document stored</p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-blue-600">
                        {employee.bhpTraining.documentPath}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Block reason */}
              {employee.isBlocked && (
                <Card className="border-red-100 bg-red-50">
                  <SectionTitle title="Block Reason" />
                  <p className="text-sm font-semibold text-red-700">
                    {employee.blockReason || "Compliance block is active"}
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB: Employment (Edit form)
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "employment" && editForm && (
          <div className="space-y-5">
            {submitError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {!editMode ? (
              /* ── Read-only employment view ───────────────────────────────── */
              <Card>
                <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Employment Details</h3>
                    <p className="mt-1 text-sm text-slate-500">Role, contract, and workplace information</p>
                  </div>
                  <button
                    onClick={() => setEditMode(true)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoRow label="Department"    value={employee.department} />
                  <InfoRow label="Position"      value={employee.position} />
                  <InfoRow label="Work Site"     value={employee.site} />
                  <InfoRow label="Contract Type" value={employee.contractType} />
                  <InfoRow label="Start Date"    value={formatDate(employee.startDate)} />
                  <InfoRow label="Status"        value={employee.isActive ? "Active" : "Inactive"} />
                  <InfoRow label="Risk Level"    value={employee.riskLevel} />
                </div>
              </Card>
            ) : (
              /* ── Edit form ───────────────────────────────────────────────── */
              <>
                {/* Identity (read-only) */}
                <Card>
                  <SectionTitle title="Employee Identity" subtitle="Identity is managed by RegulaOne and cannot be changed here" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Full Name">
                      <Input type="text" value={employee.user?.name ?? ""} disabled />
                    </FormField>
                    <FormField label="Email">
                      <Input type="email" value={employee.user?.email ?? ""} disabled />
                    </FormField>
                    <FormField label="Phone">
                      <Input type="tel" placeholder="+48 600 000 000" value={editForm.phone}
                        onChange={(e) => updateEdit("phone", e.target.value)} />
                    </FormField>
                    <FormField label="Date of Birth">
                      <Input type="date" value={editForm.dateOfBirth}
                        onChange={(e) => updateEdit("dateOfBirth", e.target.value)} />
                    </FormField>
                    <FormField label="PESEL / National ID">
                      <Input type="text" placeholder="Polish national identifier" value={editForm.pesel}
                        onChange={(e) => updateEdit("pesel", e.target.value)} />
                    </FormField>
                  </div>
                </Card>

                {/* Role & workplace */}
                <Card>
                  <SectionTitle title="Role & Workplace" subtitle="Job role, department, and site assignment" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField label="Department" required>
                      <SelectInput value={editForm.department} onChange={(e) => updateEdit("department", e.target.value)}>
                        <option value="">Select department</option>
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </SelectInput>
                    </FormField>
                    <FormField label="Position" required>
                      <SelectInput value={editForm.position} onChange={(e) => updateEdit("position", e.target.value)}>
                        <option value="">Select position</option>
                        {JOB_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </SelectInput>
                    </FormField>
                    <FormField label="Work Site" required>
                      <SelectInput value={editForm.site} onChange={(e) => updateEdit("site", e.target.value)}>
                        <option value="">Select site</option>
                        {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </SelectInput>
                    </FormField>
                    <FormField label="Contract Type" required>
                      <SelectInput value={editForm.contractType} onChange={(e) => updateEdit("contractType", e.target.value)}>
                        <option value="">Select contract type</option>
                        {CONTRACT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </SelectInput>
                    </FormField>
                    <FormField label="Start Date">
                      <Input type="date" value={editForm.startDate}
                        onChange={(e) => updateEdit("startDate", e.target.value)} />
                    </FormField>
                  </div>

                  {/* Active/Inactive toggle */}
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Employment Status</p>
                    <div className="flex gap-3">
                      {["Active", "Inactive"].map((s) => (
                        <button key={s} type="button"
                          onClick={() => updateEdit("isActive", s === "Active")}
                          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition sm:flex-none sm:px-10 ${
                            editForm.isActive === (s === "Active")
                              ? s === "Active" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Risk classification */}
                <Card>
                  <SectionTitle title="Risk Classification" subtitle="Occupational risk level for this position" />
                  <div className="grid grid-cols-3 gap-3">
                    {RISK_LEVELS.map((level) => {
                      const sel = editForm.riskLevel === level;
                      const colorMap = {
                        LOW:    sel ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/60",
                        MEDIUM: sel ? "border-amber-300 bg-amber-50 text-amber-700"       : "border-slate-200 bg-slate-50 text-slate-500 hover:border-amber-200 hover:bg-amber-50/60",
                        HIGH:   sel ? "border-red-300 bg-red-50 text-red-700"             : "border-slate-200 bg-slate-50 text-slate-500 hover:border-red-200 hover:bg-red-50/60",
                      };
                      const dotMap = { LOW: "bg-emerald-500", MEDIUM: "bg-amber-500", HIGH: "bg-red-500" };
                      return (
                        <button key={level} type="button" onClick={() => updateEdit("riskLevel", level)}
                          className={`rounded-xl border px-4 py-5 text-sm font-bold transition ${colorMap[level]}`}>
                          <span className={`mx-auto mb-2 block h-3 w-3 rounded-full ${dotMap[level]}`} />
                          {level.charAt(0) + level.slice(1).toLowerCase()} Risk
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {/* Compliance requirements */}
                <Card>
                  <SectionTitle title="Medical Requirements" subtitle="Occupational health examination configuration" />
                  <div className="space-y-3">
                    <Toggle
                      label="Requires Medical Certificate"
                      hint="Badania medycyny pracy — occupational health examination required"
                      value={editForm.requiresMedical}
                      onChange={(v) => updateEdit("requiresMedical", v)}
                    />
                    {editForm.requiresMedical && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <FormField label="Medical Exam Type">
                          <SelectInput value={editForm.medicalExamType} onChange={(e) => updateEdit("medicalExamType", e.target.value)}>
                            {MEDICAL_EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </SelectInput>
                        </FormField>
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <SectionTitle title="BHP Safety Training" subtitle="Bezpieczenstwo i Higiena Pracy — mandatory safety training" />
                  <div className="space-y-3">
                    <Toggle
                      label="Requires BHP Training"
                      hint="Mandatory safety training under Polish Labour Code"
                      value={editForm.requiresBHP}
                      onChange={(v) => updateEdit("requiresBHP", v)}
                    />
                    {editForm.requiresBHP && (
                      <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <Toggle
                          label="Initial BHP Required"
                          hint="One-time onboarding safety training on employment start date"
                          value={editForm.initialBHPRequired}
                          onChange={(v) => updateEdit("initialBHPRequired", v)}
                        />
                        <FormField label="Periodic BHP Frequency">
                          <SelectInput value={editForm.periodicBHPFrequency} onChange={(e) => updateEdit("periodicBHPFrequency", e.target.value)}>
                            {BHP_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                          </SelectInput>
                        </FormField>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Action buttons */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => { setEditMode(false); }}
                    className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    disabled={submitting}
                    className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB: Documents
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            {/* Document view/fetch error */}
            {viewDocError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {viewDocError}
              </div>
            )}

            {/* If neither document is required, show a single informational card */}
            {!employee.requiresMedicalCertificate && !employee.requiresBHPTraining && (
              <Card>
                <div className="py-6 text-center">
                  <p className="font-semibold text-slate-700">No compliance documents required</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Go to the <strong>Employment</strong> tab and set "Requires Medical Certificate"
                    or "Requires BHP Training" to <strong>Yes</strong> to enable document uploads.
                  </p>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* Medical Certificate — only shown when the position requires it */}
              {employee.requiresMedicalCertificate && (
                <Card>
                  <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Medical Certificate</h3>
                      <p className="mt-1 text-sm text-slate-500">Badania medycyny pracy</p>
                    </div>
                    <button
                      onClick={() => setUploadModal("medical")}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      Upload
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Status</span>
                      <StatusBadge status={medStatus} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Expiry Date</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatDate(employee.medicalCertificate?.expiryDate)}
                      </span>
                    </div>
                    {medDays !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Days Until Expiry</span>
                        <span className={`text-sm font-bold ${medDays < 0 ? "text-red-600" : medDays < 30 ? "text-amber-600" : "text-emerald-600"}`}>
                          {medDays < 0 ? `${Math.abs(medDays)} days overdue` : `${medDays} days remaining`}
                        </span>
                      </div>
                    )}

                    {employee.medicalCertificate?.documentPath ? (
                      // Document is stored in S3 — request a short-lived pre-signed GET URL
                      // from the backend and open it in a new tab.
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                          Stored Document
                        </p>
                        <p className="mb-3 break-all text-xs text-slate-500">
                          {employee.medicalCertificate.documentPath.split("/").pop()}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDocument("medical")}
                            disabled={viewingDoc === "medical"}
                            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {viewingDoc === "medical" ? "Opening…" : "View Document"}
                          </button>
                          <button
                            onClick={() => setUploadModal("medical")}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Replace
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <p className="text-sm text-slate-400">No document uploaded yet</p>
                        <button
                          onClick={() => setUploadModal("medical")}
                          className="mt-3 text-sm font-bold text-blue-600 hover:underline"
                        >
                          Upload Now →
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* BHP Training — only shown when the position requires it */}
              {employee.requiresBHPTraining && (
                <Card>
                  <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">BHP Safety Training</h3>
                      <p className="mt-1 text-sm text-slate-500">Bezpieczenstwo i Higiena Pracy</p>
                    </div>
                    <button
                      onClick={() => setUploadModal("bhp")}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      Upload
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Status</span>
                      <StatusBadge status={bhpStatus} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Completed Date</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatDate(employee.bhpTraining?.completedDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Expiry Date</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatDate(employee.bhpTraining?.expiryDate)}
                      </span>
                    </div>
                    {bhpDays !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Days Until Expiry</span>
                        <span className={`text-sm font-bold ${bhpDays < 0 ? "text-red-600" : bhpDays < 30 ? "text-amber-600" : "text-emerald-600"}`}>
                          {bhpDays < 0 ? `${Math.abs(bhpDays)} days overdue` : `${bhpDays} days remaining`}
                        </span>
                      </div>
                    )}

                    {employee.bhpTraining?.documentPath ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                          Stored Document
                        </p>
                        <p className="mb-3 break-all text-xs text-slate-500">
                          {employee.bhpTraining.documentPath.split("/").pop()}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDocument("bhp")}
                            disabled={viewingDoc === "bhp"}
                            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {viewingDoc === "bhp" ? "Opening…" : "View Document"}
                          </button>
                          <button
                            onClick={() => setUploadModal("bhp")}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Replace
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <p className="text-sm text-slate-400">No document uploaded yet</p>
                        <button
                          onClick={() => setUploadModal("bhp")}
                          className="mt-3 text-sm font-bold text-blue-600 hover:underline"
                        >
                          Upload Now →
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB: Clock-in Eligibility
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "eligibility" && <EligibilityTab employee={employee} />}

      </div>
    </div>
  );
}

export default EmployeeProfile;
