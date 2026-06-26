import { UserCheck } from "lucide-react";
import { AppButton, AppTable, SecureCard } from "../../components/ui";
import { rolePermissions, users } from "../staticData";

const permissionKeys = [
  ["viewReports", "View"],
  ["assignCases", "Assign"],
  ["closeCases", "Close"],
  ["exportData", "Export"],
  ["accessAudits", "Audits"],
  ["manageUsers", "Users"],
  ["manageRetention", "Retention"],
];

export default function UsersPermissionsMatrixPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Users and permissions</h1>
          <p className="text-xs text-slate-500 mt-1">
            Static role matrix and authorized personnel page.
          </p>
        </div>
        <AppButton type="button" variant="primary" icon={<UserCheck className="w-4 h-4" />}>
          Invite officer
        </AppButton>
      </div>

      <SecureCard title="Authorized personnel">
        <AppTable headers={["Officer", "Role", "Status", "MFA", "Last review"]}>
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50 border-b border-slate-200 text-xs">
              <td className="px-4 py-3 font-bold text-slate-800">
                {user.name}
                <span className="block font-normal text-[10px] text-slate-500 mt-0.5">{user.email}</span>
              </td>
              <td className="px-4 py-3">
                <span className="bg-cyan-50 px-2.5 py-1 rounded border border-cyan-200 text-cyan-700 font-semibold uppercase tracking-wider">
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700">{user.status}</td>
              <td className="px-4 py-3 text-emerald-700 font-semibold">
                {user.mfaRequired ? "Required" : "Missing"}
              </td>
              <td className="px-4 py-3 text-slate-500 font-mono">{user.lastLoginReview}</td>
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      <SecureCard title="Permission matrix" subtitle="No authorization logic is active in this phase">
        <AppTable headers={["Role", ...permissionKeys.map(([, label]) => label)]}>
          {rolePermissions.map((rule) => (
            <tr key={rule.role} className="hover:bg-slate-50 border-b border-slate-200">
              <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-700 uppercase">
                {rule.role}
              </td>
              {permissionKeys.map(([key]) => (
                <td key={key} className="px-4 py-3 text-center text-xs">
                  <span className={rule[key] ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                    {rule[key] ? "Allowed" : "Blocked"}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </AppTable>
      </SecureCard>

      <SecureCard title="Invite officer form" subtitle="Visual-only form shell">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
            Officer name
            <input defaultValue="Alicja Nowak" className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
            Business email
            <input defaultValue="alicja.nowak@regulaone.pl" className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
            Role
            <select defaultValue="Investigator" className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm">
              {rolePermissions.map((role) => (
                <option key={role.role}>{role.role}</option>
              ))}
            </select>
          </label>
        </div>
      </SecureCard>
    </div>
  );
}
