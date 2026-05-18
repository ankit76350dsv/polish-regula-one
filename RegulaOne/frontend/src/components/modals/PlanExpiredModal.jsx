import { useNavigate } from 'react-router-dom';
import { PackageX, LogOut, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';

// Shown when the tenant's currentPackage.expiringDate is in the past (planExpired = true).
// ROLE_ADMIN  → "Manage Plan" button navigates to /my-plan (modal is suppressed on that route)
// ROLE_USER   → read-only message + sign-out only
// ROLE_SUPER_ADMIN → never shown (they manage the platform, have no tenant plan)
export default function PlanExpiredModal() {
  const { user } = useAuthStore();
  const logout   = useLogout();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ROLE_ADMIN';

  const expiryLabel = user?.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-amber-600 px-8 py-8 text-white flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <PackageX className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
              RegulaOne
            </span>
            <h2 className="text-xl font-bold mt-1">Plan Expired</h2>
            {expiryLabel && (
              <p className="text-amber-200 text-xs mt-1">Expired on {expiryLabel}</p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 text-center">
          {isAdmin ? (
            <>
              <p className="text-slate-700 text-sm leading-relaxed">
                Your organisation's subscription has expired. Renew your plan to restore full access to all compliance modules.
              </p>
              <p className="text-slate-400 text-xs mt-3">
                Click <strong>Manage Plan</strong> to review and renew your subscription.
              </p>
            </>
          ) : (
            <>
              <p className="text-slate-700 text-sm leading-relaxed">
                Your organisation's subscription has expired. Access has been temporarily suspended.
              </p>
              <p className="text-slate-400 text-xs mt-3">
                Please contact your administrator to renew the subscription.
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex flex-col gap-3">
          {isAdmin && (
            <button
              onClick={() => navigate('/my-plan')}
              className="flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Manage Plan
            </button>
          )}
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex items-center justify-center gap-2 mx-auto text-slate-500 hover:text-red-700 font-medium text-sm transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}
