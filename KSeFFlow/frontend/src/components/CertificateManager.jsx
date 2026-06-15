import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UploadCloud,
  PowerOff,
  AlertTriangle,
  Key,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  BadgePlus,
} from 'lucide-react';
import { uploadCertificate, listCertificates, deactivateCertificate, enrollCertificate } from '../api/ksefApi';

export default function CertificateManager({ tenant, role, onAddNotification }) {
  const canModify = role === 'Super Admin' || role === 'Company Admin' || role === 'Accountant';

  // ── Form state ────────────────────────────────────────────────────────────────
  const [dragActive,    setDragActive]    = useState(false);
  const [selectedFile,  setSelectedFile]  = useState(null);
  const [keyPassword,   setKeyPassword]   = useState('');
  const [isUploading,   setIsUploading]   = useState(false);
  const [uploadError,   setUploadError]   = useState('');

  // ── Certificate list state ────────────────────────────────────────────────────
  const [certs,         setCerts]         = useState([]);
  const [isLoading,     setIsLoading]     = useState(false);
  const [loadError,     setLoadError]     = useState('');

  // ── Deactivation confirmation state ───────────────────────────────────────────
  const [confirmCert,     setConfirmCert]     = useState(null);
  const [isDeactivating,  setIsDeactivating]  = useState(false);

  // ── KSeF certificate enrollment state (C3) ────────────────────────────────────
  // Instead of uploading a file, the backend can ask KSeF to ISSUE a certificate for us.
  const [enrollName,    setEnrollName]    = useState('');
  const [enrollPurpose, setEnrollPurpose] = useState('AUTHENTICATION');
  const [isEnrolling,   setIsEnrolling]   = useState(false);
  const [enrollError,   setEnrollError]   = useState('');

  // ── Load certificates from backend on mount / when tenant changes ─────────────
  const fetchCerts = useCallback(async () => {
    if (!tenant?.id) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await listCertificates(tenant.id);
      setCerts(data);
    } catch (err) {
      setLoadError(err.message ?? 'Failed to load certificates');
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  // ── Drag & drop ───────────────────────────────────────────────────────────────
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setSelectedFile(file); setUploadError(''); }
  };

  // ── Upload ─────────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    setUploadError('');

    if (!canModify) {
      onAddNotification('RBAC Access Denied', 'Your role does not have permission to upload certificates.', 'error');
      return;
    }
    if (!selectedFile) {
      setUploadError('Please select a .pfx or .pem file.');
      return;
    }

    const isPfx = selectedFile.name.endsWith('.pfx') || selectedFile.name.endsWith('.p12');
    if (isPfx && !keyPassword.trim()) {
      setUploadError('A password is required for PFX files.');
      return;
    }

    setIsUploading(true);
    try {
      const cert = await uploadCertificate(
        tenant.id,
        selectedFile,
        keyPassword || undefined,
      );

      // Prepend the new cert and mark previous ones inactive in local state
      setCerts(prev => [cert, ...prev.map(c => ({ ...c, active: false }))]);
      setSelectedFile(null);
      setKeyPassword('');
      onAddNotification(
        'Certificate Uploaded',
        `${cert.fileName} uploaded and encrypted successfully. Valid until ${cert.validTo}.`,
        'success',
      );
    } catch (err) {
      const msg = err.message ?? 'Upload failed. Check the file and password.';
      setUploadError(msg);
      onAddNotification('Upload Failed', msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // ── Enroll a KSeF-issued certificate ───────────────────────────────────────────
  // The backend generates the key pair, asks KSeF to issue the certificate, and stores it
  // encrypted. We only need the tenant NIP (sent as the auth context), a friendly name, and
  // the purpose (AUTHENTICATION to log in, OFFLINE to seal offline-invoice QR codes).
  const handleEnroll = async (e) => {
    e.preventDefault();
    setEnrollError('');

    if (!canModify) {
      onAddNotification('RBAC Access Denied', 'Your role does not have permission to enroll certificates.', 'error');
      return;
    }
    if (!tenant?.nip) {
      setEnrollError('Brak numeru NIP organizacji — nie można wystąpić o certyfikat KSeF.');
      return;
    }
    if (!enrollName.trim()) {
      setEnrollError('Podaj nazwę certyfikatu.');
      return;
    }

    setIsEnrolling(true);
    try {
      const cert = await enrollCertificate(tenant.nip, enrollPurpose, enrollName.trim());
      // A new active cert of this purpose replaces the previous active one of the SAME purpose.
      setCerts(prev => [cert, ...prev]);
      setEnrollName('');
      onAddNotification(
        'Certyfikat KSeF wydany',
        `${cert.fileName} został wydany przez KSeF i zaszyfrowany. Ważny do ${cert.validTo}.`,
        'success',
      );
      fetchCerts();
    } catch (err) {
      const msg = err.message ?? 'Wydanie certyfikatu KSeF nie powiodło się.';
      setEnrollError(msg);
      onAddNotification('Enrollment Failed', msg, 'error');
    } finally {
      setIsEnrolling(false);
    }
  };

  // ── Deactivate ─────────────────────────────────────────────────────────────────
  const requestDeactivate = (cert) => {
    if (!canModify) {
      onAddNotification('RBAC Permission Denied', 'Admin role is required to deactivate certificates.', 'error');
      return;
    }
    setConfirmCert(cert);
  };

  const confirmDeactivate = async () => {
    const cert = confirmCert;
    if (!cert) return;
    setIsDeactivating(true);
    try {
      await deactivateCertificate(tenant.id, cert.id);
      setCerts(prev => prev.map(c => c.id === cert.id ? { ...c, active: false } : c));
      onAddNotification('Certificate Deactivated', `${cert.fileName} has been deactivated.`, 'info');
      setConfirmCert(null);
    } catch (err) {
      onAddNotification('Deactivation Failed', err.message ?? 'Could not deactivate certificate.', 'error');
    } finally {
      setIsDeactivating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <ShieldCheck className="text-red-650" size={20} />
          Digital Certificate Management
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          Manage encrypted qualified enterprise signatures (PFX/PEM) needed to validate outbound KSeF FA(3) ledger transmissions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Upload panel ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-5 lg:self-start bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col">
          <div className="space-y-4">
            <div className="border-b pb-3 border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Register Qualified Seal Credentials</h3>
              <p className="text-slate-500 text-xs leading-normal">
                Files are AES-256-GCM encrypted before storage. Private keys never leave the server unencrypted.
              </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4 text-xs font-sans">

              {/* File drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
                  dragActive ? 'border-red-500 bg-red-50/50' : 'border-slate-200 hover:border-red-500'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center">
                  <UploadCloud size={32} className="text-slate-400 mb-2" />
                  {selectedFile ? (
                    <div className="font-semibold text-slate-800 font-mono text-wrap break-all px-2">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-750">Drag &amp; drop your PFX / PEM file</p>
                      <p className="text-slate-400 mt-0.5">or click to browse</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pfx,.pem,.p12,.crt"
                    id="cert-file-input"
                    disabled={!canModify || isUploading}
                    onChange={e => {
                      if (e.target.files?.[0]) { setSelectedFile(e.target.files[0]); setUploadError(''); }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="cert-file-input"
                    className="mt-3 text-[11px] bg-slate-900 border border-transparent hover:bg-slate-850 text-white font-bold py-1 px-3 rounded-lg cursor-pointer transition"
                  >
                    Select File
                  </label>
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1">
                <label className="text-slate-500 font-medium block">
                  Certificate Password
                  <span className="text-slate-400 ml-1">(required for PFX, leave blank for PEM)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock size={12} />
                  </span>
                  <input
                    type="password"
                    placeholder="PFX keystore password..."
                    value={keyPassword}
                    onChange={e => { setKeyPassword(e.target.value); setUploadError(''); }}
                    disabled={!canModify || isUploading}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50 font-mono"
                  />
                </div>
              </div>

              {/* Inline error */}
              {uploadError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <XCircle size={13} className="shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Submit button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={!canModify || isUploading}
                  className="w-full bg-slate-900 text-white hover:bg-slate-800 font-bold py-2.5 px-4 rounded-xl text-center transition tracking-tight flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <><Loader2 size={14} className="animate-spin" /> Encrypting &amp; Storing…</>
                  ) : (
                    'Verify Key &amp; Cryptographically Seal Account'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-[11px] text-amber-900 flex gap-2 items-start mt-4">
            <AlertTriangle size={15} className="shrink-0 text-amber-700" />
            <p className="leading-relaxed font-sans">
              <strong>Certificate compliance notice:</strong> Production endpoints enforce strict qualified KIR certificates issued under EU eIDAS regulations.
            </p>
          </div>

          {/* ── Enroll a KSeF-issued certificate (Certyfikat KSeF) ─────────────── */}
          <div className="mt-5 border-t border-slate-100 pt-5 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <BadgePlus size={15} className="text-red-650" /> Wystąp o certyfikat KSeF
              </h3>
              <p className="text-slate-500 text-xs leading-normal mt-1">
                Zamiast wgrywać plik, system wygeneruje klucz i poprosi KSeF o wydanie certyfikatu
                (typ <strong>Uwierzytelnianie</strong> — logowanie, lub <strong>Offline</strong> — pieczętowanie faktur offline).
              </p>
            </div>

            <form onSubmit={handleEnroll} className="space-y-3 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-slate-500 font-medium block">Nazwa certyfikatu</label>
                <input
                  type="text"
                  placeholder="np. Certyfikat firmowy 2026"
                  value={enrollName}
                  onChange={e => { setEnrollName(e.target.value); setEnrollError(''); }}
                  disabled={!canModify || isEnrolling}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-medium block">Typ certyfikatu</label>
                <select
                  value={enrollPurpose}
                  onChange={e => setEnrollPurpose(e.target.value)}
                  disabled={!canModify || isEnrolling}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50"
                >
                  <option value="AUTHENTICATION">Uwierzytelnianie (logowanie do KSeF)</option>
                  <option value="OFFLINE">Offline (pieczęć faktur w trybie offline)</option>
                </select>
              </div>

              {enrollError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <XCircle size={13} className="shrink-0" /><span>{enrollError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canModify || isEnrolling}
                className="w-full bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-bold py-2.5 px-4 rounded-xl text-center transition tracking-tight flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isEnrolling
                  ? <><Loader2 size={14} className="animate-spin" /> Wydawanie certyfikatu…</>
                  : <><BadgePlus size={14} /> Wystąp o certyfikat KSeF</>}
              </button>
            </form>
          </div>
        </div>

        {/* ── Certificate list panel ───────────────────────────────────────────── */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-700 text-sm">Active Workspace Authentication Keys</h3>
              <p className="text-slate-550 text-xs">Verify key timelines, issuer registries, and certificate verification statuses.</p>
            </div>
            {isLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>

          {/* Load error */}
          {loadError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
              <XCircle size={13} className="shrink-0" />
              {loadError}
            </div>
          )}

          <div className="space-y-4 font-sans text-xs">
            {certs.map((cert) => {
              const expiresDate = new Date(cert.validTo);
              const totalDays   = Math.round((expiresDate - Date.now()) / 86_400_000);
              const isCrit      = totalDays <= 30;

              return (
                <div
                  key={cert.id}
                  className={`border p-4 rounded-xl transition space-y-3 shadow-xs ${
                    cert.active ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-50 text-red-750 rounded-lg">
                        <Key size={16} />
                      </div>
                      <div>
                        <h4 className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                          {cert.fileName}
                          {cert.active && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                              <CheckCircle2 size={9} /> Active
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-400">{cert.issuer}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-50 text-emerald-800">
                      {cert.verificationStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] border-t pt-3 border-slate-100">
                    <div>
                      <span className="text-slate-400 block pb-0.5 uppercase tracking-wider text-[9px] font-bold">Issued To</span>
                      <strong className="text-slate-600 truncate max-w-[120px] block">{cert.issuedTo}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block pb-0.5 uppercase tracking-wider text-[9px] font-bold">Format</span>
                      <strong className="text-slate-600">{cert.type}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block pb-0.5 uppercase tracking-wider text-[9px] font-bold">Expiry</span>
                      <strong className="text-slate-600">{cert.validTo}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block pb-0.5 uppercase tracking-wider text-[9px] font-bold">Time Left</span>
                      <strong className={isCrit ? 'text-red-600 font-bold' : 'text-emerald-700 font-semibold'}>
                        {totalDays > 0 ? `${totalDays} days` : 'EXPIRED'}
                      </strong>
                    </div>
                  </div>

                  <div className="bg-slate-50 text-[10px] text-slate-500 p-2 rounded-lg flex justify-between items-center">
                    <span>
                      Last auth: <strong className="font-mono">{cert.lastAuthTime ?? 'Never'}</strong>
                      {' · '}
                      Success: <strong>{cert.authSuccessCount}</strong>
                      {' · '}
                      Failed: <strong className={cert.authFailureCount > 0 ? 'text-red-600' : ''}>{cert.authFailureCount}</strong>
                    </span>
                    {cert.active && (
                      <button
                        onClick={() => requestDeactivate(cert)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition ml-2"
                        title="Deactivate certificate"
                      >
                        <PowerOff size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!isLoading && certs.length === 0 && !loadError && (
              <div className="text-center py-12 text-slate-400 px-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex flex-col justify-center items-center h-48">
                <ShieldCheck size={28} className="text-slate-300 mb-2" />
                <p>No certificates found for {tenant.name}. Upload a PFX or PEM file using the panel on the left.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Deactivation confirmation modal ──────────────────────────────────── */}
      {confirmCert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4"
          onClick={() => !isDeactivating && setConfirmCert(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-xl shrink-0">
                <PowerOff size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base tracking-tight">Deactivate certificate?</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Do you really want to deactivate{' '}
                  <strong className="font-mono text-slate-700 break-all">{confirmCert.fileName}</strong>?
                  It will no longer be used to sign outbound KSeF transmissions. This action can be reverted by uploading the certificate again.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmCert(null)}
                disabled={isDeactivating}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                disabled={isDeactivating}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                {isDeactivating ? (
                  <><Loader2 size={13} className="animate-spin" /> Deactivating…</>
                ) : (
                  <><PowerOff size={13} /> Deactivate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
