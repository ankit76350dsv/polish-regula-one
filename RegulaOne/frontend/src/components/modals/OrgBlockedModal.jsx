import { LogOut, Building2, ShieldAlert } from 'lucide-react';
import { useLogout } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';

// Shown to ROLE_USER when their organisation is missing, disabled, or suspended.
// Non-dismissable — only action available is to sign out.
export default function OrgBlockedModal() {
  const { user } = useAuthStore();
  const logout = useLogout();

  const config = resolveConfig(user?.tenantStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden text-center">

        {/* Header */}
        <div className="bg-red-700 px-8 py-8 text-white flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <config.Icon className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-300">
              RegulaOne
            </span>
            <h2 className="text-xl font-bold mt-1">{config.title}</h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <p className="text-slate-700 text-sm leading-relaxed">{config.message}</p>
          <p className="text-slate-400 text-xs mt-4">
            If you believe this is a mistake, contact your system administrator.
          </p>
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

function resolveConfig(tenantStatus) {
  if (tenantStatus === 'INACTIVE') {
    return {
      Icon: ShieldAlert,
      title: 'Organisation Disabled',
      message:
        'Your organisation account has been disabled. Please contact your administrator to restore access.',
    };
  }

  if (tenantStatus === 'SUSPENDED') {
    return {
      Icon: ShieldAlert,
      title: 'Organisation Suspended',
      message:
        'Your organisation has been suspended. Please contact your administrator or RegulaOne support.',
    };
  }

  // tenantId is null — org not found / not yet linked
  return {
    Icon: Building2,
    title: 'Organisation Not Found',
    message:
      'Your account is not linked to any organisation. Please contact your administrator to set up access.',
  };
}
