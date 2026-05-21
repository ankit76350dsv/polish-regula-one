import React, { useState } from 'react';
import { Tenant, UserRole, Certificate } from '../types';
import { 
  ShieldCheck, 
  UploadCloud, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Key, 
  Eye, 
  Calendar,
  Lock
} from 'lucide-react';

interface CertificateManagerProps {
  tenant: Tenant;
  role: UserRole;
  certificates: Certificate[];
  onAddCertificate: (cert: Certificate) => void;
  onRemoveCertificate: (id: string) => void;
  onAddNotification: (title: string, message: string, type: 'info' | 'success' | 'warn' | 'error') => void;
}

export default function CertificateManager({ tenant, role, certificates, onAddCertificate, onRemoveCertificate, onAddNotification }: CertificateManagerProps) {
  const canModify = role === 'Super Admin' || role === 'Company Admin' || role === 'Accountant';
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [keyPassword, setKeyPassword] = useState('');

  // Settle active tenant certificates
  const tenantCerts = certificates.filter(c => c.tenantId === tenant.id);

  // Drag and drop mock
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Upload actions simulation
  const handleSimulatedUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) {
      onAddNotification('RBAC Access Denied', 'Your role has read-only access to corporate workspace compliance credentials.', 'error');
      return;
    }
    if (!selectedFile && !keyPassword) {
      alert("Introduce certificate file or key passcode.");
      return;
    }

    const newCert: Certificate = {
      id: `cert-gen-${Date.now()}`,
      tenantId: tenant.id,
      fileName: selectedFile ? selectedFile.name : 'uploaded_hsm_signature.pfx',
      type: selectedFile?.name.endsWith('.pem') ? 'PEM' : 'PFX',
      issuedTo: `${tenant.name} - Signed Payload Root`,
      issuer: 'Asseco Data Systems qualified QCA',
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2).toISOString().split('T')[0], // 2 years from now
      verificationStatus: 'VERIFIED',
      lastAuthTime: new Date().toISOString()
    };

    onAddCertificate(newCert);
    setSelectedFile(null);
    setKeyPassword('');
    onAddNotification(
      'Qualified Certificate Loaded', 
      `Certificate ${newCert.fileName} processed successfully. AES-256 secure hash generated and stored inside sandbox database.`, 
      'success'
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <ShieldCheck className="text-red-650" size={20} />
          Digital Certificate Management
        </h2>
        <p className="text-slate-400 text-xs mt-1">Manage encrypted qualified enterprise signatures (PFX/PEM) needed to validate outbound KSeF FA(3) ledger transmissions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Verification Loader (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b pb-3 border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Register Qualified Seal credentials</h3>
              <p className="text-slate-500 text-xs text-wrap leading-normal">
                Files undergo instant local compliance validation and AES-256 secure storage. Keys are never transmitted in unencrypted formats.
              </p>
            </div>

            <form onSubmit={handleSimulatedUpload} className="space-y-4 text-xs font-sans">
              {/* Drag and Drop Box */}
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
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-750">Drag &amp; drop your PFX/PEM file</p>
                      <p className="text-slate-400 mt-0.5">or click to browse local directory</p>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept=".pfx,.pem,.p12"
                    onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                    className="hidden" 
                    id="file-selector-cert"
                    disabled={!canModify}
                  />
                  <label 
                    htmlFor="file-selector-cert" 
                    className="mt-3 text-[11px] bg-slate-900 border border-transparent hover:bg-slate-850 text-white font-bold py-1 px-3 rounded-lg cursor-pointer transition"
                  >
                    Select File
                  </label>
                </div>
              </div>

              {/* Secure Password field */}
              <div className="space-y-1">
                <label className="text-slate-500 font-medium block">Certificate Decryption Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock size={12} />
                  </span>
                  <input 
                    type="password"
                    placeholder="Enter decryption password for PFX keystore..."
                    value={keyPassword}
                    onChange={(e) => setKeyPassword(e.target.value)}
                    disabled={!canModify}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={!canModify}
                  className="w-full bg-slate-900 text-white hover:bg-slate-800 font-bold py-2.5 px-4 rounded-xl text-center transition tracking-tight"
                >
                  Verify Key &amp; Cryptographically Seal Account
                </button>
              </div>
            </form>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-[11px] text-amber-900 flex gap-2 items-start mt-4">
            <AlertTriangle size={15} className="shrink-0 text-amber-700" />
            <p className="leading-relaxed font-sans">
              <strong>Certificate compliance notice</strong>: Production endpoints enforce strict qualified KIR certificates issued under EU eIDAS regulations. Let local administrators verify active directories.
            </p>
          </div>
        </div>

        {/* Existing active signature list (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="border-b pb-3 border-slate-100">
            <h3 className="font-semibold text-slate-700 text-sm">Active Workspace Authentication Keys</h3>
            <p className="text-slate-550 text-xs">Verify key timelines, issuer registries, and certificate verification statuses.</p>
          </div>

          <div className="space-y-4 font-sans text-xs">
            {tenantCerts.map((cert) => {
              const expiresDate = new Date(cert.validTo);
              const totalDays = Math.round((expiresDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              const isCrit = totalDays <= 30;

              return (
                <div key={cert.id} className="border border-slate-200 p-4 rounded-xl hover:border-red-300 transition space-y-3 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-50 text-red-750 rounded-lg">
                        <Key size={16} />
                      </div>
                      <div>
                        <h4 className="font-mono font-bold text-slate-800">{cert.fileName}</h4>
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
                      <span className="text-slate-400 block pb-0.5 uppercase tracking-wider text-[9px] font-bold">Encrypted Format</span>
                      <strong className="text-slate-600">{cert.type} Key</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block pb-0.5 uppercase tracking-wider text-[9px] font-bold">Expiry Date</span>
                      <strong className="text-slate-600">{cert.validTo}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block pb-0.5 uppercase tracking-wider text-[9px] font-bold">Status Timer</span>
                      <strong className={isCrit ? 'text-red-750 font-bold' : 'text-emerald-700 font-semibold'}>
                        {totalDays} days left
                      </strong>
                    </div>
                  </div>

                  <div className="bg-slate-50 text-[10px] text-slate-500 p-2 rounded-lg flex justify-between items-center">
                    <span>Last local authentication attempt: <strong className="font-mono text-slate-500">{cert.lastAuthTime || "Never"}</strong></span>
                    {tenantCerts.length > 1 && (
                      <button 
                        onClick={() => {
                          if (canModify) {
                            onRemoveCertificate(cert.id);
                            onAddNotification('Certificate Revoked', 'The digital signature was successfully scrubbed from corporate keystore.', 'info');
                          } else {
                            onAddNotification('RBAC Permission Denied', 'Role Accountant / Admin is required to remove certificates.', 'error');
                          }
                        }}
                        className="text-slate-400 hover:text-red-650 p-1 rounded transition ml-2"
                        title="Scrub Certificate from HSM Keystore"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {tenantCerts.length === 0 && (
              <div className="text-center py-12 text-slate-400 px-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex flex-col justify-center items-center h-48">
                <ShieldCheck size={28} className="text-slate-300 mb-2" />
                <p>No qualified workspace secrets configured for {tenant.name}. Create and seed cryptographic certificates using the registration console.</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
