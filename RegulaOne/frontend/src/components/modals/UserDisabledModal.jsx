// Shown when the authenticated user's account has been disabled (enabled: false in /me).
//
// This is an individual account block — distinct from:
//   OrgBlockedModal      (the whole ORGANISATION is disabled — targets ROLE_USER)
//   TenantSuspendedModal (the whole ORGANISATION is suspended — targets ROLE_ADMIN)
//
// Here the ORG may be perfectly healthy; only this specific user was disabled.
// ROLE_USER  → contact your administrator (the org admin disabled the account).
// ROLE_ADMIN → contact RegulaOne support (only superadmin can re-enable an admin account).
//
// Non-dismissable — the user cannot take any action except signing out.

import { LogOut, UserX } from 'lucide-react';
import { useLogout } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';

export default function UserDisabledModal() {
  const { user } = useAuthStore();
  const logout   = useLogout();

  const isAdmin = user?.role === 'ROLE_ADMIN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden text-center">

        {/* Header */}
        <div className="bg-slate-800 px-8 py-8 text-white flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <UserX className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              RegulaOne
            </span>
            <h2 className="text-xl font-bold mt-1">Account Disabled</h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-3">
          {user?.displayName && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {user.displayName}
            </p>
          )}

          <p className="text-slate-700 text-sm leading-relaxed">
            Your account has been disabled and you no longer have access to the platform.
          </p>

          <p className="text-slate-500 text-xs leading-relaxed">
            {isAdmin
              ? 'Please contact RegulaOne support to restore your account.'
              : 'Please contact your organisation administrator to restore access.'
            }
          </p>
        </div>

        {/* Footer */}
        <div className="px-8 pb-7">
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex items-center gap-2 mx-auto text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
