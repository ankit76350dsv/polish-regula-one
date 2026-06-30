import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Trash2, UserCheck } from "lucide-react";
import {
  AppButton,
  AppModal,
  AppTable,
  Checkbox,
  ConfirmDialog,
  PageSpinner,
  SecureCard,
  SelectField,
  Spinner,
  TextInput,
} from "../../components/ui";
import {
  fetchUsers,
  inviteUser,
  removeUser,
  selectInviting,
  selectRolePermissions,
  selectUsers,
  selectUsersStatus,
} from "../../slices/usersSlice";
import { addToast } from "../../slices/uiSlice";
import { firstError, email as emailRule, required } from "../../utils/validation";

const PERMISSION_KEYS = [
  "viewReports",
  "assignCases",
  "closeCases",
  "exportData",
  "accessAudits",
  "manageUsers",
  "manageRetention",
];

export default function UsersPermissionsMatrixPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const users = useSelector(selectUsers);
  const rolePermissions = useSelector(selectRolePermissions);
  const status = useSelector(selectUsersStatus);
  const inviting = useSelector(selectInviting);

  const [inviteOpen, setInviteOpen] = useState(false);
  // Invite defaults: SafeVoice access is implied (module fixed), one or more SafeVoice
  // permissions can be ticked below (optional — none by default), and the platform
  // account role is USER.
  const [form, setForm] = useState({
    name: "",
    email: "",
    permissions: [],
    role: "ROLE_USER",
  });
  const [errors, setErrors] = useState({});
  const [toRemove, setToRemove] = useState(null);

  useEffect(() => {
    if (status === "idle") dispatch(fetchUsers());
  }, [status, dispatch]);

  if (status === "loading" && users.length === 0) return <PageSpinner label={t("common.loading")} />;

  async function submitInvite(e) {
    e.preventDefault();
    const next = {};
    next.name = firstError(form.name, [required]);
    next.email = firstError(form.email, [required, emailRule]);
    Object.keys(next).forEach((k) => next[k] == null && delete next[k]);
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await dispatch(inviteUser(form)).unwrap();
      dispatch(addToast({ type: "success", message: t("users.inviteSuccess", { email: form.email }) }));
      setInviteOpen(false);
      setForm({ name: "", email: "", permissions: [], role: "ROLE_USER" });
    } catch {
      dispatch(addToast({ type: "error", message: t("toast.genericError") }));
    }
  }

  async function confirmRemove() {
    if (!toRemove) return;
    try {
      await dispatch(removeUser(toRemove.id)).unwrap();
      dispatch(addToast({ type: "success", message: t("toast.accessRemoved") }));
    } catch (e) {
      // Show the backend's own reason when it has one (e.g. "this account is the
      // organisation's primary contact and cannot be deleted"); otherwise a generic error.
      dispatch(addToast({ type: "error", message: e?.message || t("toast.genericError") }));
    } finally {
      setToRemove(null);
    }
  }

  const err = (key) => (errors[key] ? t(errors[key].key, errors[key].params) : undefined);

  return (
    <div className="space-y-8 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("users.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("users.subtitle")}</p>
        </div>
        <AppButton type="button" variant="primary" icon={<UserCheck className="w-4 h-4" />} onClick={() => setInviteOpen(true)}>
          {t("users.invite")}
        </AppButton>
      </div>

      <SecureCard title={t("users.personnel")}>
        <AppTable headers={[t("users.colOfficer"), t("users.colRole"), t("users.colStatus"), t("users.colMfa"), t("users.colLastReview"), ""]}>
          {users.map((user) => (
            <tr
              key={user.id}
              className={`border-b border-slate-200 text-xs ${
                user.hasAccess
                  ? "hover:bg-slate-50 bg-emerald-50/40 border-l-2 border-l-emerald-400"
                  : "hover:bg-slate-50 opacity-60"
              }`}
            >
              <td className="px-4 py-3 font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  {user.name}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide border ${
                      user.hasAccess
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {user.hasAccess ? t("users.hasAccess") : t("users.noAccess")}
                  </span>
                </div>
                <span className="block font-normal text-[10px] text-slate-500 mt-0.5">{user.email}</span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2.5 py-1 rounded border font-semibold uppercase tracking-wider ${
                    user.hasAccess
                      ? "bg-cyan-50 border-cyan-200 text-cyan-700"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  {t(`roles.${user.role}`, user.role)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700">{user.status}</td>
              <td className="px-4 py-3 font-semibold">
                <span className={user.mfaRequired ? "text-emerald-700" : "text-rose-600"}>
                  {user.mfaRequired ? t("users.mfaRequired") : t("users.mfaMissing")}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500 font-mono">{user.lastLoginReview}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setToRemove(user)}
                  aria-label={t("users.confirmRemoveTitle", { name: user.name })}
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      <SecureCard title={t("users.matrix")} subtitle={t("users.matrixSub")}>
        <AppTable headers={[t("users.colRole"), ...PERMISSION_KEYS.map((k) => t(`users.perm.${k}`))]}>
          {rolePermissions.map((rule) => (
            <tr key={rule.role} className="hover:bg-slate-50 border-b border-slate-200">
              <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-700 uppercase">{t(`roles.${rule.role}`, rule.role)}</td>
              {PERMISSION_KEYS.map((key) => (
                <td key={key} className="px-4 py-3 text-center text-xs">
                  <span className={rule[key] ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                    {rule[key] ? t("users.permAllowed") : t("users.permBlocked")}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      {/* Invite modal */}
      <AppModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title={t("users.inviteTitle")}>
        <form className="space-y-4" onSubmit={submitInvite} noValidate>
          <TextInput label={t("users.inviteName")} required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={err("name")} />
          <TextInput label={t("users.inviteEmail")} required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} error={err("email")} />

          {/* Module is fixed: an invite from SafeVoice always grants SafeVoice access. */}
          <div>
            <span className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t("users.inviteModule")}</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
              <UserCheck className="w-3.5 h-3.5" aria-hidden="true" /> SafeVoice
            </span>
          </div>

          {/* The SafeVoice permission(s) to grant — what they may do inside SafeVoice.
              Optional, and more than one may be ticked (the backend stores a list). */}
          <div>
            <span className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              {t("users.invitePermission")}{" "}
              <span className="text-slate-400 normal-case font-normal">({t("common.optional")})</span>
            </span>
            <div className="space-y-2 border border-slate-200 rounded-lg p-3">
              {rolePermissions.map((r) => (
                <Checkbox
                  key={r.role}
                  label={t(`roles.${r.role}`, r.role)}
                  checked={form.permissions.includes(r.role)}
                  onChange={(checked) =>
                    setForm((f) => ({
                      ...f,
                      permissions: checked
                        ? [...f.permissions, r.role]
                        : f.permissions.filter((p) => p !== r.role),
                    }))
                  }
                />
              ))}
            </div>
          </div>

          {/* The platform account role, defaulting to USER. */}
          <SelectField label={t("users.inviteAccountRole")} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="ROLE_USER">{t("roles.ROLE_USER", "User")}</option>
            <option value="ROLE_ADMIN">{t("roles.ROLE_ADMIN", "Admin")}</option>
          </SelectField>
          <div className="flex justify-end gap-2 pt-2">
            <AppButton type="button" variant="secondary" onClick={() => setInviteOpen(false)}>{t("common.cancel")}</AppButton>
            <AppButton type="submit" variant="primary" disabled={inviting}>
              {inviting ? <Spinner size={16} /> : t("users.inviteSubmit")}
            </AppButton>
          </div>
        </form>
      </AppModal>

      <ConfirmDialog
        isOpen={Boolean(toRemove)}
        title={toRemove ? t("users.confirmRemoveTitle", { name: toRemove.name }) : ""}
        message={t("users.confirmRemoveBody")}
        tone="danger"
        confirmLabel={t("common.remove")}
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
