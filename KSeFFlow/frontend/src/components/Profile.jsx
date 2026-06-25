import { useState, useEffect, useCallback } from 'react';
import {
  UserCircle, Building2, ShieldCheck, KeyRound, CreditCard, RefreshCw,
  Loader2, AlertTriangle, Boxes,
} from 'lucide-react';
import { getMe, getMyTenant } from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';

// ── Profile ───────────────────────────────────────────────────────────────────
// Shows the signed-in user's account (from /api/auth/me) and their organisation
// (from /api/tenant/info). Read-only; all data is live from the backend.

export default function Profile() {
  const { t, language } = useLanguage();
  const T = (en, pl) => (language === 'pl' ? pl : en);

  const [me, setMe] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    // /me always works; /info can fail for users with no organisation (e.g. Super Admin) — tolerate it.
    Promise.all([getMe(), getMyTenant().catch(() => null)])
      .then(([user, tenant]) => { setMe(user); setOrg(tenant); })
      .catch((err) => setError(err?.message || T('Could not load your profile.', 'Nie udało się wczytać profilu.')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const initials = (name = '') => name.trim().split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '—';
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const cleanRole = (r) => (r ? r.replace(/^ROLE_/, '').replace(/_/g, ' ') : '—');
  const cleanPerm = (p) => p.replace(/^KSEF_/, '').replace(/_/g, ' ');

  const header = (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <UserCircle className="text-red-600" size={20} />
          {T('My Profile', 'Mój profil')}
        </h2>
        <p className="text-slate-400 text-xs mt-1">{T('Your account and organisation details.', 'Dane Twojego konta i organizacji.')}</p>
      </div>
      <button
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-xl text-xs transition cursor-pointer disabled:opacity-60 shrink-0"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {T('Refresh', 'Odśwież')}
      </button>
    </div>
  );

  if (loading && !me) {
    return (
      <div className="space-y-6">
        {header}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-28 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-48 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-3">
          <AlertTriangle className="mx-auto text-red-400" size={28} />
          <p className="text-sm font-semibold text-red-700">{T('Could not load your profile', 'Nie udało się wczytać profilu')}</p>
          <p className="text-xs text-red-500">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition cursor-pointer">
            <RefreshCw size={13} /> {T('Try again', 'Spróbuj ponownie')}
          </button>
        </div>
      </div>
    );
  }

  const permissions = Array.isArray(me?.permissions) ? me.permissions : [];
  const modules = Array.isArray(me?.moduleIds) ? me.moduleIds : [];

  return (
    <div className="space-y-6">
      {header}

      {/* Hero */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-xl font-bold text-red-600 shrink-0">
          {initials(me?.name)}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-800 truncate">{me?.name || '—'}</h3>
          <p className="text-sm text-slate-500 font-mono truncate">{me?.email || '—'}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200">{cleanRole(me?.role)}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${me?.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              {me?.enabled ? T('Active', 'Aktywne') : T('Suspended', 'Zawieszone')}
            </span>
            {me?.tempPassword && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">{T('Password reset required', 'Wymagana zmiana hasła')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Account */}
        <Card icon={<UserCircle size={15} className="text-red-600" />} title={T('Account', 'Konto')}>
          <Row label={T('Full name', 'Imię i nazwisko')} value={me?.name} />
          <Row label={T('Email', 'E-mail')} value={me?.email} mono />
          <Row label={T('Role', 'Rola')} value={cleanRole(me?.role)} />
          <Row label={T('Status', 'Status')} value={me?.enabled ? T('Active', 'Aktywne') : T('Suspended', 'Zawieszone')} />
          <Row label={T('User ID', 'ID użytkownika')} value={me?.id} mono />
          <Row label={T('Member since', 'Konto od')} value={fmtDate(me?.createdAt)} />
          <Row label={T('Last updated', 'Ostatnia zmiana')} value={fmtDate(me?.updatedAt)} />
        </Card>

        {/* Organisation */}
        <Card icon={<Building2 size={15} className="text-red-600" />} title={T('Organisation', 'Organizacja')}>
          {org ? (
            <>
              <Row label={T('Company name', 'Nazwa firmy')} value={org.name} />
              <Row label="NIP" value={org.nip} mono />
              <Row label="REGON" value={org.regon} mono />
              <Row label={T('Email', 'E-mail')} value={org.email} mono />
              <Row label={T('Phone', 'Telefon')} value={org.phone} />
              <Row label={T('Address', 'Adres')} value={org.address} />
              <Row label={T('City', 'Miasto')} value={[org.postalCode, org.city].filter(Boolean).join(' ')} />
              <Row label={T('Status', 'Status')} value={org.status} />
              <Row label={T('Created', 'Utworzono')} value={fmtDate(org.createdAt)} />
            </>
          ) : (
            <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
              {T('No organisation is linked to your account.', 'Z Twoim kontem nie powiązano organizacji.')}
            </p>
          )}
        </Card>

        {/* Subscription / plan */}
        <Card icon={<CreditCard size={15} className="text-red-600" />} title={T('Subscription', 'Subskrypcja')}>
          <Row label={T('Plan', 'Plan')} value={me?.packageId} mono />
          <Row label={T('Expires', 'Wygasa')} value={fmtDate(me?.planExpiresAt)} />
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-xs text-slate-500">{T('Plan status', 'Status planu')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              me?.planExpired ? 'bg-red-50 text-red-700 border-red-200' :
              me?.planExpiringSoon ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {me?.planExpired ? T('Expired', 'Wygasł') : me?.planExpiringSoon ? T('Expiring soon', 'Wkrótce wygasa') : T('Active', 'Aktywny')}
            </span>
          </div>
          <div className="pt-2 mt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2"><Boxes size={13} className="text-slate-400" />{T('Modules', 'Moduły')}</div>
            <div className="flex flex-wrap gap-1.5">
              {modules.length === 0 ? <span className="text-xs text-slate-400">{T('None', 'Brak')}</span>
                : modules.map((m) => <span key={m} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">{m}</span>)}
            </div>
          </div>
        </Card>

        {/* Access & permissions */}
        <Card icon={<KeyRound size={15} className="text-red-600" />} title={T('KSeF access & permissions', 'Dostęp i uprawnienia KSeF')}>
          {permissions.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
              {T('No KSeF permissions assigned. Ask your administrator for access.', 'Brak przypisanych uprawnień KSeF. Poproś administratora o dostęp.')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p) => (
                <span key={p} title={p} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-red-50 text-red-700 border border-red-100">
                  <ShieldCheck size={11} /> {cleanPerm(p)}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
            {T('Permissions control what you can do in KSeF. They are managed by your administrator on the Permissions page.',
               'Uprawnienia decydują o tym, co możesz robić w KSeF. Zarządza nimi administrator na stronie Uprawnienia.')}
          </p>
        </Card>
      </div>
    </div>
  );
}

// A titled card matching the app's panel style.
function Card({ icon, title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
        {icon} {title}
      </h3>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  );
}

// One label/value row.
function Row({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-slate-700 text-right break-words min-w-0 ${mono ? 'font-mono' : ''}`}>
        {value !== null && value !== undefined && value !== '' ? value : '—'}
      </span>
    </div>
  );
}
