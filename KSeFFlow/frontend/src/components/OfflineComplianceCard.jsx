import { useEffect, useState } from 'react';
import { Download, ShieldCheck, FileWarning, Clock } from 'lucide-react';
import { qrDataUrl, openInvoicePrint } from '../lib/offlineInvoice';

// Shows the KSeF offline-compliance state of an invoice: the two mandatory QR codes
// (CODE I "OFFLINE" + CODE II "CERTYFIKAT"), the offline mode, the legal submission
// deadline, and a client-side "Save as PDF" action.
//
// COMPLIANCE: the QR payloads are server-issued (CODE II is sealed server-side with the
// tenant's certificate). This component only RENDERS them locally — it never recomputes
// the seal and never sends them to a third-party QR service.
export default function OfflineComplianceCard({ invoice, onAddNotification }) {
  const [offlineQr, setOfflineQr] = useState(null);
  const [certQr, setCertQr] = useState(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([qrDataUrl(invoice.qrCodeOffline), qrDataUrl(invoice.qrCodeCertificate)])
      .then(([o, c]) => {
        if (!alive) return;
        setOfflineQr(o);
        setCertQr(c);
      })
      .catch(() => { /* QR render failure is non-fatal; placeholders shown */ });
    return () => { alive = false; };
  }, [invoice.qrCodeOffline, invoice.qrCodeCertificate]);

  const deadline = invoice.ksefSubmissionDeadline ? new Date(invoice.ksefSubmissionDeadline) : null;
  const overdue = deadline && deadline.getTime() < Date.now();

  // A compliant offline invoice MUST carry CODE II (sealed with an OFFLINE-type KSeF
  // certificate). If it's missing, the backend refused to seal — we must NOT let the user
  // export a non-compliant PDF.
  const certMissing = !invoice.qrCodeCertificate;

  const handleDownload = async () => {
    setPrinting(true);
    try {
      await openInvoicePrint(invoice);
    } catch (err) {
      onAddNotification?.('PDF Generation Failed', err?.message ?? 'Could not open the print view', 'error');
    } finally {
      setPrinting(false);
    }
  };

  const qrTile = (src, label, caption, missingPayload) => (
    <div className="flex flex-col items-center text-center">
      {src ? (
        <img src={src} alt={`${label} QR`} className="w-[120px] h-[120px] border border-stone-200 rounded bg-white p-1" />
      ) : (
        <div className="w-[120px] h-[120px] border border-dashed border-stone-300 rounded flex items-center justify-center text-[10px] text-stone-400 px-2">
          {missingPayload ? 'Brak danych QR (oczekuje)' : 'Renderowanie…'}
        </div>
      )}
      <span className="mt-1.5 text-[11px] font-bold text-stone-700">{label}</span>
      <span className="text-[9px] text-stone-500 max-w-[140px] leading-tight">{caption}</span>
    </div>
  );

  return (
    <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
          <FileWarning size={14} /> Tryb offline — wymagane dwa kody QR
        </div>
        <span className="text-[10px] font-mono font-bold bg-white border border-amber-200 text-amber-800 px-2 py-0.5 rounded">
          {invoice.offlineMode ?? 'OFFLINE'}
        </span>
      </div>

      <div
        className={`flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5 border ${
          overdue
            ? 'bg-red-50 border-red-200 text-red-700 font-semibold'
            : 'bg-white border-stone-200 text-stone-600'
        }`}
      >
        <Clock size={13} />
        {deadline ? (
          <span>
            Termin przesłania do KSeF: <strong>{deadline.toLocaleString('pl-PL')}</strong>
            {overdue && ' — PRZEKROCZONY (eskalacja wymagana)'}
          </span>
        ) : (
          <span>Termin przesłania do KSeF: —</span>
        )}
      </div>

      {certMissing ? (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-300 bg-red-50 text-red-800 text-[11px]">
          <FileWarning size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong>Brak certyfikatu OFFLINE (KSeF) — blokada zgodności.</strong> Kod QR „CERTYFIKAT” może być
            wygenerowany wyłącznie certyfikatem KSeF typu <em>Offline</em> (Non-Repudiation). Wdróż certyfikat
            offline w KSeF, aby wystawiać faktury w trybie offline. Faktura oczekuje na przesłanie do KSeF.
          </span>
        </div>
      ) : (
        <div className="flex gap-6 justify-center py-1">
          {qrTile(offlineQr, 'OFFLINE', 'Weryfikacja treści faktury w KSeF po przesłaniu', !invoice.qrCodeOffline)}
          {qrTile(certQr, 'CERTYFIKAT', 'Potwierdzenie tożsamości wystawcy (pieczęć)', !invoice.qrCodeCertificate)}
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={printing || certMissing}
        title={certMissing ? 'Niedostępne — brak certyfikatu OFFLINE (kod QR CERTYFIKAT)' : undefined}
        className="w-full flex items-center justify-center gap-2 text-[11px] font-semibold border border-stone-300 hover:border-stone-400 hover:bg-white text-stone-700 rounded-lg py-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={13} />
        {printing ? 'Przygotowywanie…' : 'Pobierz fakturę offline (PDF)'}
      </button>

      <p className="flex items-start gap-1 text-[9.5px] text-stone-500 leading-snug">
        <ShieldCheck size={11} className="text-emerald-600 mt-0.5 shrink-0" />
        Kody QR generowane lokalnie; pieczęć CERTYFIKAT podpisana po stronie serwera certyfikatem KSeF. PDF to wyłącznie wizualizacja — dokumentem prawnym jest faktura FA(3) w KSeF.
      </p>
    </div>
  );
}
