/**
 * KSeFFlow API client — talks to the RegulaOne Spring Boot backend
 * at localhost:8080 (configured via VITE_API_URL in .env).
 *
 * Authentication: HTTP-only cookie (idToken) set by the RegulaOne auth service.
 * All requests use credentials: 'include' so the browser forwards the cookie
 * automatically. On 401, the user is redirected to the central login page.
 *
 * Endpoints used:
 *   GET  /api/ksef/invoices           — list all invoices for current tenant
 *   POST /api/ksef/invoices           — create a draft invoice
 *   GET  /api/ksef/invoices/:id       — get single invoice
 *   POST /api/ksef/invoices/:id/submit — submit draft to KSeF
 *   GET  /api/ksef/stats              — dashboard stats
 */

import { apiFetch } from '../lib/api';

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

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Normalise VAT rate to the values the backend accepts:
 *   "23" | "8" | "5" | "0" | "ZW" | "NP"
 */
function normalizeVatRate(rate) {
  const map = { 'VAT_23': '23', 'VAT_8': '8', 'VAT_5': '5', 'VAT_0': '0', 'EXEMPT': 'ZW', 'REVERSE_CHARGE': 'NP', 'exempt': 'ZW', 'reverse_charge': 'NP' };
  return map[rate] ?? String(rate ?? '23');
}
