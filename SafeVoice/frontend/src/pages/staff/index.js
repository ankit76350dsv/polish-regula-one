// Staff pages — the gated workspace for authorized case handlers.
// Every page here sits behind the SSO AuthGate (see components/auth) and shows
// whistleblower case data, so it must never be reachable without a session.
export { default as AdminDashboardPage } from "./AdminDashboardPage.jsx";
export { default as CaseManagementPage } from "./CaseManagementPage.jsx";
export { default as CaseDetailsPage } from "./CaseDetailsPage.jsx";
export { default as CentralEncryptedInboxPage } from "./CentralEncryptedInboxPage.jsx";
export { default as SecurityAuditTrailLogsPage } from "./SecurityAuditTrailLogsPage.jsx";
export { default as UsersPermissionsMatrixPage } from "./UsersPermissionsMatrixPage.jsx";
export { default as ComplianceSettingsPage } from "./ComplianceSettingsPage.jsx";
