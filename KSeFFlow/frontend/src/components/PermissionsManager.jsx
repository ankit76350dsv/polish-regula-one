import { useState, useEffect, useCallback } from 'react';
import { KeyRound, UserPlus, Trash2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  queryPersonPermissions,
  grantPersonPermissions,
  revokePermission,
} from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../lib/permissions';

// ── KSeF permissions (uprawnienia) ────────────────────────────────────────────
// SIMPLE EXPLANATION:
// In KSeF the company owner can let other people act for the company — e.g. an employee who
// issues invoices, or an accounting office. This screen lists who currently has which rights
// and lets an admin grant a new right or take one away. Grants/revokes are admin-only and the
// backend also enforces that (this UI just guides the user). The tenant's own NIP is the
// context the rights are granted within.

const PERMISSION_OPTIONS = [
  { code: 'InvoiceWrite' },
  { code: 'InvoiceRead' },
  { code: 'CredentialsManage' },
  { code: 'CredentialsRead' },
  { code: 'Introspection' },
  { code: 'SubunitManage' },
  { code: 'EnforcementOperations' },
];

const getPermissionLabel = (code, lang) => {
  const labels = {
    InvoiceWrite: { pl: 'Wystawianie faktur', en: 'Issue invoices' },
    InvoiceRead: { pl: 'Przeglądanie / odbieranie faktur', en: 'Browse / receive invoices' },
    CredentialsManage: { pl: 'Zarządzanie uprawnieniami', en: 'Manage permissions' },
    CredentialsRead: { pl: 'Podgląd uprawnień', en: 'View permissions' },
    Introspection: { pl: 'Introspekcja (podgląd sesji)', en: 'Introspection (session review)' },
    SubunitManage: { pl: 'Zarządzanie podmiotami podrzędnymi', en: 'Manage subunits' },
    EnforcementOperations: { pl: 'Operacje egzekucyjne', en: 'Enforcement operations' },
  };
  return labels[code]?.[lang] || code;
};

export default function PermissionsManager({ tenant, role, permissions: userPermissions, onAddNotification }) {
  const { language, t } = useLanguage();
  const nip = tenant?.nip || '';
  // Granting/revoking KSeF permissions is KSEF_TENANT_ADMIN-only — matches the
  // backend guards on POST /permissions/persons/grants and DELETE /permissions/{id}.
  // NOTE: renamed to userPermissions to avoid clashing with the `permissions` state
  // below (which holds the company's KSeF permission grants, a different concept).
  const isAdmin = can.managePermissions(userPermissions);

  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);

  // Grant form state.
  const [subjectType, setSubjectType] = useState('Nip');
  const [subjectValue, setSubjectValue] = useState('');
  const [selected, setSelected]       = useState({ InvoiceWrite: true, InvoiceRead: true });
  const [description, setDescription] = useState('');
  const [isGranting, setIsGranting]   = useState(false);
  const [revokingId, setRevokingId]   = useState(null);

  // Load the current permissions list from KSeF.
  const loadPermissions = useCallback(() => {
    if (!nip) { setError(language === 'pl' ? 'Brak NIP organizacji — nie można odczytać uprawnień.' : 'No NIP corporate ID found - cannot load permissions.'); return; }
    setIsLoading(true);
    setError(null);
    queryPersonPermissions(nip, { queryType: 'PermissionsGrantedInCurrentContext' }, { pageSize: 100 })
      .then(res => setPermissions(res.permissions))
      .catch(err => setError(err.message || (language === 'pl' ? 'Nie udało się odczytać uprawnień.' : 'Failed to retrieve permissions.')))
      .finally(() => setIsLoading(false));
  }, [nip, language]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const toggle = (code) => setSelected(prev => ({ ...prev, [code]: !prev[code] }));

  // Validate the form, then ask the backend to grant the chosen permissions.
  const handleGrant = async (e) => {
    e.preventDefault();
    const perms = Object.keys(selected).filter(c => selected[c]);
    if (!subjectValue.trim())      { onAddNotification?.(language === 'pl' ? 'Błąd' : 'Error', language === 'pl' ? 'Podaj identyfikator osoby (NIP/PESEL).' : 'Provide person identifier (NIP/PESEL).', 'error'); return; }
    if (perms.length === 0)        { onAddNotification?.(language === 'pl' ? 'Błąd' : 'Error', language === 'pl' ? 'Wybierz co najmniej jedno uprawnienie.' : 'Select at least one permission.', 'error'); return; }
    if (!description.trim())       { onAddNotification?.(language === 'pl' ? 'Błąd' : 'Error', language === 'pl' ? 'Podaj opis (powód nadania uprawnień).' : 'Provide a description (reason for granting).', 'error'); return; }

    setIsGranting(true);
    try {
      const res = await grantPersonPermissions(nip, {
        subjectType,
        subjectValue: subjectValue.trim(),
        permissions: perms,
        description: description.trim(),
      });
      onAddNotification?.(
        language === 'pl' ? 'Uprawnienia nadane' : 'Permissions Granted',
        language === 'pl'
          ? `Wniosek przyjęty przez KSeF (nr ${res.referenceNumber}). Lista odświeży się po przetworzeniu.`
          : `Request accepted by KSeF (ref # ${res.referenceNumber}). The list will refresh after processing.`,
        'success'
      );
      // Reset the form and refresh after a short delay (grant is asynchronous in KSeF).
      setSubjectValue(''); setDescription('');
      setTimeout(loadPermissions, 1500);
    } catch (err) {
      onAddNotification?.(language === 'pl' ? 'Błąd nadania uprawnień' : 'Failed to Grant Permissions', err.message || (language === 'pl' ? 'Operacja nie powiodła się.' : 'Operation failed.'), 'error');
    } finally {
      setIsGranting(false);
    }
  };

  // Take a single permission away.
  const handleRevoke = async (permissionId) => {
    setRevokingId(permissionId);
    try {
      const res = await revokePermission(nip, permissionId);
      onAddNotification?.(
        language === 'pl' ? 'Uprawnienie cofnięte' : 'Permission Revoked',
        language === 'pl'
          ? `Wniosek o cofnięcie przyjęty (nr ${res.referenceNumber}).`
          : `Revocation request accepted (ref # ${res.referenceNumber}).`,
        'success'
      );
      setTimeout(loadPermissions, 1500);
    } catch (err) {
      onAddNotification?.(language === 'pl' ? 'Błąd cofania uprawnienia' : 'Failed to Revoke Permission', err.message || (language === 'pl' ? 'Operacja nie powiodła się.' : 'Operation failed.'), 'error');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 font-sans">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white rounded-xl p-2"><KeyRound size={18} /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{language === 'pl' ? 'Uprawnienia KSeF' : 'KSeF Permissions'}</h2>
            <p className="text-xs text-slate-500">{language === 'pl' ? 'Kto może działać w KSeF w imieniu Twojej firmy.' : 'Who is authorized to act in KSeF on behalf of your company.'}</p>
          </div>
        </div>
        <button onClick={loadPermissions} disabled={isLoading}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-707 font-semibold py-2 px-3 rounded-xl text-xs transition cursor-pointer disabled:opacity-60 font-sans">
          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {language === 'pl' ? 'Odśwież' : 'Refresh'}
        </button>
      </div>

      {/* Grant form — only useful to admins; the backend enforces this too. */}
      {isAdmin && (
        <form onSubmit={handleGrant} className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-4 font-sans text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <UserPlus size={15} /> {language === 'pl' ? 'Nadaj uprawnienia osobie' : 'Grant permissions to a person'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-650 space-y-1 block">
              <span>{language === 'pl' ? 'Typ identyfikatora' : 'Identifier Type'}</span>
              <select value={subjectType} onChange={(e) => setSubjectType(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm cursor-pointer">
                <option value="Nip">NIP</option>
                <option value="Pesel">PESEL</option>
                <option value="Fingerprint">{language === 'pl' ? 'Odcisk certyfikatu' : 'Certificate Fingerprint'}</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-655 space-y-1 sm:col-span-2 block">
              <span>{language === 'pl' ? 'Identyfikator osoby' : 'Person Identifier'}</span>
              <input value={subjectValue} onChange={(e) => setSubjectValue(e.target.value)}
                placeholder={subjectType === 'Pesel' ? '11 cyfr' : subjectType === 'Nip' ? '10 cyfr' : 'odcisk certyfikatu'}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-650">{language === 'pl' ? 'Uprawnienia' : 'Permissions'}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERMISSION_OPTIONS.map(opt => (
                <label key={opt.code} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-150 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={!!selected[opt.code]} onChange={() => toggle(opt.code)} className="accent-red-650" />
                  <span className="font-semibold">{getPermissionLabel(opt.code, language)}</span>
                  <span className="ml-auto font-mono text-[9px] text-slate-400">{opt.code}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="text-xs font-semibold text-slate-650 space-y-1 block">
            <span>{language === 'pl' ? 'Opis / powód (wymagany przez KSeF)' : 'Description / reason (required by KSeF)'}</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'pl' ? 'np. Księgowa — wystawianie i odbiór faktur' : 'e.g. Accountant — issue and receive invoices'}
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm" />
          </label>

          <div className="flex justify-end">
            <button type="submit" disabled={isGranting}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer">
              {isGranting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} {language === 'pl' ? 'Nadaj uprawnienia' : 'Grant Permissions'}
            </button>
          </div>
        </form>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-sans font-medium">{error}</div>}

      {/* Current permissions list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden font-sans">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> {language === 'pl' ? 'Wczytywanie uprawnień…' : 'Loading permissions…'}
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-14 px-6 space-y-2">
            <ShieldCheck size={26} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-500 font-bold">{language === 'pl' ? 'Brak nadanych uprawnień w tym kontekście.' : 'No granted permissions found in this context.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs align-middle">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px] border-b border-slate-100 font-semibold">
                <tr>
                  <th className="font-bold px-4 py-3">{language === 'pl' ? 'Uprawniony' : 'Authorized Subject'}</th>
                  <th className="font-bold px-4 py-3">{language === 'pl' ? 'Uprawnienie' : 'Permission Scope'}</th>
                  <th className="font-bold px-4 py-3">{language === 'pl' ? 'Opis' : 'Description'}</th>
                  <th className="font-bold px-4 py-3">{language === 'pl' ? 'Stan' : 'State'}</th>
                  {isAdmin && <th className="text-right font-bold px-4 py-3">{language === 'pl' ? 'Akcja' : 'Action'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {permissions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition cursor-pointer">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {p.authorizedIdentifier ? `${p.authorizedIdentifier.type}: ${p.authorizedIdentifier.value}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.permissionScope || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[260px] truncate" title={p.description}>{p.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.permissionState === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                       : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {p.permissionState || '—'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevoke(p.id)}
                          disabled={revokingId === p.id}
                          className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 hover:text-red-700 border border-slate-200 text-slate-707 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60">
                          {revokingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {language === 'pl' ? 'Cofnij' : 'Revoke'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
