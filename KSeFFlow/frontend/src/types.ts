export type UserRole = 'Super Admin' | 'Company Admin' | 'Accountant' | 'Finance User' | 'Auditor';

export interface Tenant {
  id: string;
  name: string;
  nip: string; // Polish Tax ID (9 or 10 digits)
  address: string;
  postalCode: string;
  city: string;
  country: string;
  subscriptionPlan: 'Enterprise Tier' | 'High-Volume SaaS' | 'Compliance Essential';
  allowedRoles: UserRole[];
}

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING' | 'OFFLINE_MODE';

export interface InvoiceItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number; // net
  vatRate: '23' | '8' | '5' | '0' | 'exempt' | 'reverse_charge'; // Polish VAT standard percentages
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  tenantId: string;
  sellerName: string;
  sellerNIP: string;
  sellerAddress: string;
  buyerName: string;
  buyerNIP: string;
  buyerAddress: string;
  currency: 'PLN' | 'EUR' | 'USD';
  items: InvoiceItem[];
  totalNet: number;
  totalVat: number;
  totalGross: number;
  paymentMethod: 'Transfer' | 'Card' | 'Split Payment' | 'Cash';
  bankAccount: string;
  paymentStatus: 'PAID' | 'UNPAID';
  notes?: string;
  status: InvoiceStatus;
  ksefId?: string; // Official gov ID e.g., 5262319246-20260520-E45A17BD9C
  upoStatus?: 'NONE' | 'GENERATED' | 'RECEIVED' | 'VERIFIED';
  upoTimestamp?: string;
  offlineQrCode?: string; // Verification link/token for legal fallback
  submissionAttempts: number;
  lastErrorMessage?: string;
  createdAt: string;
}

export interface Certificate {
  id: string;
  tenantId: string;
  fileName: string;
  type: 'PFX' | 'PEM' | 'Trusted Profile';
  issuedTo: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  verificationStatus: 'VERIFIED' | 'EXPIRED' | 'REVOKED' | 'PENDING';
  lastAuthTime?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  ipAddress: string;
  oldValue?: string;
  newValue?: string;
  complianceChecked: boolean;
}

export interface Notification {
  id: string;
  tenantId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
  timestamp: string;
  read: boolean;
}

export interface GovernmentSession {
  isActive: boolean;
  environment: 'TEST' | 'PROD';
  sessionToken?: string;
  lastSyncTime?: string;
  healthStatus: 'UP' | 'DOWN' | 'SLOW';
}

export interface ApiLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  requestPayload: string;
  responsePayload: string;
}
