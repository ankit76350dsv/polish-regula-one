import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Boxes, Building2, KeyRound, RefreshCw, ShieldCheck, UserCircle } from "lucide-react";
import { AppButton, SecureCard, Spinner } from "../../components/ui";
import { selectCurrentUser } from "../../slices/authSlice";
import { fetchMyOrg, selectMyOrg, selectMyOrgStatus } from "../../slices/orgSlice";
import { SAFEVOICE_PREFIX } from "../../utils/permissions";
import { formatTimestamp } from "../../services/caseNormalizer";

// The signed-in staff member's own account + organisation. Account/role/permissions come
// from the session (/me, already in Redux); the organisation details are fetched from
// RegulaOne. Read-only.
export default function ProfilePage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const org = useSelector(selectMyOrg);
  const orgStatus = useSelector(selectMyOrgStatus);

  useEffect(() => {
    if (orgStatus === "idle") dispatch(fetchMyOrg());
  }, [orgStatus, dispatch]);

  if (!user) return <Spinner label={t("common.loading")} />;

  const initials =
    (user.name || user.email || "")
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—";

  // Strip the "ROLE_" prefix and underscores for a readable platform role.
  const platformRole = user.role ? user.role.replace(/^ROLE_/, "").replace(/_/g, " ") : "—";
  // Only the SafeVoice permission codes are shown here (others belong to other apps).
  const safeVoicePerms = (user.permissions || []).filter((p) => p.startsWith(SAFEVOICE_PREFIX));
  const modules = user.moduleIds || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-cyan-600" aria-hidden="true" />
            {t("profile.title")}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{t("profile.subtitle")}</p>
        </div>
        <AppButton
          type="button"
          variant="outline"
          icon={<RefreshCw className="w-4 h-4" />}
          disabled={orgStatus === "loading"}
          onClick={() => dispatch(fetchMyOrg())}
        >
          {t("common.retry")}
        </AppButton>
      </div>

      {/* Hero */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center text-xl font-bold text-cyan-700 shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-800 truncate">{user.name || "—"}</h2>
          <p className="text-sm text-slate-500 font-mono truncate">{user.email || "—"}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {user.safeVoiceRole && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-cyan-50 text-cyan-700 border-cyan-200 uppercase tracking-wide">
                {t(`roles.${user.safeVoiceRole}`, user.safeVoiceRole)}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                user.enabled === false
                  ? "bg-slate-100 text-slate-500 border-slate-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {user.enabled === false ? t("profile.disabled") : t("profile.active")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Account */}
        <SecureCard title={t("profile.accountTitle")}>
          <div className="divide-y divide-slate-100">
            <Row label={t("profile.fullName")} value={user.name} />
            <Row label={t("profile.email")} value={user.email} mono />
            <Row label={t("profile.safevoiceRole")} value={user.safeVoiceRole ? t(`roles.${user.safeVoiceRole}`, user.safeVoiceRole) : null} />
            <Row label={t("profile.platformRole")} value={platformRole} />
            <Row label={t("common.status")} value={user.enabled === false ? t("profile.disabled") : t("profile.active")} />
          </div>
        </SecureCard>

        {/* Organisation */}
        <SecureCard title={t("profile.orgTitle")} subtitle={<span className="inline-flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" aria-hidden="true" />{user.tenantName || t("common.none")}</span>}>
          {org ? (
            <div className="divide-y divide-slate-100">
              <Row label={t("profile.company")} value={org.name} />
              <Row label="NIP" value={org.nip} mono />
              <Row label="REGON" value={org.regon} mono />
              <Row label={t("profile.email")} value={org.email} mono />
              <Row label={t("profile.phone")} value={org.phone} />
              <Row label={t("profile.address")} value={org.address} />
              <Row label={t("profile.city")} value={[org.postalCode, org.city].filter(Boolean).join(" ")} />
              <Row label={t("common.status")} value={org.status} />
              <Row label={t("profile.created")} value={formatTimestamp(org.createdAt)} />
            </div>
          ) : orgStatus === "loading" ? (
            <p className="text-xs text-slate-400 py-3 text-center">{t("common.loading")}</p>
          ) : (
            <p className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-lg">
              {t("profile.noOrg")}
            </p>
          )}
        </SecureCard>

        {/* Subscription */}
        <SecureCard title={t("profile.subscriptionTitle")}>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-xs text-slate-500">{t("profile.planStatus")}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  user.planExpired
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {user.planExpired ? t("profile.expired") : t("profile.active")}
              </span>
            </div>
            <Row label={t("profile.planExpires")} value={formatTimestamp(user.planExpiresAt)} />
          </div>
          <div className="pt-3 mt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <Boxes className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              {t("profile.modules")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {modules.length === 0 ? (
                <span className="text-xs text-slate-400">{t("common.none")}</span>
              ) : (
                modules.map((m) => (
                  <span key={m} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    {m}
                  </span>
                ))
              )}
            </div>
          </div>
        </SecureCard>

        {/* SafeVoice access & permissions */}
        <SecureCard title={t("profile.accessTitle")}>
          {safeVoicePerms.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-lg">
              {t("profile.noPermissions")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {safeVoicePerms.map((p) => (
                <span
                  key={p}
                  title={p}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100"
                >
                  <ShieldCheck className="w-3 h-3" aria-hidden="true" /> {t(`roles.${p}`, p)}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed flex items-start gap-1.5">
            <KeyRound className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
            {t("profile.accessNote")}
          </p>
        </SecureCard>
      </div>
    </div>
  );
}

// One label/value row.
function Row({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-slate-700 text-right break-words min-w-0 ${mono ? "font-mono" : ""}`}>
        {value !== null && value !== undefined && value !== "" ? value : "—"}
      </span>
    </div>
  );
}
