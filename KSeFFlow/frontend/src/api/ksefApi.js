const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8081';

const vatRateToBackend = (rate) => {
  const map = {
    '23': 'VAT_23',
    '8': 'VAT_8',
    '5': 'VAT_5',
    '0': 'VAT_0',
    'exempt': 'EXEMPT',
    'reverse_charge': 'REVERSE_CHARGE',
  };
  return map[rate] ?? 'VAT_23';
};

const vatRateFromBackend = (rate) => {
  const map = {
    'VAT_23': '23',
    'VAT_8': '8',
    'VAT_5': '5',
    'VAT_0': '0',
    'EXEMPT': 'exempt',
    'REVERSE_CHARGE': 'reverse_charge',
  };
  return map[rate] ?? '23';
};

const paymentMethodToBackend = (method) => {
  const map = {
    'Transfer': 'TRANSFER',
    'Card': 'CARD',
    'Split Payment': 'SPLIT_PAYMENT',
    'Cash': 'CASH',
  };
  return map[method] ?? 'TRANSFER';
};

const paymentMethodFromBackend = (method) => {
  const map = {
    'TRANSFER': 'Transfer',
    'CARD': 'Card',
    'SPLIT_PAYMENT': 'Split Payment',
    'CASH': 'Cash',
  };
  return map[method] ?? 'Transfer';
};

// Parse combined buyer address into separate fields required by the backend DTO.
const parseBuyerAddress = (combined) => {
  const postalMatch = combined.match(/(\d{2}-\d{3})\s+(.+?)(?:,\s*.*)?$/);
  if (postalMatch) {
    const postalCode = postalMatch[1];
    const city = postalMatch[2].trim();
    const street = combined.slice(0, combined.lastIndexOf(postalMatch[0])).replace(/,\s*$/, '').trim();
    return { street: street || combined, postalCode, city };
  }
  return { street: combined, postalCode: '00-001', city: 'Warszawa' };
};

export const mapBackendInvoice = (b) => ({
  id: b.id,
  invoiceNumber: b.invoiceNumber,
  issueDate: b.issueDate,
  dueDate: b.dueDate ?? '',
  tenantId: b.tenantId,
  sellerName: b.sellerName,
  sellerNIP: b.sellerNip,
  sellerAddress: [b.sellerAddress, b.sellerPostalCode, b.sellerCity].filter(Boolean).join(', '),
  buyerName: b.buyerName,
  buyerNIP: b.buyerNip,
  buyerAddress: [b.buyerAddress, b.buyerPostalCode, b.buyerCity].filter(Boolean).join(', '),
  currency: b.currency,
  items: (b.items ?? []).map(i => ({
    id: i.itemId,
    productName: i.productName,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    vatRate: vatRateFromBackend(i.vatRate),
    netAmount: Number(i.netAmount),
    vatAmount: Number(i.vatAmount),
    grossAmount: Number(i.grossAmount),
  })),
  totalNet: Number(b.totalNet),
  totalVat: Number(b.totalVat),
  totalGross: Number(b.totalGross),
  paymentMethod: paymentMethodFromBackend(b.paymentMethod),
  bankAccount: b.bankAccount ?? '',
  paymentStatus: b.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
  notes: b.notes,
  status: b.status,
  ksefId: b.ksefId,
  upoStatus: b.upoStatus ?? 'NONE',
  upoTimestamp: b.upoTimestamp,
  offlineQrCode: b.offlineQrCode,
  submissionAttempts: b.submissionAttempts ?? 0,
  lastErrorMessage: b.lastErrorMessage,
  createdAt: b.createdAt,
});

const buildHeaders = (tenantId, userId) => ({
  'Content-Type': 'application/json',
  'X-Tenant-Id': tenantId,
  ...(userId ? { 'X-User-Id': userId } : {}),
});

const checkResponse = async (res) => {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
};

export const createInvoice = async (payload) => {
  const { street, postalCode, city } = parseBuyerAddress(payload.buyerAddress);

  const body = {
    invoiceNumber: payload.invoiceNumber,
    issueDate: payload.issueDate,
    dueDate: payload.dueDate || undefined,
    sellerName: payload.sellerName,
    sellerNip: payload.sellerNip,
    sellerAddress: payload.sellerAddress,
    sellerPostalCode: payload.sellerPostalCode,
    sellerCity: payload.sellerCity,
    buyerName: payload.buyerName,
    buyerNip: payload.buyerNip,
    buyerAddress: street,
    buyerPostalCode: postalCode,
    buyerCity: city,
    currency: payload.currency,
    totalNet: payload.totalNet,
    totalVat: payload.totalVat,
    totalGross: payload.totalGross,
    paymentMethod: paymentMethodToBackend(payload.paymentMethod),
    bankAccount: payload.bankAccount,
    notes: payload.notes,
    items: payload.items.map(i => ({
      itemId: i.id,
      productName: i.productName,
      unit: 'szt.',
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: vatRateToBackend(i.vatRate),
      netAmount: i.netAmount,
      vatAmount: i.vatAmount,
      grossAmount: i.grossAmount,
    })),
  };

  const res = await fetch(`${API_BASE}/api/v1/invoices`, {
    method: 'POST',
    headers: buildHeaders(payload.tenantId, payload.userId),
    body: JSON.stringify(body),
  });

  return mapBackendInvoice(await checkResponse(res));
};

export const submitInvoice = async (tenantId, invoiceId, nip, userId) => {
  const res = await fetch(
    `${API_BASE}/api/v1/invoices/${invoiceId}/submit?nip=${encodeURIComponent(nip)}`,
    {
      method: 'POST',
      headers: buildHeaders(tenantId, userId),
    },
  );
  return checkResponse(res);
};

export const getInvoice = async (tenantId, invoiceId) => {
  const res = await fetch(`${API_BASE}/api/v1/invoices/${invoiceId}`, {
    headers: buildHeaders(tenantId),
  });
  return mapBackendInvoice(await checkResponse(res));
};

export const listInvoices = async (tenantId, status, page = 0, size = 100) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status && status !== 'ALL') params.set('status', status);

  const res = await fetch(`${API_BASE}/api/v1/invoices?${params}`, {
    headers: buildHeaders(tenantId),
  });
  const pageData = await checkResponse(res);
  return pageData.content.map(mapBackendInvoice);
};

const mapBackendAuditLog = (b) => ({
  id: b.id,
  timestamp: b.timestamp,
  tenantId: b.tenantId,
  userId: b.userId ?? '',
  userEmail: b.userEmail ?? 'system',
  userRole: b.userRole ?? '',
  action: b.action,
  targetEntityId: b.targetEntityId,
  targetEntityType: b.targetEntityType,
  oldValue: b.oldValue,
  newValue: b.newValue,
  ipAddress: b.ipAddress ?? '',
  complianceChecked: b.complianceChecked,
});

export const listAuditLogs = async (tenantId, params = {}) => {
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(params.page ?? 0));
  queryParams.set('size', String(params.size ?? 20));
  if (params.from)  queryParams.set('from', params.from);
  if (params.to)    queryParams.set('to', params.to);
  if (params.role && params.role !== 'ALL') queryParams.set('role', params.role);
  if (params.search) queryParams.set('search', params.search);

  const res = await fetch(`${API_BASE}/api/v1/audit-logs?${queryParams}`, {
    headers: buildHeaders(tenantId),
  });
  const pageData = await checkResponse(res);
  return {
    content: pageData.content.map(mapBackendAuditLog),
    totalElements: pageData.totalElements,
    totalPages: pageData.totalPages,
    size: pageData.size,
    number: pageData.number,
  };
};
