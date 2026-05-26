import { Invoice, InvoiceItem } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8081';

// ── Enum value mappings ───────────────────────────────────────────────────────
// The backend uses Java enum names (VAT_23, TRANSFER, etc.) while the frontend
// uses human-readable codes ('23', 'Transfer', etc.).

const vatRateToBackend = (rate: string): string => {
  const map: Record<string, string> = {
    '23': 'VAT_23',
    '8': 'VAT_8',
    '5': 'VAT_5',
    '0': 'VAT_0',
    'exempt': 'EXEMPT',
    'reverse_charge': 'REVERSE_CHARGE',
  };
  return map[rate] ?? 'VAT_23';
};

const vatRateFromBackend = (rate: string): InvoiceItem['vatRate'] => {
  const map: Record<string, InvoiceItem['vatRate']> = {
    'VAT_23': '23',
    'VAT_8': '8',
    'VAT_5': '5',
    'VAT_0': '0',
    'EXEMPT': 'exempt',
    'REVERSE_CHARGE': 'reverse_charge',
  };
  return map[rate] ?? '23';
};

const paymentMethodToBackend = (method: string): string => {
  const map: Record<string, string> = {
    'Transfer': 'TRANSFER',
    'Card': 'CARD',
    'Split Payment': 'SPLIT_PAYMENT',
    'Cash': 'CASH',
  };
  return map[method] ?? 'TRANSFER';
};

const paymentMethodFromBackend = (method: string): Invoice['paymentMethod'] => {
  const map: Record<string, Invoice['paymentMethod']> = {
    'TRANSFER': 'Transfer',
    'CARD': 'Card',
    'SPLIT_PAYMENT': 'Split Payment',
    'CASH': 'Cash',
  };
  return map[method] ?? 'Transfer';
};

// Parse combined buyer address "Al. Jerozolimskie 22, 00-345 Warszawa"
// into the separate fields required by the backend DTO.
const parseBuyerAddress = (combined: string) => {
  const postalMatch = combined.match(/(\d{2}-\d{3})\s+(.+?)(?:,\s*.*)?$/);
  if (postalMatch) {
    const postalCode = postalMatch[1];
    const city = postalMatch[2].trim();
    const street = combined.slice(0, combined.lastIndexOf(postalMatch[0])).replace(/,\s*$/, '').trim();
    return { street: street || combined, postalCode, city };
  }
  return { street: combined, postalCode: '00-001', city: 'Warszawa' };
};

// ── Backend DTO types (what the API sends and receives) ───────────────────────

interface BackendInvoiceItem {
  itemId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  unit?: string;
  pkwiuCode?: string;
}

interface BackendInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  sellerName: string;
  sellerNip: string;
  sellerAddress: string;
  sellerPostalCode: string;
  sellerCity: string;
  buyerName: string;
  buyerNip: string;
  buyerAddress: string;
  buyerPostalCode: string;
  buyerCity: string;
  currency: 'PLN' | 'EUR' | 'USD';
  items: BackendInvoiceItem[];
  totalNet: number;
  totalVat: number;
  totalGross: number;
  paymentMethod: string;
  paymentStatus: string;
  bankAccount?: string;
  notes?: string;
  status: string;
  ksefId?: string;
  upoStatus: string;
  upoTimestamp?: string;
  upoDocumentId?: string;
  offlineQrCode?: string;
  submissionAttempts: number;
  lastErrorMessage?: string;
  createdAt: string;
}

interface BackendSubmitResponse {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  ksefId?: string;
  upoDocumentId?: string;
  offlineQrCode?: string;
  message: string;
  submittedAt: string;
  environment: string;
}

interface BackendPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ── Mapper: backend KsefInvoice → frontend Invoice ────────────────────────────

export const mapBackendInvoice = (b: BackendInvoice): Invoice => ({
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
  status: b.status as Invoice['status'],
  ksefId: b.ksefId,
  upoStatus: (b.upoStatus as Invoice['upoStatus']) ?? 'NONE',
  upoTimestamp: b.upoTimestamp,
  offlineQrCode: b.offlineQrCode,
  submissionAttempts: b.submissionAttempts ?? 0,
  lastErrorMessage: b.lastErrorMessage,
  createdAt: b.createdAt,
});

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const buildHeaders = (tenantId: string, userId?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Tenant-Id': tenantId,
  ...(userId ? { 'X-User-Id': userId } : {}),
});

const checkResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
};

// ── Public API functions ──────────────────────────────────────────────────────

export interface CreateInvoicePayload {
  tenantId: string;
  userId?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  sellerName: string;
  sellerNip: string;
  sellerAddress: string;
  sellerPostalCode: string;
  sellerCity: string;
  buyerName: string;
  buyerNip: string;
  buyerAddress: string;  // combined string — will be parsed here
  currency: string;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  paymentMethod: string;  // frontend label, mapped to backend enum
  bankAccount?: string;
  notes?: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    vatRate: string;  // frontend code, mapped to backend enum
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
  }>;
}

export const createInvoice = async (payload: CreateInvoicePayload): Promise<Invoice> => {
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

  return mapBackendInvoice(await checkResponse<BackendInvoice>(res));
};

export const submitInvoice = async (
  tenantId: string,
  invoiceId: string,
  nip: string,
  userId?: string,
): Promise<BackendSubmitResponse> => {
  const res = await fetch(
    `${API_BASE}/api/v1/invoices/${invoiceId}/submit?nip=${encodeURIComponent(nip)}`,
    {
      method: 'POST',
      headers: buildHeaders(tenantId, userId),
    },
  );
  return checkResponse<BackendSubmitResponse>(res);
};

export const getInvoice = async (tenantId: string, invoiceId: string): Promise<Invoice> => {
  const res = await fetch(`${API_BASE}/api/v1/invoices/${invoiceId}`, {
    headers: buildHeaders(tenantId),
  });
  return mapBackendInvoice(await checkResponse<BackendInvoice>(res));
};

export const listInvoices = async (
  tenantId: string,
  status?: string,
  page = 0,
  size = 100,
): Promise<Invoice[]> => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status && status !== 'ALL') params.set('status', status);

  const res = await fetch(`${API_BASE}/api/v1/invoices?${params}`, {
    headers: buildHeaders(tenantId),
  });
  const pageData = await checkResponse<BackendPage<BackendInvoice>>(res);
  return pageData.content.map(mapBackendInvoice);
};
