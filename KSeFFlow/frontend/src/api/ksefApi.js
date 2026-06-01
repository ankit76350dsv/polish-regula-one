/**
 * KSeFFlow API client.
 *
 * Two backends:
 *   VITE_API_URL       (default :8080) — RegulaOne backend (auth, invoices)
 *   VITE_KSEF_API_URL  (default :8081) — KSeFFlow backend  (certificates)
 *
 * Authentication: HTTP-only cookie forwarded automatically via credentials:'include'.
 */

import { apiFetch } from '../lib/api';

// KSeFFlow-specific backend (certificates, KSeF gov API)
const KSEF_API_URL = import.meta.env.VITE_KSEF_API_URL ?? 'http://localhost:8081';

// ── Response mapper ────────────────────────────────────────────────────────────
// Maps the backend KSeFInvoiceResponse shape to what this frontend expects.

export const mapBackendInvoice = (b) => ({
  id:            b.id,
  invoiceNumber: b.invoiceNumber,
  issueDate:     b.issueDate   ?? '',
  dueDate:       b.dueDate     ?? '',
  tenantId:      b.tenantId    ?? '',
  sellerName:    b.sellerName  ?? '',
  sellerNIP:     b.sellerNip   ?? '',
  sellerAddress: '',
  buyerName:     b.buyerName   ?? '',
  buyerNIP:      b.buyerNip    ?? '',
  buyerAddress:  b.buyerAddress ?? '',
  currency:      b.currency    ?? 'PLN',
  items: (b.items ?? []).map(i => ({
    id:          i.description,            // no separate itemId in new schema
    productName: i.description,
    quantity:    parseFloat(i.quantity)    || 0,
    unitPrice:   parseFloat(i.unitPriceNet)|| 0,
    vatRate:     i.vatRate,
    netAmount:   parseFloat(i.netAmount)   || 0,
    vatAmount:   parseFloat(i.vatAmount)   || 0,
    grossAmount: parseFloat(i.grossAmount) || 0,
  })),
  totalNet:          parseFloat(b.totalNet)   || 0,
  totalVat:          parseFloat(b.totalVat)   || 0,
  totalGross:        parseFloat(b.totalGross) || 0,
  paymentMethod:     'Transfer',
  bankAccount:       '',
  paymentStatus:     'UNPAID',
  notes:             '',
  status:            b.status             ?? 'DRAFT',
  ksefId:            b.ksefId             ?? null,
  upoStatus:         b.hasUpo ? 'RECEIVED' : 'NONE',
  upoTimestamp:      b.hasUpo ? b.updatedAt : null,
  offlineQrCode:     null,
  submissionAttempts: 0,
  lastErrorMessage:  b.rejectionReason    ?? null,
  createdAt:         b.createdAt          ?? null,
  // Extra fields used by this app's UI
  canSubmit:         b.canSubmit,
  hasXml:            b.hasXml,
});

// ── API functions ──────────────────────────────────────────────────────────────

/**
 * List all invoices for the authenticated user's tenant.
 * tenantId param is kept for call-site compatibility but is ignored —
 * the backend extracts tenantId from the JWT cookie automatically.
 */
export const listInvoices = async (_tenantId = '') => {
  const data = await apiFetch('/api/ksef/invoices');
  return Array.isArray(data) ? data.map(mapBackendInvoice) : [];
};

export const getInvoice = async (_tenantId, invoiceId) => {
  const data = await apiFetch(`/api/ksef/invoices/${invoiceId}`);
  return mapBackendInvoice(data);
};

/**
 * Create a new draft invoice.
 * Maps from the KSeFFlow frontend invoice shape to the KSeFInvoiceRequest DTO.
 */
export const createInvoice = async (payload) => {
  const body = {
    buyerName:    payload.buyerName,
    buyerNip:     payload.buyerNip     || undefined,
    buyerEmail:   payload.buyerEmail   || undefined,
    buyerAddress: payload.buyerAddress || undefined,
    issueDate:    payload.issueDate,
    dueDate:      payload.dueDate      || undefined,
    currency:     payload.currency     ?? 'PLN',
    referenceNumber: payload.invoiceNumber || undefined,
    items: (payload.items ?? []).map(i => ({
      description:  i.productName,
      quantity:     i.quantity,
      unit:         i.unit ?? 'szt.',
      unitPriceNet: i.unitPrice,
      vatRate:      normalizeVatRate(i.vatRate),
    })),
  };

  const data = await apiFetch('/api/ksef/invoices', {
    method: 'POST',
    body:   JSON.stringify(body),
  });
  return mapBackendInvoice(data);
};

/**
 * Submit a DRAFT invoice to the KSeF gateway.
 * nip param is kept for compatibility but the backend gets it from the
 * authenticated user's tenant record.
 */
export const submitInvoice = async (_tenantId, invoiceId) => {
  const data = await apiFetch(`/api/ksef/invoices/${invoiceId}/submit`, {
    method: 'POST',
  });
  return mapBackendInvoice(data);
};

/**
 * Get dashboard stats (gateway status, queue length, UPO count etc).
 */
export const getStats = async () => {
  return apiFetch('/api/ksef/stats');
};

/**
 * Download the raw FA(3) XML for an accepted invoice.
 */
export const downloadInvoiceXml = async (invoiceId) => {
  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
  const res = await fetch(`${API_URL}/api/ksef/invoices/${invoiceId}/xml`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to download XML');
  return res.text();
};

/**
 * Audit logs — the KSeFFlow backend endpoint is not yet implemented in
 * RegulaOne. Returns an empty page so the Audit Center renders without errors.
 */
export const listAuditLogs = async () => ({
  content:       [],
  totalElements: 0,
  totalPages:    0,
  size:          20,
  number:        0,
});

// ── Certificate API (KSeFFlow backend :8081) ──────────────────────────────────

/**
 * Upload a .pfx or .pem certificate for a tenant.
 * Uses raw fetch + FormData because multipart/form-data cannot go through
 * the JSON-based apiFetch wrapper.
 *
 * @param {string}  tenantId  tenant that owns the certificate
 * @param {File}    file      the .pfx / .pem file object from the file input
 * @param {string}  password  certificate password (required for PFX, omit for PEM)
 * @param {string}  userId    optional user id for audit trail
 * @returns {Promise<CertificateResponse>}
 */
export const uploadCertificate = async (tenantId, file, password = '', userId = '') => {
  const form = new FormData();
  form.append('file', file);
  if (password) form.append('password', password);

  const headers = { 'X-Tenant-Id': tenantId };
  if (userId) headers['X-User-Id'] = userId;

  const res = await fetch(`${KSEF_API_URL}/api/v1/certificates/upload`, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message ?? `Upload failed (${res.status})`);
  }
  return json;
};

/**
 * List all certificates for a tenant (active + historical), newest first.
 */
export const listCertificates = async (tenantId) => {
  const res = await fetch(`${KSEF_API_URL}/api/v1/certificates`, {
    headers:     { 'X-Tenant-Id': tenantId },
    credentials: 'include',
  });
  const json = await res.json().catch(() => []);
  if (!res.ok) throw new Error(json?.message ?? 'Failed to load certificates');
  return Array.isArray(json) ? json : [];
};

/**
 * Deactivate (soft-disable) a certificate so it is no longer used for signing.
 * The record is kept for audit history.
 */
export const deactivateCertificate = async (tenantId, certId) => {
  const res = await fetch(`${KSEF_API_URL}/api/v1/certificates/${certId}/deactivate`, {
    method:      'PATCH',
    headers:     { 'X-Tenant-Id': tenantId },
    credentials: 'include',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? 'Failed to deactivate certificate');
  return json;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Normalise VAT rate to the values the backend accepts:
 *   "23" | "8" | "5" | "0" | "ZW" | "NP"
 */
function normalizeVatRate(rate) {
  const map = { 'VAT_23': '23', 'VAT_8': '8', 'VAT_5': '5', 'VAT_0': '0', 'EXEMPT': 'ZW', 'REVERSE_CHARGE': 'NP', 'exempt': 'ZW', 'reverse_charge': 'NP' };
  return map[rate] ?? String(rate ?? '23');
}
