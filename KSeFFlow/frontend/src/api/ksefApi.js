/**
 * KSeFFlow API client.
 *
 * Two backends:
 *   VITE_API_URL       (default :8080) — RegulaOne backend (auth/tenant, via apiFetch)
 *   VITE_KSEF_API_URL  (default :8081) — KSeFFlow backend  (invoices, certificates,
 *                                        audit logs — via the hardened ksefFetch)
 *
 * Security / compliance:
 *   - Authentication is the httpOnly idToken cookie ONLY (ksefFetch sends
 *     credentials:'include'). JS never reads or stores the token → not XSS-exposed.
 *   - The client NEVER sends tenant/user identity. The backend derives tenant + user
 *     from the verified session (RegulaOne /api/auth/me); this is what enforces tenant
 *     isolation. The leading `tenantId` parameters below are kept only for call-site
 *     compatibility and are intentionally NOT sent on the request.
 */

import { apiFetch, ksefFetch } from '../lib/api';

// ── Response mapper ────────────────────────────────────────────────────────────
// Maps the backend KsefInvoice entity shape onto what this frontend expects.

// Reverse of toVatRateEnum / toPaymentMethodEnum — backend enum name → form value,
// so an existing invoice loaded into InvoiceForm shows the right dropdown selection.
const fromVatRateEnum = {
  VAT_23: '23', VAT_8: '8', VAT_5: '5', VAT_0: '0',
  EXEMPT: 'exempt', REVERSE_CHARGE: 'reverse_charge',
};
const fromPaymentMethodEnum = {
  SPLIT_PAYMENT: 'Split Payment', TRANSFER: 'Transfer', CARD: 'Card', CASH: 'Cash',
};

export const mapBackendInvoice = (b) => ({
  id:            b.id,
  invoiceNumber: b.invoiceNumber,
  issueDate:     b.issueDate   ?? '',
  dueDate:       b.dueDate     ?? '',
  tenantId:      b.tenantId    ?? '',
  sellerName:    b.sellerName  ?? '',
  sellerNIP:     b.sellerNip   ?? '',
  sellerAddress: b.sellerAddress ?? '',
  sellerPostalCode: b.sellerPostalCode ?? '',
  sellerCity:    b.sellerCity  ?? '',
  buyerName:     b.buyerName   ?? '',
  buyerNIP:      b.buyerNip    ?? '',
  buyerAddress:  b.buyerAddress ?? '',
  buyerPostalCode: b.buyerPostalCode ?? '',
  buyerCity:     b.buyerCity   ?? '',
  currency:      b.currency    ?? 'PLN',
  items: (b.items ?? []).map(i => ({
    id:          i.itemId ?? i.productName,
    productName: i.productName,
    unit:        i.unit ?? 'szt.',
    quantity:    parseFloat(i.quantity)  || 0,
    unitPrice:   parseFloat(i.unitPrice) || 0,
    vatRate:     fromVatRateEnum[i.vatRate] ?? i.vatRate,
    netAmount:   parseFloat(i.netAmount)   || 0,
    vatAmount:   parseFloat(i.vatAmount)   || 0,
    grossAmount: parseFloat(i.grossAmount) || 0,
  })),
  totalNet:          parseFloat(b.totalNet)   || 0,
  totalVat:          parseFloat(b.totalVat)   || 0,
  totalGross:        parseFloat(b.totalGross) || 0,
  paymentMethod:     fromPaymentMethodEnum[b.paymentMethod] ?? 'Transfer',
  bankAccount:       b.bankAccount ?? '',
  paymentStatus:     'UNPAID',
  notes:             b.notes ?? '',
  status:            b.status             ?? 'DRAFT',
  ksefId:            b.ksefId             ?? null,
  upoStatus:         b.upoStatus          ?? (b.hasUpo ? 'RECEIVED' : 'NONE'),
  upoTimestamp:      b.upoTimestamp       ?? null,

  // ── Offline compliance (KSeF offline / offline24 / emergency) ──────────────
  // qrCodeInvoice = CODE I "OFFLINE"; qrCodeCertificate = CODE II "CERTYFIKAT".
  // These are server-issued payloads — the client only RENDERS them as QR images,
  // it must NEVER recompute the CODE II certificate seal.
  offlineMode:            b.offlineMode            ?? null,
  offlineIssuedAt:        b.offlineIssuedAt        ?? null,
  ksefSubmissionDeadline: b.ksefSubmissionDeadline ?? null,
  qrCodeInvoice:          b.qrCodeInvoice          ?? null,
  qrCodeCertificate:      b.qrCodeCertificate      ?? null,

  fa3XmlHash:        b.fa3XmlHash         ?? null,
  submissionAttempts: b.submissionAttempts ?? 0,
  lastErrorMessage:  b.lastErrorMessage   ?? b.rejectionReason ?? null,
  createdAt:         b.createdAt          ?? null,
  // Extra fields used by this app's UI
  canSubmit:         b.canSubmit,
  hasXml:            b.hasXml,
});

// ── Invoice API (KSeFFlow backend :8081, /api/v1/invoices) ──────────────────────
// All calls go through ksefFetch (lib/api.js): httpOnly-cookie auth, no client-asserted
// identity headers, central 401→login + normalised errors. The backend resolves the
// tenant from the session, so it returns ONLY the caller's tenant's data.

const INVOICE_PATH = '/api/v1/invoices';

// Enum mappers — the backend deserialises enums by their exact Java name, so the
// frontend's display/code values must be translated before sending.
const VAT_RATE_ENUM = {
  '23': 'VAT_23', '8': 'VAT_8', '5': 'VAT_5', '0': 'VAT_0',
  exempt: 'EXEMPT', reverse_charge: 'REVERSE_CHARGE',
};
const toVatRateEnum = (rate) => VAT_RATE_ENUM[String(rate ?? '').toLowerCase()] ?? 'VAT_23';

const PAYMENT_METHOD_ENUM = {
  'split payment': 'SPLIT_PAYMENT', transfer: 'TRANSFER', card: 'CARD', cash: 'CASH',
};
const toPaymentMethodEnum = (method) => PAYMENT_METHOD_ENUM[String(method ?? '').toLowerCase()] ?? 'TRANSFER';

const toCurrencyEnum = (currency) => {
  const upper = String(currency ?? 'PLN').toUpperCase();
  return ['PLN', 'EUR', 'USD'].includes(upper) ? upper : 'PLN';
};

/**
 * List the caller's invoices. The backend scopes to the session tenant and returns a
 * Spring Data Page, so we read `.content`; a bare array is tolerated for compatibility.
 * (Any leading tenantId arg from older call sites is ignored — see the file header.)
 */
export const listInvoices = async () => {
  const page = await ksefFetch(INVOICE_PATH);
  const content = Array.isArray(page) ? page : (page?.content ?? []);
  return content.map(mapBackendInvoice);
};

export const getInvoice = async (_tenantId, invoiceId) => {
  return mapBackendInvoice(await ksefFetch(`${INVOICE_PATH}/${invoiceId}`));
};

/**
 * Create a new DRAFT invoice (POST /api/v1/invoices/draft).
 * Maps the KSeFFlow frontend invoice shape onto the backend CreateInvoiceRequest DTO.
 */
export const createInvoice = async (payload) => {
  const body = {
    invoiceNumber:    payload.invoiceNumber,
    issueDate:        payload.issueDate,
    dueDate:          payload.dueDate || undefined,

    sellerName:       payload.sellerName,
    sellerNip:        payload.sellerNip,
    sellerAddress:    payload.sellerAddress,
    sellerPostalCode: payload.sellerPostalCode,
    sellerCity:       payload.sellerCity,

    buyerName:        payload.buyerName,
    buyerNip:         payload.buyerNip,
    buyerAddress:     payload.buyerAddress,
    buyerPostalCode:  payload.buyerPostalCode,
    buyerCity:        payload.buyerCity,

    currency:         toCurrencyEnum(payload.currency),
    totalNet:         payload.totalNet,
    totalVat:         payload.totalVat,
    totalGross:       payload.totalGross,
    paymentMethod:    toPaymentMethodEnum(payload.paymentMethod),
    bankAccount:      payload.bankAccount || undefined,
    notes:            payload.notes || undefined,

    items: (payload.items ?? []).map(i => ({
      itemId:      i.id,
      productName: i.productName,
      unit:        i.unit ?? 'szt.',
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      vatRate:     toVatRateEnum(i.vatRate),
      netAmount:   i.netAmount,
      vatAmount:   i.vatAmount,
      grossAmount: i.grossAmount,
    })),
  };

  const created = await ksefFetch(`${INVOICE_PATH}/draft`, {
    method: 'POST',
    body:   JSON.stringify(body),
  });
  return mapBackendInvoice(created);
};

/**
 * Submit a DRAFT invoice to the KSeF gateway (POST /api/v1/invoices/{id}/submit).
 * The backend requires the company NIP as a query param; tenant/user come from the
 * session. Returns the raw SubmitInvoiceResponse ({ status, ksefId, message, ... }).
 * (Leading tenantId / trailing userId args from older call sites are ignored.)
 */
export const submitInvoice = async (_tenantId, invoiceId, nip) => {
  return ksefFetch(`${INVOICE_PATH}/${invoiceId}/submit?nip=${encodeURIComponent(nip ?? '')}`, {
    method: 'POST',
  });
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
 * Fetch a paginated, filtered page of immutable audit logs for a tenant.
 *
 * Talks to the KSeFFlow backend (:8081) GET /api/v1/audit-logs, which returns a
 * Spring Data Page<KsefAuditLog>: { content, totalElements, totalPages, size, number }.
 * Tenant scope is enforced server-side from the session — clients can never read logs
 * outside their own tenant, and never send a tenant id.
 *
 * @param {string} [_tenantId] ignored (kept for call-site compatibility)
 * @param {object} [opts]
 * @param {number} [opts.page=0]   zero-based page index
 * @param {number} [opts.size=20]  entries per page
 * @param {string} [opts.from]     ISO-8601 datetime lower bound (e.g. 2026-01-01T00:00)
 * @param {string} [opts.to]       ISO-8601 datetime upper bound
 * @param {string} [opts.role]     exact userRole filter (omit / "ALL" for no filter)
 * @param {string} [opts.search]   substring match across email, action, IP, detail
 * @returns {Promise<{content: object[], totalElements: number, totalPages: number, size: number, number: number}>}
 */
export const listAuditLogs = async (_tenantId, opts = {}) => {
  const { page = 0, size = 20, from, to, role, search } = opts;

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  if (from)   params.set('from', from);
  if (to)     params.set('to', to);
  if (role)   params.set('role', role);
  if (search) params.set('search', search);

  const json = await ksefFetch(`/api/v1/audit-logs?${params.toString()}`);

  // Normalise so the UI always has the fields it reads, even on an empty response.
  return {
    content:       Array.isArray(json?.content) ? json.content : [],
    totalElements: json?.totalElements ?? 0,
    totalPages:    json?.totalPages    ?? 0,
    size:          json?.size          ?? size,
    number:        json?.number        ?? page,
  };
};

/**
 * Fetch the current user's own tenant/organisation from the RegulaOne backend.
 *
 * Calls GET /api/tenant/info, which derives the tenant id from the authenticated
 * JWT (idToken cookie) — the client never sends a tenant id, enforcing tenant
 * isolation. Returns the full TenantResponse: { id, name, nip, regon, status,
 * currentPackage, ... }.
 */
export const getMyTenant = async () => apiFetch('/api/tenant/info');

// ── Certificate API (KSeFFlow backend :8081) ──────────────────────────────────

/**
 * Upload a .pfx or .pem certificate for the caller's tenant.
 * Sends multipart/form-data through ksefFetch (the browser sets the boundary;
 * the httpOnly cookie carries auth). Tenant/user are taken from the session.
 *
 * @param {string}  [_tenantId] ignored (kept for call-site compatibility)
 * @param {File}    file        the .pfx / .pem file object from the file input
 * @param {string}  [password]  certificate password (required for PFX, omit for PEM)
 * @returns {Promise<CertificateResponse>}
 */
export const uploadCertificate = async (_tenantId, file, password = '') => {
  const form = new FormData();
  form.append('file', file);
  if (password) form.append('password', password);

  return ksefFetch('/api/v1/certificates/upload', { method: 'POST', body: form });
};

/**
 * List all certificates for the caller's tenant (active + historical), newest first.
 */
export const listCertificates = async () => {
  const json = await ksefFetch('/api/v1/certificates');
  return Array.isArray(json) ? json : [];
};

/**
 * Deactivate (soft-disable) a certificate so it is no longer used for signing.
 * The record is kept for audit history.
 */
export const deactivateCertificate = async (_tenantId, certId) => {
  return ksefFetch(`/api/v1/certificates/${certId}/deactivate`, { method: 'PATCH' });
};
