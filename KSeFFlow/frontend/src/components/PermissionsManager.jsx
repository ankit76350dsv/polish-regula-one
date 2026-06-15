import { useState, useEffect, useCallback } from 'react';
import { KeyRound, UserPlus, Trash2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  queryPersonPermissions,
  grantPersonPermissions,
  revokePermission,
} from '../api/ksefApi';

// ── KSeF permissions (uprawnienia) ────────────────────────────────────────────
// SIMPLE EXPLANATION:
// In KSeF the company owner can let other people act for the company — e.g. an employee who
// issues invoices, or an accounting office. This screen lists who currently has which rights
// and lets an admin grant a new right or take one away. Grants/revokes are admin-only and the
// backend also enforces that (this UI just guides the user). The tenant's own NIP is the
// context the rights are granted within.

// The KSeF person-permission codes, with simple Polish labels for the checkboxes.
const PERMISSION_OPTIONS = [
  { code: 'InvoiceWrite',         label: 'Wystawianie faktur' },
  { code: 'InvoiceRead',          label: 'Przeglądanie / odbieranie faktur' },
  { code: 'CredentialsManage',    label: 'Zarządzanie uprawnieniami' },
  { code: 'CredentialsRead',      label: 'Podgląd uprawnień' },
  { code: 'Introspection',        label: 'Introspekcja (podgląd sesji)' },
  { code: 'SubunitManage',        label: 'Zarządzanie podmiotami podrzędnymi' },
  { code: 'EnforcementOperations',label: 'Operacje egzekucyjne' },
];

export default function PermissionsManager({ tenant, role, onAddNotification }) {
  const nip = tenant?.nip || '';
  const isAdmin = role === 'Company Admin' || role === 'Super Admin';

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
    if (!nip) { setError('Brak numeru NIP organizacji — nie można odczytać uprawnień.'); return; }
    setIsLoading(true);
    setError(null);
    queryPersonPermissions(nip, { queryType: 'PermissionsGrantedInCurrentContext' }, { pageSize: 100 })
      .then(res => setPermissions(res.permissions))
      .catch(err => setError(err.message || 'Nie udało się odczytać uprawnień.'))
      .finally(() => setIsLoading(false));
  }, [nip]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const toggle = (code) => setSelected(prev => ({ ...prev, [code]: !prev[code] }));

  // Validate the form, then ask the backend to grant the chosen permissions.
  const handleGrant = async (e) => {
    e.preventDefault();
    const perms = Object.keys(selected).filter(c => selected[c]);
    if (!subjectValue.trim())      { onAddNotification?.('Błąd', 'Podaj identyfikator osoby (NIP/PESEL).', 'error'); return; }
    if (perms.length === 0)        { onAddNotification?.('Błąd', 'Wybierz co najmniej jedno uprawnienie.', 'error'); return; }
    if (!description.trim())       { onAddNotification?.('Błąd', 'Podaj opis (powód nadania uprawnień).', 'error'); return; }

    setIsGranting(true);
    try {
      const res = await grantPersonPermissions(nip, {
        subjectType,
        subjectValue: subjectValue.trim(),
        permissions: perms,
        description: description.trim(),
      });
      onAddNotification?.('Uprawnienia nadane',
        `Wniosek przyjęty przez KSeF (nr ${res.referenceNumber}). Lista odświeży się po przetworzeniu.`, 'success');
      // Reset the form and refresh after a short delay (grant is asynchronous in KSeF).
      setSubjectValue(''); setDescription('');
      setTimeout(loadPermissions, 1500);
    } catch (err) {
      onAddNotification?.('Błąd nadania uprawnień', err.message || 'Operacja nie powiodła się.', 'error');
    } finally {
      setIsGranting(false);
    }
  };

  // Take a single permission away.
  const handleRevoke = async (permissionId) => {
    setRevokingId(permissionId);
    try {
      const res = await revokePermission(nip, permissionId);
      onAddNotification?.('Uprawnienie cofnięte',
        `Wniosek o cofnięcie przyjęty (nr ${res.referenceNumber}).`, 'success');
      setTimeout(loadPermissions, 1500);
    } catch (err) {
      onAddNotification?.('Błąd cofania uprawnienia', err.message || 'Operacja nie powiodła się.', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white rounded-xl p-2"><KeyRound size={18} /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Uprawnienia KSeF</h2>
            <p className="text-xs text-slate-500">Kto może działać w KSeF w imieniu Twojej firmy.</p>
          </div>
        </div>
        <button onClick={loadPermissions} disabled={isLoading}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-xl text-xs transition cursor-pointer disabled:opacity-60">
          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Odśwież
        </button>
      </div>

      {/* Grant form — only useful to admins; the backend enforces this too. */}
      {isAdmin && (
        <form onSubmit={handleGrant} className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <UserPlus size={15} /> Nadaj uprawnienia osobie
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              <span>Typ identyfikatora</span>
              <select value={subjectType} onChange={(e) => setSubjectType(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm">
                <option value="Nip">NIP</option>
                <option value="Pesel">PESEL</option>
                <option value="Fingerprint">Odcisk certyfikatu</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1 sm:col-span-2">
              <span>Identyfikator osoby</span>
              <input value={subjectValue} onChange={(e) => setSubjectValue(e.target.value)}
                placeholder={subjectType === 'Pesel' ? '11 cyfr' : subjectType === 'Nip' ? '10 cyfr' : 'odcisk certyfikatu'}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-600">Uprawnienia</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERMISSION_OPTIONS.map(opt => (
                <label key={opt.code} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-150 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={!!selected[opt.code]} onChange={() => toggle(opt.code)} className="accent-red-600" />
                  <span className="font-medium">{opt.label}</span>
                  <span className="ml-auto font-mono text-[9px] text-slate-400">{opt.code}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="text-xs font-semibold text-slate-600 space-y-1 block">
            <span>Opis / powód (wymagany przez KSeF)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="np. Księgowa — wystawianie i odbiór faktur"
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm" />
          </label>

          <div className="flex justify-end">
            <button type="submit" disabled={isGranting}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer">
              {isGranting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Nadaj uprawnienia
            </button>
          </div>
        </form>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>}

      {/* Current permissions list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Wczytywanie uprawnień…
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-14 px-6 space-y-2">
            <ShieldCheck size={26} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-500">Brak nadanych uprawnień w tym kontekście.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                <tr>
                  <th className="text-left font-bold px-4 py-3">Uprawniony</th>
                  <th className="text-left font-bold px-4 py-3">Uprawnienie</th>
                  <th className="text-left font-bold px-4 py-3">Opis</th>
                  <th className="text-left font-bold px-4 py-3">Stan</th>
                  {isAdmin && <th className="text-right font-bold px-4 py-3">Akcja</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {p.authorizedIdentifier ? `${p.authorizedIdentifier.type}: ${p.authorizedIdentifier.value}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{p.permissionScope || '—'}</td>
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
                          className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 hover:text-red-700 border border-slate-200 text-slate-600 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60">
                          {revokingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Cofnij
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
