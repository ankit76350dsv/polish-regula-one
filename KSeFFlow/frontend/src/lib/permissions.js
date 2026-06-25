// ── KSeF permission helpers (frontend mirror of the backend) ──────────────────
// SIMPLE EXPLANATION:
// The backend now allows or blocks each API based on KSeF permission codes that
// the logged-in user holds (it sends them in /api/auth/me as `permissions: []`).
// This file lets the UI ask the SAME question the backend asks, so we can hide or
// disable a button when the user would just get a 403 anyway. The backend is still
// the real guard — this only makes the screen match what the user can actually do.
//
// The codes MUST match the backend enum com.ksefflow.backend.security.KsefPermission.

export const KSEF = {
  // Platform-level operator (the SaaS operator, NOT a tenant). Only this code may declare the
  // GLOBAL KSeF emergency/unavailability state — granted only to the operator's own account.
  PLATFORM_ADMIN:     'KSEF_PLATFORM_ADMIN',
  TENANT_ADMIN:       'KSEF_TENANT_ADMIN',
  CASE_MANAGER:       'KSEF_CASE_MANAGER',
  COMPLIANCE_OFFICER: 'KSEF_COMPLIANCE_OFFICER',
  AUDITOR:            'KSEF_AUDITOR',
  EMPLOYEE:           'KSEF_EMPLOYEE',
};

// True if the user's permission list contains AT LEAST ONE of the given codes.
// Mirrors AuthenticatedUser.requireAnyPermission(...) on the backend.
export function hasAnyPermission(permissions, ...codes) {
  if (!Array.isArray(permissions)) return false;
  return codes.some((c) => permissions.includes(c));
}

// Capability checks — each one lists exactly the permissions the matching backend
// endpoint accepts, so the UI gate and the API guard never disagree.
export const can = {
  // POST /invoices/draft|submit|correct, POST /received-invoices/sync
  issueInvoices: (p) => hasAnyPermission(p, KSEF.TENANT_ADMIN, KSEF.CASE_MANAGER),

  // GET /invoices, GET /received-invoices
  readInvoices: (p) =>
    hasAnyPermission(p, KSEF.TENANT_ADMIN, KSEF.CASE_MANAGER, KSEF.COMPLIANCE_OFFICER, KSEF.AUDITOR),

  // POST /certificates/upload|enroll, PATCH /certificates/{id}/deactivate
  manageCertificates: (p) => hasAnyPermission(p, KSEF.TENANT_ADMIN),

  // GET /certificates
  readCertificates: (p) => hasAnyPermission(p, KSEF.TENANT_ADMIN, KSEF.AUDITOR),

  // POST /ksef-status/emergency|unavailability|online
  // Platform-operator only — this is a GLOBAL state shared by all tenants, so a tenant admin
  // must NOT be able to declare it (matches the KSEF_PLATFORM_ADMIN backend guard).
  manageAvailability: (p) => hasAnyPermission(p, KSEF.PLATFORM_ADMIN),

  // POST /permissions/persons/grants, DELETE /permissions/{id}
  managePermissions: (p) => hasAnyPermission(p, KSEF.TENANT_ADMIN),

  // POST /permissions/query, GET /permissions/operations/{ref}
  readPermissions: (p) =>
    hasAnyPermission(p, KSEF.TENANT_ADMIN, KSEF.COMPLIANCE_OFFICER, KSEF.AUDITOR),

  // GET /audit-logs
  readAuditLogs: (p) =>
    hasAnyPermission(p, KSEF.TENANT_ADMIN, KSEF.AUDITOR, KSEF.COMPLIANCE_OFFICER),
};
