import { PackageX, ShieldOff, Ban, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Full-screen blocking modal shown when a signed-in user is NOT allowed into KSeFFlow.
// Variants, mirroring RegulaOne's UserDisabledModal / PlanExpiredModal style:
//   reason="disabled" → the user's account has been disabled (enabled: false)
//   reason="module"   → the KSeFFlow module is not part of their plan
//   reason="package"  → their subscription/package has expired
// While this is shown, the protected app shell is NOT rendered, so navigation is blocked.
export default function KsefAccessModal({ reason, user, onSignOut }) {
  const { language } = useLanguage();
  const T = (en, pl) => (language === 'pl' ? pl : en);

  const isDisabled = reason === 'disabled';
  const isPackage = reason === 'package';

  const expiryLabel = user?.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const accent = isDisabled ? 'bg-slate-800' : isPackage ? 'bg-amber-600' : 'bg-red-700';
  const Icon = isDisabled ? Ban : isPackage ? PackageX : ShieldOff;

  const title = isDisabled
    ? T('Account disabled', 'Konto zablokowane')
    : isPackage
      ? T('Subscription expired', 'Subskrypcja wygasła')
      : T('No access to KSeFFlow', 'Brak dostępu do KSeFFlow');

  const body = isDisabled
    ? T('Your account has been disabled and cannot access KSeFFlow. Please contact your administrator to restore access.',
        'Twoje konto zostało zablokowane i nie ma dostępu do KSeFFlow. Skontaktuj się z administratorem, aby przywrócić dostęp.')
    : isPackage
      ? T("Your organisation's subscription has expired, so access to KSeFFlow is paused. Renew the plan in RegulaOne to restore access.",
          'Subskrypcja Twojej organizacji wygasła, więc dostęp do KSeFFlow został wstrzymany. Odnów plan w RegulaOne, aby przywrócić dostęp.')
      : T('The KSeFFlow module is not included in your plan, so you cannot use this application. Ask your administrator to enable the KSeFFlow module for your organisation.',
          'Moduł KSeFFlow nie jest częścią Twojego planu, więc nie możesz korzystać z tej aplikacji. Poproś administratora o włączenie modułu KSeFFlow dla Twojej organizacji.');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className={`${accent} px-8 py-8 text-white flex flex-col items-center gap-4 text-center`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Icon className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">RegulaOne · KSeFFlow</span>
            <h2 className="text-xl font-bold mt-1">{title}</h2>
            {isPackage && expiryLabel && (
              <p className="text-white/80 text-xs mt-1">{T('Expired on', 'Wygasła')} {expiryLabel}</p>
            )}
          </div>
        </div>

        <div className="px-8 py-6 text-center">
          <p className="text-slate-700 text-sm leading-relaxed">{body}</p>
          {user?.email && (
            <p className="text-slate-400 text-xs mt-3 font-mono break-all">{user.email}</p>
          )}
        </div>

        <div className="px-8 pb-8 flex flex-col gap-3">
          <button
            onClick={onSignOut}
            className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            {T('Sign out', 'Wyloguj się')}
          </button>
          <p className="text-center text-[11px] text-slate-400">
            {T('Need help? Contact your RegulaOne administrator.', 'Potrzebujesz pomocy? Skontaktuj się z administratorem RegulaOne.')}
          </p>
        </div>
      </div>
    </div>
  );
}
