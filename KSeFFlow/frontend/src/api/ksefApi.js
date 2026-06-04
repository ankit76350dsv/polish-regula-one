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
// Invoices are served by the KSeFFlow backend (VITE_KSEF_API_URL), NOT the
// RegulaOne backend that apiFetch targets. The KSeFInvoiceController reads the
// tenant from the X-Tenant-Id header (JWT-claim extraction is a later phase), so
// every call MUST send it — the backend rejects requests without it.

const INVOICE_BASE = `${KSEF_API_URL}/api/v1/invoices`;

// Standard tenant/user headers expected by KSeFInvoiceController.
// X-Tenant-Id is mandatory; X-User-Id / X-User-Email are optional audit context.
const invoiceHeaders = ({ tenantId, userId, userEmail } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (tenantId)  headers['X-Tenant-Id']  = tenantId;
  if (userId)    headers['X-User-Id']    = userId;
  if (userEmail) headers['X-User-Email'] = userEmail;
  return headers;
};

// Throws a normalised Error for a non-2xx response so the UI always shows a
// meaningful message. Handles every shape the backend can return:
//   - plain-string body              (controller IllegalArgument/IllegalState handlers)
//   - Spring validation error JSON   ({ errors: [{ field, defaultMessage }], ... })
//   - Spring error JSON              ({ message } or { error })
const throwInvoiceError = async (res) => {
  // Read as text first, then try JSON — a non-JSON body (proxy/HTML error page)
  // would otherwise blow up res.json() and hide the real failure.
  const raw = await res.text().catch(() => '');
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* not JSON */ }

  let message;
  if (typeof body === 'string') {
    message = body;
  } else if (body) {
    if (Array.isArray(body.errors) && body.errors.length) {
      // Field-level validation errors → "Seller city is required; Buyer NIP must be 10 digits"
      message = body.errors
        .map(e => e.defaultMessage || e.message || (e.field ? `${e.field} is invalid` : null))
        .filter(Boolean)
        .join('; ');
    }
    message = message || body.message || body.error;
  } else if (raw) {
    message = raw;
  }

  message = message || res.statusText || `Request failed (${res.status})`;

  const err = new Error(message);
  err.httpStatus = res.status;
  throw err;
};

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
 * List all invoices for a tenant. The backend returns a Spring Data Page, so we
 * read `.content`; a bare array is tolerated for forward compatibility.
 */
export const listInvoices = async (tenantId = '') => {
  const res = await fetch(INVOICE_BASE, {
    headers:     invoiceHeaders({ tenantId }),
    credentials: 'include',
  });
  if (!res.ok) await throwInvoiceError(res);
  const page = await res.json();
  const content = Array.isArray(page) ? page : (page?.content ?? []);
  return content.map(mapBackendInvoice);
};

export const getInvoice = async (tenantId, invoiceId) => {
  const res = await fetch(`${INVOICE_BASE}/${invoiceId}`, {
    headers:     invoiceHeaders({ tenantId }),
    credentials: 'include',
  });
  if (!res.ok) await throwInvoiceError(res);
  return mapBackendInvoice(await res.json());
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

  const res = await fetch(`${INVOICE_BASE}/draft`, {
    method:      'POST',
    headers:     invoiceHeaders({ tenantId: payload.tenantId, userId: payload.userId }),
    credentials: 'include',
    body:        JSON.stringify(body),
  });
  if (!res.ok) await throwInvoiceError(res);
  return mapBackendInvoice(await res.json());
};

/**
 * Submit a DRAFT invoice to the KSeF gateway (POST /api/v1/invoices/{id}/submit).
 * The backend requires the company NIP as a query param and the tenant header.
 * Returns the raw SubmitInvoiceResponse ({ status, ksefId, message, ... }).
 */
export const submitInvoice = async (tenantId, invoiceId, nip, userId) => {
  const res = await fetch(`${INVOICE_BASE}/${invoiceId}/submit?nip=${encodeURIComponent(nip ?? '')}`, {
    method:      'POST',
    headers:     invoiceHeaders({ tenantId, userId }),
    credentials: 'include',
  });
  if (!res.ok) await throwInvoiceError(res);
  return res.json();
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
 * Tenant scope is enforced server-side via the X-Tenant-Id header — clients can
 * never read logs outside their own tenant.
 *
 * @param {string} tenantId tenant whose logs to fetch (required)
 * @param {object} [opts]
 * @param {number} [opts.page=0]   zero-based page index
 * @param {number} [opts.size=20]  entries per page
 * @param {string} [opts.from]     ISO-8601 datetime lower bound (e.g. 2026-01-01T00:00)
 * @param {string} [opts.to]       ISO-8601 datetime upper bound
 * @param {string} [opts.role]     exact userRole filter (omit / "ALL" for no filter)
 * @param {string} [opts.search]   substring match across email, action, IP, detail
 * @returns {Promise<{content: object[], totalElements: number, totalPages: number, size: number, number: number}>}
 */
export const listAuditLogs = async (tenantId, opts = {}) => {
  const { page = 0, size = 20, from, to, role, search } = opts;

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  if (from)   params.set('from', from);
  if (to)     params.set('to', to);
  if (role)   params.set('role', role);
  if (search) params.set('search', search);

  const res = await fetch(`${KSEF_API_URL}/api/v1/audit-logs?${params.toString()}`, {
    headers:     { 'X-Tenant-Id': tenantId },
    credentials: 'include',
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((typeof json === 'string' ? json : json?.message) ?? `Failed to load audit logs (${res.status})`);
  }

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
