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
  lastRetryAt:            b.lastRetryAt            ?? null,
  // Computed server-side: earliest time the automatic retry job will next try KSeF.
  nextRetryAt:            b.nextRetryAt            ?? null,
  qrCodeInvoice:          b.qrCodeInvoice          ?? null,
  qrCodeCertificate:      b.qrCodeCertificate      ?? null,

  fa3XmlHash:        b.fa3XmlHash         ?? null,
  submissionAttempts: b.submissionAttempts ?? 0,
  lastErrorMessage:  b.lastErrorMessage   ?? b.rejectionReason ?? null,
  createdAt:         b.createdAt          ?? null,
  // Full ordered status timeline (DRAFT → PENDING → SENT → ...) — see getInvoiceStatus.
  statusHistory:     Array.isArray(b.statusHistory) ? b.statusHistory : [],
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
 * Load a generous slice of the tenant's invoices as a flat array (newest first). This feeds the
 * SHARED app state used by widgets that need the whole picture (the sidebar offline-mode badge,
 * the invoice-detail lookup, the offline queue). The invoice LIST page does NOT use this — it uses
 * listInvoicesPage() for true server-side pagination. The backend returns a Spring Data Page; we
 * read `.content` (a bare array is tolerated for compatibility).
 */
export const listInvoices = async () => {
  const params = new URLSearchParams({ page: '0', size: '500', sort: 'createdAt,desc' });
  const page = await ksefFetch(`${INVOICE_PATH}?${params.toString()}`);
  const content = Array.isArray(page) ? page : (page?.content ?? []);
  return content.map(mapBackendInvoice);
};

/**
 * Server-side paginated + filtered invoice list for the Invoice Repository page.
 * GET /api/v1/invoices?page=&size=&status=&search=&sort=createdAt,desc
 * The database does the paging/filtering/search, so we only ever fetch one page at a time.
 *
 * @param {object}  opts
 * @param {number}  [opts.page=0]    zero-based page index
 * @param {number}  [opts.size=10]   rows per page
 * @param {string}  [opts.status]    KsefInvoiceStatus (e.g. SENT, OFFLINE_MODE, DRAFT) — omit for all
 * @param {string}  [opts.search]    text matched against invoice number / buyer name / buyer NIP
 * @returns {Promise<{content:object[], totalElements:number, totalPages:number, number:number, size:number}>}
 */
export const listInvoicesPage = async (opts = {}) => {
  const { page = 0, size = 10, status, search } = opts;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  params.set('sort', 'createdAt,desc');
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const json = await ksefFetch(`${INVOICE_PATH}?${params.toString()}`);
  const content = Array.isArray(json) ? json : (json?.content ?? []);
  return {
    content:       content.map(mapBackendInvoice),
    totalElements: json?.totalElements ?? content.length,
    totalPages:    json?.totalPages    ?? 1,
    number:        json?.number         ?? page,
    size:          json?.size           ?? size,
  };
};

export const getInvoice = async (_tenantId, invoiceId) => {
  return mapBackendInvoice(await ksefFetch(`${INVOICE_PATH}/${invoiceId}`));
};

/**
 * The EXACT official FA(3) XML for one invoice — generated server-side by the same builder used
 * for KSeF submission (namespace http://crd.gov.pl/wzor/2025/06/25/13775/). Returns the raw XML
 * string (ksefFetch returns text when the body isn't JSON). GET /api/v1/invoices/{id}/xml.
 */
export const getInvoiceXml = async (invoiceId) => {
  return ksefFetch(`${INVOICE_PATH}/${encodeURIComponent(invoiceId)}/xml`);
};

/**
 * Fetch an invoice's status timeline: current status, the "what to do next" hint, and the
 * full ordered history of status changes (DRAFT → PENDING → SENT → ...) with timestamps.
 * GET /api/v1/invoices/{invoiceId}/status. Returns the backend InvoiceStatusResponse shape:
 *   { invoiceId, invoiceNumber, currentStatus, currentStatusLabel, nextStep,
 *     lastErrorMessage, ksefSubmissionDeadline, ksefId,
 *     history: [{ status, statusLabel, timestamp, note, changedBy }] }
 */
export const getInvoiceStatus = async (invoiceId) => {
  const res = await ksefFetch(`${INVOICE_PATH}/${invoiceId}/status`);
  return {
    ...res,
    history: Array.isArray(res?.history) ? res.history : [],
  };
};

/**
 * Builds the backend CreateInvoiceRequest DTO from this frontend's invoice shape.
 * Shared by createInvoice() and correctInvoice() so the field mapping lives in one place.
 */
const toCreateInvoiceBody = (payload) => ({
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
});

/**
 * Create a new DRAFT invoice (POST /api/v1/invoices/draft).
 * Maps the KSeFFlow frontend invoice shape onto the backend CreateInvoiceRequest DTO.
 */
export const createInvoice = async (payload) => {
  const created = await ksefFetch(`${INVOICE_PATH}/draft`, {
    method: 'POST',
    body:   JSON.stringify(toCreateInvoiceBody(payload)),
  });
  return mapBackendInvoice(created);
};

/**
 * Create a CORRECTION invoice (faktura korygująca) for an invoice already in KSeF.
 * POST /api/v1/invoices/{originalId}/correct?reason=...&correctionType=...
 * The body is the corrected invoice content (same shape as a normal invoice). The new
 * correction is saved as a DRAFT; submit it afterwards with submitInvoice() like any invoice.
 *
 * @param {string} originalInvoiceId  id of the SENT invoice being corrected
 * @param {object} payload            corrected invoice content (frontend invoice shape)
 * @param {string} reason             why the correction is needed (FA(3) PrzyczynaKorekty)
 * @param {number} [correctionType]   optional KSeF correction type 1/2/3 (FA(3) TypKorekty)
 */
export const correctInvoice = async (originalInvoiceId, payload, reason, correctionType) => {
  const params = new URLSearchParams();
  params.set('reason', reason ?? '');
  if (correctionType != null && correctionType !== '') {
    params.set('correctionType', String(correctionType));
  }
  const created = await ksefFetch(
    `${INVOICE_PATH}/${originalInvoiceId}/correct?${params.toString()}`,
    { method: 'POST', body: JSON.stringify(toCreateInvoiceBody(payload)) },
  );
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
 * Manually retry an OFFLINE_MODE invoice NOW (POST /api/v1/invoices/{id}/retry).
 * Really re-attempts submission to KSeF server-side and returns the updated invoice
 * (SENT on success, or still OFFLINE_MODE on failure).
 */
export const retryOfflineInvoice = async (invoiceId) => {
  return mapBackendInvoice(await ksefFetch(`${INVOICE_PATH}/${invoiceId}/retry`, { method: 'POST' }));
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

// ── Centralized notifications (RegulaOne Hub, :8080 via apiFetch) ───────────────
// KSeFFlow doesn't store notifications itself — it reads the user's notifications from
// the central Hub, which already scoped them to this user + tenant by permission.

// Maps the Hub's severity to this app's notification "type" (drives the bell colour).
const HUB_SEVERITY_TO_TYPE = {
  CRITICAL: 'error', ERROR: 'error', WARNING: 'warn', SUCCESS: 'success', INFO: 'info',
};

// Maps a Hub NotificationResponse onto the shape the KSeFFlow UI renders. Keeps the legacy
// bell fields (message/type/read/timestamp) AND the richer fields the center uses.
const mapHubNotification = (n) => ({
  id:        n.id,
  title:     n.title,
  message:   n.body,
  severity:  n.severity,
  category:  n.category,
  status:    n.status,
  type:      HUB_SEVERITY_TO_TYPE[n.severity] ?? 'info',
  timestamp: n.createdAt,
  read:      n.status !== 'UNREAD',
  hub:       true,
});

// This app only shows its OWN notifications. The Hub stores a sourceModule per notification;
// `module=KSEFFLOW` is MANDATORY on every call — the backend returns/acts on only KSeFFlow's.
const HUB_MODULE = 'KSEFFLOW';
const withModule = (extra = '') => `module=${HUB_MODULE}${extra ? '&' + extra : ''}`;

/** Recent KSeFFlow notifications for the signed-in user (newest first) — used by the bell. */
export const getHubNotifications = async ({ size = 20 } = {}) => {
  const page = await apiFetch(`/api/notifications?${withModule(`page=0&size=${size}`)}`);
  const content = Array.isArray(page?.content) ? page.content : (Array.isArray(page) ? page : []);
  return content.map(mapHubNotification);
};

/**
 * Paginated, optionally status-filtered list for the Notification Center.
 * Mirrors the RegulaOne hub center: returns mapped content + page metadata.
 */
export const listHubNotifications = async ({ status, page = 0, size = 20 } = {}) => {
  const statusQs = (status && status !== 'ALL') ? `status=${status}&` : '';
  const json = await apiFetch(`/api/notifications?${withModule(`${statusQs}page=${page}&size=${size}`)}`);
  return {
    content:       (Array.isArray(json?.content) ? json.content : []).map(mapHubNotification),
    totalElements: json?.totalElements ?? 0,
    totalPages:    json?.totalPages    ?? 0,
    number:        json?.number        ?? page,
  };
};

/** Unread KSeFFlow badge count → number. */
export const getHubUnreadCount = async () => {
  const res = await apiFetch(`/api/notifications/unread-count?${withModule()}`);
  return res?.unread ?? 0;
};

/** Mark a single notification read. */
export const markHubNotificationRead = async (id) =>
  apiFetch(`/api/notifications/${id}/read?${withModule()}`, { method: 'PATCH' });

/** Mark every KSeFFlow notification read; returns how many were updated. */
export const markAllHubNotificationsRead = async () => {
  const res = await apiFetch(`/api/notifications/read-all?${withModule()}`, { method: 'PATCH' });
  return res?.updated ?? 0;
};

/** Archive a notification (kept in history, hidden from the active list). */
export const archiveHubNotification = async (id) =>
  apiFetch(`/api/notifications/${id}/archive?${withModule()}`, { method: 'PATCH' });

/** Soft-delete a notification for this user. */
export const deleteHubNotification = async (id) =>
  apiFetch(`/api/notifications/${id}?${withModule()}`, { method: 'DELETE' });

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

/**
 * Download the PUBLIC certificate (X.509, PEM) for a stored certificate.
 * Returns PEM text — the backend never returns the private key or password.
 */
export const getCertificatePublicPem = async (certId) => {
  return ksefFetch(`/api/v1/certificates/${certId}/public`);
};

/**
 * Enroll a brand-new KSeF-issued certificate (the backend generates the key pair, asks KSeF
 * to issue the certificate, and stores it encrypted). POST /api/v1/certificates/enroll.
 *
 * @param {string} nip      the tenant's own 10-digit NIP (KSeF authentication context)
 * @param {string} purpose  'AUTHENTICATION' (log in) or 'OFFLINE' (seal offline invoices)
 * @param {string} name     a friendly name for the certificate
 * @returns {Promise<CertificateResponse>} the stored certificate's safe metadata
 */
export const enrollCertificate = async (nip, purpose, name) => {
  const params = new URLSearchParams();
  params.set('nip', nip ?? '');
  params.set('purpose', purpose || 'AUTHENTICATION');
  params.set('name', name ?? '');
  return ksefFetch(`/api/v1/certificates/enroll?${params.toString()}`, { method: 'POST' });
};

// ── Received (purchase) invoices — faktury otrzymane (KSeFFlow backend :8081) ───
// Invoices OTHER companies issued to this tenant, pulled from KSeF. Mandatory from 1 Feb 2026.

const RECEIVED_PATH = '/api/v1/received-invoices';

/**
 * Pull purchase invoices from KSeF for a date window (default: backend uses last 30 days).
 * POST /api/v1/received-invoices/sync — stores any new ones and reports counts.
 *
 * @param {string} nip       the tenant's own 10-digit NIP (buyer context)
 * @param {string} [from]    optional ISO window start (e.g. 2026-06-01T00:00:00)
 * @param {string} [to]      optional ISO window end (KSeF allows at most a 3-month span)
 * @returns {Promise<{fetched:number, created:number, skipped:number}>}
 */
export const syncReceivedInvoices = async (nip, from, to) => {
  const params = new URLSearchParams();
  params.set('nip', nip ?? '');
  if (from) params.set('from', from);
  if (to)   params.set('to', to);
  return ksefFetch(`${RECEIVED_PATH}/sync?${params.toString()}`, { method: 'POST' });
};

/**
 * List stored received invoices (metadata only), newest issue date first.
 * Returns a normalised page so the UI always has the fields it reads.
 */
export const listReceivedInvoices = async (opts = {}) => {
  const { page = 0, size = 20 } = opts;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  const json = await ksefFetch(`${RECEIVED_PATH}?${params.toString()}`);
  return {
    content:       Array.isArray(json?.content) ? json.content : (Array.isArray(json) ? json : []),
    totalElements: json?.totalElements ?? 0,
    totalPages:    json?.totalPages    ?? 0,
    size:          json?.size          ?? size,
    number:        json?.number        ?? page,
  };
};

/**
 * Download the full FA(3) XML of one received invoice (fetched from KSeF on first request,
 * then served from encrypted storage). GET /api/v1/received-invoices/{ksefNumber}/xml.
 */
export const getReceivedInvoiceXml = async (ksefNumber, nip) => {
  return ksefFetch(
    `${RECEIVED_PATH}/${encodeURIComponent(ksefNumber)}/xml?nip=${encodeURIComponent(nip ?? '')}`,
  );
};

// ── KSeF permissions — uprawnienia (KSeFFlow backend :8081) ─────────────────────

const PERMISSIONS_PATH = '/api/v1/permissions';

/**
 * Grant a person one or more KSeF permissions in this tenant's context (admin only).
 * POST /api/v1/permissions/persons/grants?nip=...
 *
 * @param {string}   nip          the tenant's own NIP (the context we grant within)
 * @param {object}   body         { subjectType, subjectValue, permissions[], description, subjectDetailsType? }
 * @returns {Promise<{referenceNumber:string}>} async operation reference
 */
export const grantPersonPermissions = async (nip, body) => {
  return ksefFetch(`${PERMISSIONS_PATH}/persons/grants?nip=${encodeURIComponent(nip ?? '')}`, {
    method: 'POST',
    body:   JSON.stringify(body),
  });
};

/**
 * List person permissions in the current context (paged).
 * POST /api/v1/permissions/query?nip=...&pageOffset=&pageSize=
 *
 * @returns {Promise<{permissions: object[], hasMore: boolean}>}
 */
export const queryPersonPermissions = async (nip, body = {}, opts = {}) => {
  const { pageOffset = 0, pageSize = 50 } = opts;
  const params = new URLSearchParams();
  params.set('nip', nip ?? '');
  params.set('pageOffset', String(pageOffset));
  params.set('pageSize', String(pageSize));
  const json = await ksefFetch(`${PERMISSIONS_PATH}/query?${params.toString()}`, {
    method: 'POST',
    body:   JSON.stringify(body),
  });
  return {
    permissions: Array.isArray(json?.permissions) ? json.permissions : [],
    hasMore:     json?.hasMore ?? false,
  };
};

/**
 * Revoke one granted permission by its id (admin only).
 * DELETE /api/v1/permissions/{permissionId}?nip=...
 */
export const revokePermission = async (nip, permissionId) => {
  return ksefFetch(
    `${PERMISSIONS_PATH}/${encodeURIComponent(permissionId)}?nip=${encodeURIComponent(nip ?? '')}`,
    { method: 'DELETE' },
  );
};

/**
 * Check how an async grant/revoke operation finished.
 * GET /api/v1/permissions/operations/{referenceNumber}?nip=...
 */
export const getPermissionOperationStatus = async (nip, referenceNumber) => {
  return ksefFetch(
    `${PERMISSIONS_PATH}/operations/${encodeURIComponent(referenceNumber)}?nip=${encodeURIComponent(nip ?? '')}`,
  );
};

// ── KSeF availability status — failure mode / tryb awaryjny (KSeFFlow :8081) ────

const KSEF_STATUS_PATH = '/api/v1/ksef-status';

/**
 * Read the current KSeF availability state (any signed-in user).
 * GET /api/v1/ksef-status → { mode, manual, reason, declaredBy, since }
 *   mode = 'ONLINE' | 'OFFLINE_UNAVAILABILITY' | 'EMERGENCY'
 */
export const getKsefStatus = async () => ksefFetch(KSEF_STATUS_PATH);

/**
 * Read the REAL KSeF connection the backend uses (non-sensitive config).
 * GET /api/v1/ksef-status/connection → { environment, baseUrl, invoiceSchema }
 */
export const getKsefConnection = async () => ksefFetch(`${KSEF_STATUS_PATH}/connection`);

/**
 * Declare a Ministry-announced emergency ("tryb awaryjny", 7-business-day window) — admin only.
 * POST /api/v1/ksef-status/emergency  body { reason }
 */
export const declareKsefEmergency = async (reason) =>
  ksefFetch(`${KSEF_STATUS_PATH}/emergency`, { method: 'POST', body: JSON.stringify({ reason }) });

/** Manually declare unavailability (next-business-day window) — admin only. */
export const declareKsefUnavailability = async (reason) =>
  ksefFetch(`${KSEF_STATUS_PATH}/unavailability`, { method: 'POST', body: JSON.stringify({ reason }) });

/** Clear a manual declaration and hand control back to the automatic monitor — admin only. */
export const declareKsefOnline = async (reason) =>
  ksefFetch(`${KSEF_STATUS_PATH}/online`, { method: 'POST', body: JSON.stringify({ reason }) });
