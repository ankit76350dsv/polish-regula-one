// Shown to ROLE_ADMIN when their organisation's tenantStatus is INACTIVE or SUSPENDED.
//
// Distinct from OrgBlockedModal (targets ROLE_USER, directs them to their admin).
// Here the admin IS the org owner — they must contact RegulaOne directly, not
// their own administrator.
//
// Non-dismissable: the only action is signing out, because no in-app action
// can reactivate a suspended/inactive tenant without RegulaOne support involvement.

import { LogOut, ShieldOff, PhoneCall } from 'lucide-react';
import { useLogout } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';

export default function TenantSuspendedModal() {
  const { user } = useAuthStore();
  const logout   = useLogout();

  const suspended = user?.tenantStatus === 'SUSPENDED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden text-center">

        {/* Header */}
        <div className="bg-red-700 px-8 py-8 text-white flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <ShieldOff className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-300">
              RegulaOne
            </span>
            <h2 className="text-xl font-bold mt-1">
              {suspended ? 'Account Suspended' : 'Account Deactivated'}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-4">
          {user?.tenantName && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {user.tenantName}
            </p>
          )}

          <p className="text-slate-700 text-sm leading-relaxed">
            {suspended
              ? 'Your organisation has been suspended by RegulaOne. Access to all modules is currently restricted.'
              : 'Your organisation account has been deactivated. Access to all modules is currently restricted.'
            }
          </p>

          {/* Contact callout */}
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-left">
            <PhoneCall className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed">
              Please contact{' '}
              <span className="font-bold">RegulaOne support</span>{' '}
              to restore access to your account.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-7">
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex items-center gap-2 mx-auto text-slate-500 hover:text-red-700 font-medium text-sm transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
