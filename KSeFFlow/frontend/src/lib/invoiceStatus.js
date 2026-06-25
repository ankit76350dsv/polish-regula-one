// Friendly, business-user labels for the raw KSeF invoice status codes.
// The backend stores technical enums (SENT, OFFLINE_MODE, …); users should never see those.
// Use invoiceStatusLabel(status, language) anywhere we'd otherwise print the raw code.

export const INVOICE_STATUS_LABEL = {
  DRAFT:        { en: 'Draft',            pl: 'Robocza' },
  PENDING:      { en: 'Sending…',         pl: 'Wysyłanie…' },
  SENT:         { en: 'Sent to KSeF',     pl: 'Wysłana do KSeF' },
  OFFLINE_MODE: { en: 'Queued (offline)', pl: 'W kolejce (offline)' },
  RETRYING:     { en: 'Retrying…',        pl: 'Ponawianie…' },
  FAILED:       { en: 'Not sent',         pl: 'Niewysłana' },
  CORRECTED:    { en: 'Corrected',        pl: 'Skorygowana' },
};

// Returns the friendly label for a status, or the raw code as a safe fallback.
export function invoiceStatusLabel(status, language) {
  const entry = INVOICE_STATUS_LABEL[status];
  if (!entry) return status ?? '—';
  return entry[language === 'pl' ? 'pl' : 'en'];
}

// A short, friendly one-line explanation per status (no technical error text).
// Used where we previously dumped the raw backend error message.
export function invoiceStatusHint(status, language) {
  const pl = language === 'pl';
  switch (status) {
    case 'OFFLINE_MODE':
      return pl
        ? 'KSeF był niedostępny — faktura czeka w kolejce i zostanie wysłana automatycznie.'
        : 'KSeF was unavailable — the invoice is queued and will be sent automatically.';
    case 'RETRYING':
      return pl ? 'Trwa ponowna próba wysłania do KSeF…' : 'Trying to send to KSeF again…';
    case 'PENDING':
      return pl ? 'Faktura jest wysyłana do KSeF…' : 'The invoice is being sent to KSeF…';
    case 'FAILED':
      return pl
        ? 'Nie udało się wysłać faktury. Skontaktuj się z administratorem.'
        : 'The invoice could not be sent. Please contact your administrator.';
    default:
      return '';
  }
}
