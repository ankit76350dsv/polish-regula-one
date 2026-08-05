import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchCompanyProfile,
  saveBdoNumber,
  clearSubmitError,
} from "../store/slices/companySlice";
import { useCapabilities } from "../hooks/useCapabilities";
import { WASTESYNC_ROLES } from "../config/capabilities";
import {
  PageHeader,
  Card,
  Button,
  Loader,
  AlertBanner,
  Badge,
} from "../components/common";

/**
 * Company Profile.
 *
 * WHAT CHANGED AND WHY (page purpose — unchanged)
 * This page used to be a LIST of companies with "Add company" and "Edit"
 * buttons. It is not any more.
 *
 * The customer's company is registered once, in the main RegulaOne application,
 * when they sign up. WasteSync now reads those details instead of asking for
 * them a second time. Typing the company in twice meant two copies of the same
 * legal entity, which could end up with different names, NIP numbers or
 * addresses — and those details are printed on reports sent to a government
 * register, so a mismatch is a filing error.
 *
 * So everything here is read-only, with ONE exception: the 9-digit BDO
 * registration number. RegulaOne does not store that number (it only matters for
 * waste reporting), so a WasteSync admin enters it here.
 *
 * WHAT CHANGED IN THIS FILE (layout only)
 * The old screen was one very tall card with a 2-column list of every field, and
 * a second card underneath for the BDO number. It has been rebuilt to use the
 * same shape as the "My profile" screen in the other RegulaOne apps
 * (see PrivacyPilot/frontend/src/pages/Profile/ProfilePage.jsx):
 *
 *   - a "hero" strip at the top with the company initials, name and status,
 *   - then small cards side by side, each one subject (identity, contact,
 *     address, BDO number, subscription, access), each with an icon and title.
 *
 * Why: the fields are read far more often than they are changed, and grouping
 * them by subject means a person looking for the NIP or the BDO number finds it
 * without reading past nine unrelated labels. Nothing about the DATA, the API
 * calls, the Redux slice or the permission checks changed — only the markup.
 */

// ── Small icons ───────────────────────────────────────────────────────────────
// Drawn here as plain SVG on purpose: WasteSync has no icon library installed,
// and adding one for six little pictures is not worth a new dependency.
// `currentColor` means each icon simply takes the colour of the text next to it.
function Svg({ children, className = "w-4 h-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// A building — used for the company's legal identity.
const IconBuilding = (props) => (
  <Svg {...props}>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
    <path d="M2 22h20" />
    <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
  </Svg>
);

// An envelope — used for the contact details.
const IconMail = (props) => (
  <Svg {...props}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </Svg>
);

// A map pin — used for the registered address.
const IconPin = (props) => (
  <Svg {...props}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Svg>
);

// A "#" sign — used for the BDO registration number.
const IconHash = (props) => (
  <Svg {...props}>
    <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
  </Svg>
);

// A payment card — used for the subscription.
const IconCard = (props) => (
  <Svg {...props}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </Svg>
);

// A key — used for "what you are allowed to do".
const IconKey = (props) => (
  <Svg {...props}>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 7.5-7.5" />
    <path d="m16 4 3 3" />
    <path d="m14 6.5 3 3" />
  </Svg>
);

// A shield with a tick — sits inside every permission chip.
const IconShield = (props) => (
  <Svg {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

// A box — sits next to the list of paid-for modules.
const IconBox = (props) => (
  <Svg {...props}>
    <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z" />
    <path d="m3 7 9 4 9-4M12 11v10" />
  </Svg>
);

// ── Friendly names ────────────────────────────────────────────────────────────
// RegulaOne sends module and role codes in SHOUTING_CASE. Showing those to a
// person is unfriendly, so we translate the ones we know about. Anything we do
// not recognise is shown exactly as it arrived rather than hidden, so a new
// module or role never disappears from this screen by accident.
const MODULE_LABELS = {
  KSEFFLOW: "KSeFFlow",
  SAFEVOICE: "SafeVoice",
  WORKPULSE: "WorkPulse",
  SAFEWORK: "SafeWork",
  WASTESYNC: "WasteSync",
  PRIVACYPILOT: "PrivacyPilot",
};

const ROLE_LABELS = {
  WASTESYNC_ADMIN: "WasteSync Admin",
  WASTESYNC_HR_MANAGER: "WasteSync HR Manager",
  WASTESYNC_AUDITOR: "WasteSync Auditor",
};

// ── Building blocks used only by this page ───────────────────────────────────

// One label on the left, its value on the right. Empty values show a dash so the
// row still lines up and it is clear the field exists but is not filled in.
function Row({ label, value, mono = false }) {
  const shown = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span
        className={`min-w-0 break-words text-right text-xs font-medium text-slate-900 ${
          mono ? "font-mono" : ""
        }`}
      >
        {shown}
      </span>
    </div>
  );
}

// One card with an icon, a title, an optional button on the right, and content.
function Section({ icon, title, action, children, className = "" }) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="text-emerald-600">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

// A small pill for a permission the person holds.
function PermissionChip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
      <IconShield className="w-3 h-3" />
      {children}
    </span>
  );
}

export default function Companies() {
  const dispatch = useDispatch();
  const { profile, loading, error, bdoRegistrationMissing, submitting, submitError } =
    useSelector((state) => state.companies);

  // The signed-in user, mirrored into Redux by AuthProvider after /auth/me.
  // It carries the subscription and the person's own permission codes, which the
  // last two cards show. It may be null for a moment while /me is still running,
  // so every read below is optional.
  const user = useSelector((state) => state.auth.user);

  // May this person change the BDO number? An auditor may only look, so for them
  // the edit button is hidden. The backend refuses the call anyway — hiding the
  // button just avoids offering something that fails.
  const { can, CAPABILITIES } = useCapabilities();
  const canWrite = can(CAPABILITIES.COMPANY_WRITE);

  // Local UI state only: is the small BDO form open, and what is typed in it.
  const [editingBdo, setEditingBdo] = useState(false);
  const [bdoInput, setBdoInput] = useState("");
  const [bdoError, setBdoError] = useState(null);

  // Load the profile once when the page opens. The backend refreshes it from
  // RegulaOne on every call, so what we show is always the current record.
  useEffect(() => {
    dispatch(clearSubmitError());
    dispatch(fetchCompanyProfile());
  }, [dispatch]);

  const openBdoForm = () => {
    setBdoInput(profile?.bdoRegistrationNumber || "");
    setBdoError(null);
    dispatch(clearSubmitError());
    setEditingBdo(true);
  };

  const onSaveBdo = async (event) => {
    event.preventDefault();

    // Check in the browser first so the user gets an instant answer. The server
    // checks the same rule again — the browser check is only for convenience.
    const cleaned = bdoInput.replace(/\s/g, "");
    if (!/^\d{9}$/.test(cleaned)) {
      setBdoError("The BDO number must be exactly 9 digits.");
      return;
    }
    setBdoError(null);

    const result = await dispatch(saveBdoNumber(cleaned));
    if (saveBdoNumber.fulfilled.match(result)) setEditingBdo(false);
  };

  if (loading && !profile) return <Loader label="Loading your company…" />;

  // First letters of the company name, e.g. "DSV Team" → "DT". Shown in the
  // circle at the top, the same way the other RegulaOne apps do it.
  const initials =
    (profile?.name || "")
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—";

  // Dates arrive as ISO text. Show them day/month/year, which is how dates are
  // written in Poland and the EU — never month/day/year, which reads as a
  // different date entirely.
  const formatDate = (iso) => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-GB");
  };

  // The WasteSync job titles this person holds. `permissions` lists roles for
  // every app on the platform, so we keep only the WasteSync ones — a KSeFFlow
  // role says nothing about what may be done here.
  const wasteSyncRoles = (Array.isArray(user?.permissions) ? user.permissions : [])
    .map((permission) => String(permission).toUpperCase())
    .filter((permission) => WASTESYNC_ROLES.includes(permission));

  const modules = Array.isArray(user?.moduleIds) ? user.moduleIds : [];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Company"
        subtitle="Your company details come from RegulaOne. Change them there and they update here automatically."
      />

      {error && (
        <div className="mb-4">
          <AlertBanner level="error">{error}</AlertBanner>
        </div>
      )}

      {/* No BDO number yet — reports cannot be generated until it is added. */}
      {profile && bdoRegistrationMissing && (
        <div className="mb-4">
          <AlertBanner level="warning">
            {canWrite
              ? "Add your 9-digit BDO registration number below. Reports cannot be generated without it."
              : "This company has no BDO registration number yet. Someone who manages company records needs to add it before reports can be generated."}
          </AlertBanner>
        </div>
      )}

      {profile && (
        <>
          {/* ── Hero: who this company is, at a glance ──────────────────────── */}
          <Card className="mb-4 p-5">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 shrink-0 grid place-items-center rounded-full bg-emerald-50 text-xl font-semibold text-emerald-700">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-900">
                  {profile.name || "—"}
                </h2>
                <p className="truncate text-sm text-slate-500">
                  {profile.contactEmail || "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {profile.isActive ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge>Inactive</Badge>
                  )}
                  {profile.bdoRegistrationNumber ? (
                    <Badge tone="blue">BDO {profile.bdoRegistrationNumber}</Badge>
                  ) : (
                    <Badge tone="amber">No BDO number</Badge>
                  )}
                  <Badge>Managed in RegulaOne</Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* HOW THESE CARDS ARE ARRANGED — and why the old way left big holes.
              Before, all six cards sat in one two-column GRID. A grid works in
              fixed rows: both cards in a row start at the same line, so when one
              card is short the space under it stays empty until the next row
              begins. That empty space is the gap you saw between "BDO
              registration number" and "Registered address".

              Now there are TWO separate stacks side by side. Each card sits
              directly under the card above it in its own stack, so nothing is
              stretched to match its neighbour and there are no holes. The two
              stacks are simply allowed to end at different heights, which is
              normal and reads fine.

              The split is also meaningful:
                LEFT  — the company record as RegulaOne holds it (read-only),
                RIGHT — what WasteSync and the platform add on top.

              `items-start` keeps each stack at its own height instead of making
              the shorter one as tall as the taller one. On a narrow screen the
              two stacks fall under each other into one single column. */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* ── LEFT STACK: the company record, owned by RegulaOne ────────── */}
            <div className="flex flex-col gap-4">
              {/* Legal identity — the values printed on every BDO filing. */}
              <Section icon={<IconBuilding />} title="Company identity">
                <div className="divide-y divide-slate-100">
                  <Row label="Company name" value={profile.name} />
                  <Row label="NIP (tax number)" value={profile.nip} mono />
                  <Row label="REGON" value={profile.regon} mono />
                  <Row label="Status" value={profile.isActive ? "Active" : "Inactive"} />
                  <Row label="Registered on" value={formatDate(profile.registeredAt)} />
                </div>
              </Section>

              {/* Contact details (owned by RegulaOne). */}
              <Section icon={<IconMail />} title="Contact">
                <div className="divide-y divide-slate-100">
                  <Row label="E-mail" value={profile.contactEmail} />
                  <Row label="Phone" value={profile.contactPhone} mono />
                </div>
              </Section>

              {/* Registered address (printed on every report). */}
              <Section icon={<IconPin />} title="Registered address">
                <div className="divide-y divide-slate-100">
                  <Row label="Street" value={profile.address?.street} />
                  <Row label="Postal code" value={profile.address?.postalCode} mono />
                  <Row label="City" value={profile.address?.city} />
                  <Row label="Country" value={profile.address?.country} />
                </div>
              </Section>
            </div>

            {/* ── RIGHT STACK: what WasteSync and the platform add ──────────── */}
            <div className="flex flex-col gap-4">
              {/* The one field WasteSync owns — the only editable card here. */}
              <Section
                icon={<IconHash />}
                title="BDO registration number"
                action={
                  canWrite && !editingBdo ? (
                    <Button variant="secondary" onClick={openBdoForm}>
                      {profile.bdoRegistrationNumber ? "Change" : "Add number"}
                    </Button>
                  ) : null
                }
              >
                <p className="text-xs text-slate-500">
                  The 9-digit number from the Polish BDO register. It is printed on every
                  report, and RegulaOne does not store it, so it is set here.
                </p>

                {submitError && (
                  <div className="mt-3">
                    <AlertBanner level="error">{submitError}</AlertBanner>
                  </div>
                )}

                {editingBdo ? (
                  <form onSubmit={onSaveBdo} className="mt-3 space-y-3">
                    <input
                      className="w-full sm:w-56 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={bdoInput}
                      onChange={(e) => setBdoInput(e.target.value)}
                      placeholder="000123456"
                      inputMode="numeric"
                      autoFocus
                    />
                    {bdoError && <p className="text-xs text-red-600">{bdoError}</p>}
                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={submitting}>
                        {submitting ? "Saving…" : "Save number"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingBdo(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-3 text-lg font-mono text-slate-900">
                    {profile.bdoRegistrationNumber || (
                      <span className="text-sm font-sans text-slate-400">Not set yet</span>
                    )}
                  </p>
                )}
              </Section>

              {/* Subscription — what this customer pays for. */}
              <Section icon={<IconCard />} title="Subscription">
                <div className="divide-y divide-slate-100">
                  <div className="flex items-center justify-between gap-3 py-2">
                    <span className="text-xs text-slate-500">Plan status</span>
                    {user?.planExpired ? (
                      <Badge tone="red">Expired</Badge>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </div>
                  <Row label="Plan expires" value={formatDate(user?.planExpiresAt)} />
                </div>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <IconBox className="w-3.5 h-3.5" /> Enabled modules
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {modules.length === 0 ? (
                      <span className="text-xs text-slate-400">None</span>
                    ) : (
                      modules.map((moduleId) => (
                        <span
                          key={moduleId}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                          {MODULE_LABELS[String(moduleId).toUpperCase()] ?? moduleId}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </Section>

              {/* What this person may do here. */}
              <Section icon={<IconKey />} title="What you can do in WasteSync">
                {wasteSyncRoles.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 py-3 text-center text-xs text-slate-500">
                    You have no WasteSync permissions.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {wasteSyncRoles.map((role) => (
                      <PermissionChip key={role}>
                        {ROLE_LABELS[role] ?? role}
                      </PermissionChip>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                  Permissions decide what you can see and change in WasteSync. They are
                  managed by your administrator in RegulaOne.
                </p>
              </Section>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Company details are read from RegulaOne each time this page opens. WasteSync
            keeps no copy of them, so what you see is always current.
          </p>
        </>
      )}
    </div>
  );
}
