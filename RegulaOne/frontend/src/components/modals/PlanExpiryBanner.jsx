import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

// Shown as a dismissable top-of-page banner when planExpiringSoon = true
// (plan expires within 7 days but has NOT yet expired).
// ROLE_ADMIN  → "Manage Plan" link navigates to /my-plan
// ROLE_USER   → read-only message, no action button
// ROLE_SUPER_ADMIN → never shown
export default function PlanExpiryBanner() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isAdmin = user?.role === 'ROLE_ADMIN';

  const expiryLabel = user?.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-8 py-3 flex items-center gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />

      <p className="flex-1 text-xs font-medium text-amber-800">
        {isAdmin
          ? <>Your subscription expires on <strong>{expiryLabel}</strong>. Renew now to avoid service interruption.</>
          : <>Your organisation's subscription expires on <strong>{expiryLabel}</strong>. Contact your administrator to renew.</>
        }
      </p>

      {isAdmin && (
        <button
          onClick={() => navigate('/my-plan')}
          className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1 rounded-lg transition-colors flex-shrink-0"
        >
          <RefreshCw className="h-3 w-3" />
          Renew Plan
        </button>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 transition-colors flex-shrink-0 ml-1"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
