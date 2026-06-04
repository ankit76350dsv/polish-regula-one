// Client-side offline-invoice helpers.
//
// COMPLIANCE NOTES:
//  - QR codes are rendered LOCALLY in the browser (no external QR image service),
//    so invoice identifiers + the issuer's certificate seal never leave the client
//    to a third party (GDPR / data-residency).
//  - The two QR payloads come from the backend: CODE I "OFFLINE" (qrCodeOffline) and
//    CODE II "CERTYFIKAT" (qrCodeCertificate, sealed server-side with the tenant's
//    certificate). The client only RENDERS them — it must never recompute CODE II.
//  - The PDF is the human-readable visualization only; the legal record is the FA(3)
//    XML in KSeF. It is generated here client-side, on demand, and not stored on the server.

import QRCode from 'qrcode';

// Render a QR payload to a PNG data URL entirely in-browser (no network).
export async function qrDataUrl(text) {
  if (!text) return null;
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
}

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (v) =>
  (Number(v) || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('pl-PL') : '—');

/**
 * Generate the invoice visualization (PDF via the browser's native Save-as-PDF)
 * entirely client-side. Works for BOTH:
 *   - registered (online/SENT) invoices → CODE I labelled with the KSeF number,
 *   - offline invoices → CODE I labelled "OFFLINE" + CODE II "CERTYFIKAT".
 * CODE I (unsigned, MF-required on any shared visualization) is always rendered when
 * present; CODE II is rendered only when present (offline-only). Fully local — no
 * server PDF, no external calls.
 */
export async function openInvoicePrint(invoice) {
  const isRegistered = !!invoice.ksefId;
  const [codeIPng, codeIIPng] = await Promise.all([
    qrDataUrl(invoice.qrCodeOffline),     // CODE I  — invoice verification (online + offline)
    qrDataUrl(invoice.qrCodeCertificate), // CODE II — offline only
  ]);

  const rows = (invoice.items ?? [])
    .map(
      (i) => `
      <tr>
        <td>${esc(i.productName)}</td>
        <td style="text-align:right">${esc(i.quantity)} ${esc(i.unit ?? 'szt.')}</td>
        <td style="text-align:right">${money(i.netAmount)}</td>
        <td style="text-align:right">${esc(i.vatRate)}</td>
        <td style="text-align:right">${money(i.vatAmount)}</td>
        <td style="text-align:right">${money(i.grossAmount)}</td>
      </tr>`
    )
    .join('');

  const qrBlock = (png, label, caption) => `
    <div style="text-align:center">
      ${png ? `<img src="${png}" width="150" height="150" alt="${esc(label)} QR"/>` : `<div style="width:150px;height:150px;border:1px dashed #b91c1c;color:#b91c1c;display:flex;align-items:center;justify-content:center;font-size:10px">QR ${esc(label)}<br/>unavailable</div>`}
      <div style="font-weight:bold;font-size:11px;margin-top:4px">${esc(label)}</div>
      <div style="font-size:9px;color:#555;max-width:170px">${esc(caption)}</div>
    </div>`;

  // Adaptive header / notice / QR labelling for registered vs offline invoices.
  const title = isRegistered ? 'FAKTURA VAT' : 'FAKTURA VAT (TRYB OFFLINE)';
  const sub = isRegistered
    ? 'Faktura ustrukturyzowana zarejestrowana w KSeF'
    : 'Dokument wygenerowany w trybie offline — oczekuje na rejestrację w KSeF';
  const noticeHtml = isRegistered
    ? `<div class="notice ok"><strong>Zarejestrowana w KSeF.</strong> Numer KSeF: <strong>${esc(invoice.ksefId)}</strong></div>`
    : `<div class="notice"><strong>UWAGA:</strong> Faktura nie posiada jeszcze numeru KSeF.
        Tryb: <strong>${esc(invoice.offlineMode ?? 'OFFLINE')}</strong> ·
        Wystawiono offline: <strong>${fmtDateTime(invoice.offlineIssuedAt)}</strong> ·
        Termin przesłania do KSeF: <strong>${fmtDateTime(invoice.ksefSubmissionDeadline)}</strong></div>`;
  // CODE I label = KSeF number when registered, otherwise "OFFLINE" (per MF spec).
  const codeILabel = isRegistered ? invoice.ksefId : 'OFFLINE';
  const qrsHtml = `<div class="qrs">
      ${qrBlock(codeIPng, codeILabel, 'Weryfikacja faktury w KSeF (KOD I)')}
      ${codeIIPng ? qrBlock(codeIIPng, 'CERTYFIKAT', 'Potwierdzenie tożsamości wystawcy — KOD II') : ''}
    </div>`;

  const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"/>
<title>Faktura ${esc(invoice.invoiceNumber)}</title>
<style>
  body{font-family:Helvetica,Arial,sans-serif;color:#1c1917;margin:32px;font-size:12px}
  h1{font-size:18px;margin:0 0 2px}
  .sub{font-size:10px;color:#666;margin-bottom:14px}
  .notice{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:8px 10px;border-radius:6px;font-size:11px;margin:10px 0}
  .notice.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
  .grid{display:flex;gap:40px;margin:12px 0}
  .grid h3{font-size:11px;text-transform:uppercase;color:#888;margin:0 0 4px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{border-bottom:1px solid #eee;padding:5px 6px;font-size:11px}
  th{text-align:left;color:#666;font-weight:600}
  .totals{text-align:right;margin-top:8px}
  .totals .g{font-size:14px;font-weight:bold}
  .qrs{display:flex;gap:40px;justify-content:flex-end;margin-top:22px}
  @media print{button{display:none}}
</style></head>
<body>
  <h1>${title}</h1>
  <div class="sub">${sub}</div>

  ${noticeHtml}

  <div><strong>Nr faktury:</strong> ${esc(invoice.invoiceNumber)}
    &nbsp;·&nbsp; <strong>Data wystawienia:</strong> ${esc(invoice.issueDate)}
    ${invoice.dueDate ? `&nbsp;·&nbsp; <strong>Termin płatności:</strong> ${esc(invoice.dueDate)}` : ''}</div>

  <div class="grid">
    <div>
      <h3>Sprzedawca</h3>
      <div>${esc(invoice.sellerName)}</div>
      <div>NIP: ${esc(invoice.sellerNIP)}</div>
      <div>${esc(invoice.sellerAddress)}, ${esc(invoice.sellerPostalCode)} ${esc(invoice.sellerCity)}</div>
    </div>
    <div>
      <h3>Nabywca</h3>
      <div>${esc(invoice.buyerName)}</div>
      <div>NIP: ${esc(invoice.buyerNIP)}</div>
      <div>${esc(invoice.buyerAddress)}, ${esc(invoice.buyerPostalCode)} ${esc(invoice.buyerCity)}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Pozycja</th><th style="text-align:right">Ilość</th><th style="text-align:right">Netto</th><th style="text-align:right">VAT %</th><th style="text-align:right">VAT</th><th style="text-align:right">Brutto</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div>Razem netto: ${money(invoice.totalNet)} ${esc(invoice.currency ?? 'PLN')}</div>
    <div>VAT: ${money(invoice.totalVat)} ${esc(invoice.currency ?? 'PLN')}</div>
    <div class="g">Razem brutto: ${money(invoice.totalGross)} ${esc(invoice.currency ?? 'PLN')}</div>
  </div>

  ${qrsHtml}

  <button onclick="window.print()" style="margin-top:24px;padding:8px 14px">Drukuj / Zapisz jako PDF</button>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Nie można otworzyć okna wydruku — odblokuj wyskakujące okna dla tej strony.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
