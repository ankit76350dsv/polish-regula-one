import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, UploadCloud, BadgePlus, PowerOff, Lock, Loader2, XCircle, Download } from 'lucide-react';
import { uploadCertificate, listCertificates, deactivateCertificate, enrollCertificate, getCertificatePublicPem } from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../lib/permissions';

// ── Certificates ──────────────────────────────────────────────────────────────
// Business-facing screen to manage the certificates used for KSeF authentication and
// invoice signing. Deliberately plain and concise (banking/government-portal feel):
// only the fields a user needs, simple wording, no unverifiable security claims.

export default function CertificateManager({ tenant, permissions, onAddNotification }) {
  const { language } = useLanguage();
  const T = (en, pl) => (language === 'pl' ? pl : en);

  // Uploading / requesting / deactivating are admin-only (matches the backend guard).
  const canModify = can.manageCertificates(permissions);

  // Upload form
  const [selectedFile, setSelectedFile] = useState(null);
  const [keyPassword, setKeyPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Request-from-KSeF form
  const [enrollName, setEnrollName] = useState('');
  const [enrollPurpose, setEnrollPurpose] = useState('AUTHENTICATION');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  // List
  const [certs, setCerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Deactivate confirmation
  const [confirmCert, setConfirmCert] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Public-certificate download
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchCerts = useCallback(async () => {
    if (!tenant?.id) return;
    setIsLoading(true);
    setLoadError('');
    try {
      setCerts(await listCertificates(tenant.id));
    } catch (err) {
      setLoadError(err.message ?? T('Could not load certificates.', 'Nie udało się wczytać certyfikatów.'));
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  // ── Derived status for the table ──────────────────────────────────────────────
  const statusOf = (cert) => {
    const daysLeft = Math.round((new Date(cert.validTo) - Date.now()) / 86_400_000);
    if (daysLeft < 0) return { key: 'EXPIRED', label: T('Expired', 'Wygasł'), cls: 'bg-rose-50 text-rose-700 border-rose-200', daysLeft };
    if (!cert.active) return { key: 'REVOKED', label: T('Revoked', 'Wycofany'), cls: 'bg-slate-100 text-slate-600 border-slate-200', daysLeft };
    if (cert.verificationStatus === 'PENDING') return { key: 'PENDING', label: T('Pending verification', 'Oczekuje na weryfikację'), cls: 'bg-amber-50 text-amber-700 border-amber-200', daysLeft };
    return { key: 'ACTIVE', label: T('Active', 'Aktywny'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', daysLeft };
  };

  const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');
  const fmtDateTime = (d) => (d ? String(d).replace('T', ' ').slice(0, 16) : T('Never', 'Nigdy'));

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    setUploadError('');
    if (!selectedFile) { setUploadError(T('Please choose a certificate file.', 'Wybierz plik certyfikatu.')); return; }
    const isPfx = /\.(pfx|p12)$/i.test(selectedFile.name);
    if (isPfx && !keyPassword.trim()) {
      setUploadError(T('A password is required for PFX files.', 'Hasło jest wymagane dla plików PFX.'));
      return;
    }
    setIsUploading(true);
    try {
      const cert = await uploadCertificate(tenant.id, selectedFile, keyPassword || undefined);
      setSelectedFile(null);
      setKeyPassword('');
      onAddNotification(
        T('Certificate uploaded', 'Certyfikat przesłany'),
        T(`${cert.fileName} was uploaded.`, `Przesłano ${cert.fileName}.`),
        'success',
      );
      fetchCerts();
    } catch (err) {
      const msg = err.message ?? T('Upload failed. Check the file and password.', 'Przesyłanie nie powiodło się. Sprawdź plik i hasło.');
      setUploadError(msg);
      onAddNotification(T('Upload failed', 'Przesyłanie nie powiodło się'), msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    setEnrollError('');
    if (!tenant?.nip) { setEnrollError(T('Your organisation has no NIP set.', 'Twoja organizacja nie ma ustawionego numeru NIP.')); return; }
    if (!enrollName.trim()) { setEnrollError(T('Please enter a certificate name.', 'Podaj nazwę certyfikatu.')); return; }
    setIsEnrolling(true);
    try {
      const cert = await enrollCertificate(tenant.nip, enrollPurpose, enrollName.trim());
      setEnrollName('');
      onAddNotification(
        T('Certificate requested', 'Wystąpiono o certyfikat'),
        T(`${cert.fileName} was issued by KSeF.`, `${cert.fileName} został wydany przez KSeF.`),
        'success',
      );
      fetchCerts();
    } catch (err) {
      const msg = err.message ?? T('Could not request a certificate from KSeF.', 'Nie udało się wystąpić o certyfikat z KSeF.');
      setEnrollError(msg);
      onAddNotification(T('Request failed', 'Żądanie nie powiodło się'), msg, 'error');
    } finally {
      setIsEnrolling(false);
    }
  };

  const confirmDeactivate = async () => {
    const cert = confirmCert;
    if (!cert) return;
    setIsDeactivating(true);
    try {
      await deactivateCertificate(tenant.id, cert.id);
      onAddNotification(
        T('Certificate deactivated', 'Certyfikat dezaktywowany'),
        T(`${cert.fileName} was deactivated.`, `${cert.fileName} został dezaktywowany.`),
        'info',
      );
      setConfirmCert(null);
      fetchCerts();
    } catch (err) {
      onAddNotification(
        T('Could not deactivate', 'Nie udało się dezaktywować'),
        err.message ?? T('Please try again.', 'Spróbuj ponownie.'),
        'error',
      );
    } finally {
      setIsDeactivating(false);
    }
  };

  // Download the PUBLIC certificate (no private key) as a .cer file.
  const handleDownload = async (cert) => {
    setDownloadingId(cert.id);
    try {
      const pem = await getCertificatePublicPem(cert.id);
      const blob = new Blob([pem], { type: 'application/x-pem-file' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(cert.fileName || 'certificate').replace(/\.(pfx|p12|pem|crt)$/i, '')}.cer`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onAddNotification(
        T('Download failed', 'Pobieranie nie powiodło się'),
        err.message ?? T('Could not download the certificate.', 'Nie udało się pobrać certyfikatu.'),
        'error',
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20';

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <ShieldCheck className="text-red-650" size={20} />
          {T('Certificates', 'Certyfikaty')}
        </h2>
        <p className="text-slate-500 text-xs mt-1">
          {T('Manage certificates used for KSeF authentication and invoice signing.',
             'Zarządzaj certyfikatami używanymi do uwierzytelniania w KSeF i podpisywania faktur.')}
        </p>
      </div>

      {!canModify && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {T('You have read-only access. Contact an administrator to add or change certificates.',
             'Masz dostęp tylko do odczytu. Skontaktuj się z administratorem, aby dodać lub zmienić certyfikaty.')}
        </p>
      )}

      {/* Two action cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <h3 className="font-semibold text-slate-800 text-sm">{T('Upload Certificate', 'Prześlij certyfikat')}</h3>
          <p className="text-slate-500 text-xs mt-0.5 mb-4">
            {T('Upload a certificate file to authenticate with KSeF.', 'Prześlij plik certyfikatu, aby uwierzytelnić się w KSeF.')}
          </p>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                {T('Certificate file', 'Plik certyfikatu')} <span className="text-slate-400">(PFX / PEM)</span>
              </label>
              <label
                htmlFor="cert-file-input"
                className={`flex items-center gap-3 border border-dashed rounded-lg px-3 py-2.5 cursor-pointer transition ${
                  canModify ? 'border-slate-300 hover:border-red-400' : 'border-slate-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <UploadCloud size={18} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600 truncate">
                  {selectedFile ? selectedFile.name : T('Choose a file…', 'Wybierz plik…')}
                </span>
              </label>
              <input
                id="cert-file-input"
                type="file"
                accept=".pfx,.p12,.pem,.crt"
                disabled={!canModify || isUploading}
                onChange={(e) => { if (e.target.files?.[0]) { setSelectedFile(e.target.files[0]); setUploadError(''); } }}
                className="hidden"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                {T('Certificate password', 'Hasło certyfikatu')}{' '}
                <span className="text-slate-400">{T('(required for PFX)', '(wymagane dla PFX)')}</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Lock size={13} /></span>
                <input
                  type="password"
                  value={keyPassword}
                  onChange={(e) => { setKeyPassword(e.target.value); setUploadError(''); }}
                  disabled={!canModify || isUploading}
                  className={`${inputCls} pl-9`}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs">
                <XCircle size={13} className="shrink-0" /><span>{uploadError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canModify || isUploading}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? <><Loader2 size={14} className="animate-spin" /> {T('Uploading…', 'Przesyłanie…')}</> : T('Upload Certificate', 'Prześlij certyfikat')}
            </button>
          </form>
        </div>

        {/* Request from KSeF */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <BadgePlus size={15} className="text-red-650" /> {T('Request Certificate from KSeF', 'Wystąp o certyfikat z KSeF')}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5 mb-4">
            {T('Generate a key pair and request a certificate directly from KSeF.',
               'Wygeneruj parę kluczy i wystąp o certyfikat bezpośrednio z KSeF.')}
          </p>

          <form onSubmit={handleEnroll} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">{T('Certificate name', 'Nazwa certyfikatu')}</label>
              <input
                type="text"
                value={enrollName}
                onChange={(e) => { setEnrollName(e.target.value); setEnrollError(''); }}
                disabled={!canModify || isEnrolling}
                className={inputCls}
                placeholder={T('e.g. Main authentication certificate', 'np. Główny certyfikat uwierzytelniający')}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">{T('Certificate type', 'Typ certyfikatu')}</label>
              <select
                value={enrollPurpose}
                onChange={(e) => setEnrollPurpose(e.target.value)}
                disabled={!canModify || isEnrolling}
                className={inputCls}
              >
                <option value="AUTHENTICATION">{T('Authentication certificate', 'Certyfikat uwierzytelniający')}</option>
                <option value="OFFLINE">{T('Offline signing certificate', 'Certyfikat do podpisu offline')}</option>
              </select>
            </div>

            {enrollError && (
              <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs">
                <XCircle size={13} className="shrink-0" /><span>{enrollError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canModify || isEnrolling}
              className="w-full bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isEnrolling ? <><Loader2 size={14} className="animate-spin" /> {T('Requesting…', 'Wysyłanie żądania…')}</> : T('Request Certificate', 'Wystąp o certyfikat')}
            </button>
          </form>
        </div>
      </div>

      {/* Active certificates table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">{T('Active Certificates', 'Certyfikaty')}</h3>
          {isLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </div>

        {loadError && (
          <div className="m-6 flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs">
            <XCircle size={13} className="shrink-0" />{loadError}
          </div>
        )}

        {!isLoading && certs.length === 0 && !loadError ? (
          <div className="px-6 py-16 flex flex-col items-center gap-2 text-slate-400">
            <ShieldCheck size={30} className="text-slate-200" />
            <p className="text-sm font-medium text-slate-500">{T('No certificates yet', 'Brak certyfikatów')}</p>
            <p className="text-xs">{T('Upload a file or request one from KSeF above.', 'Prześlij plik lub wystąp o certyfikat z KSeF powyżej.')}</p>
          </div>
        ) : certs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-6 py-3 font-bold">{T('Name', 'Nazwa')}</th>
                  <th className="px-3 py-3 font-bold">{T('Status', 'Status')}</th>
                  <th className="px-3 py-3 font-bold">{T('Subject', 'Podmiot')}</th>
                  <th className="px-3 py-3 font-bold">{T('Type', 'Typ')}</th>
                  <th className="px-3 py-3 font-bold">{T('Expiry date', 'Data ważności')}</th>
                  <th className="px-3 py-3 font-bold">{T('Days left', 'Pozostało dni')}</th>
                  <th className="px-3 py-3 font-bold">{T('Last used', 'Ostatnio użyty')}</th>
                  <th className="px-6 py-3 font-bold text-right">{T('Actions', 'Akcje')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {certs.map((cert) => {
                  const s = statusOf(cert);
                  return (
                    <tr key={cert.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-semibold text-slate-700 break-all max-w-[200px]">{cert.fileName}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 truncate max-w-[160px]" title={cert.issuedTo}>{cert.issuedTo || '—'}</td>
                      <td className="px-3 py-3 text-slate-600 font-mono">{cert.type}</td>
                      <td className="px-3 py-3 text-slate-600 font-mono">{fmtDate(cert.validTo)}</td>
                      <td className="px-3 py-3">
                        <span className={s.daysLeft < 0 ? 'text-rose-600 font-semibold' : s.daysLeft <= 30 ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                          {s.daysLeft < 0 ? T('Expired', 'Wygasł') : s.daysLeft}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-500 font-mono text-xs">{fmtDateTime(cert.lastAuthTime)}</td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          <button
                            onClick={() => handleDownload(cert)}
                            disabled={downloadingId === cert.id}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-800 transition disabled:opacity-50"
                            title={T('Download public certificate', 'Pobierz certyfikat publiczny')}
                          >
                            {downloadingId === cert.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                            {T('Download', 'Pobierz')}
                          </button>
                          {canModify && cert.active && s.key !== 'EXPIRED' && (
                            <button
                              onClick={() => setConfirmCert(cert)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-600 transition"
                              title={T('Deactivate', 'Dezaktywuj')}
                            >
                              <PowerOff size={13} /> {T('Deactivate', 'Dezaktywuj')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deactivate confirmation */}
      {confirmCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => !isDeactivating && setConfirmCert(null)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0"><PowerOff size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base tracking-tight">{T('Deactivate certificate', 'Dezaktywować certyfikat?')}</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  {T(`"${confirmCert.fileName}" will no longer be used for KSeF. You can upload or request a new one at any time.`,
                     `„${confirmCert.fileName}” nie będzie już używany w KSeF. W każdej chwili możesz przesłać lub wystąpić o nowy.`)}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmCert(null)} disabled={isDeactivating} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50">
                {T('Cancel', 'Anuluj')}
              </button>
              <button onClick={confirmDeactivate} disabled={isDeactivating} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition flex items-center gap-2 disabled:opacity-50">
                {isDeactivating ? <><Loader2 size={13} className="animate-spin" /> {T('Deactivating…', 'Dezaktywacja…')}</> : <><PowerOff size={13} /> {T('Deactivate', 'Dezaktywuj')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
