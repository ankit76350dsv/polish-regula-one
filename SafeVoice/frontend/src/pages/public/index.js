// Public pages — anyone can reach these WITHOUT logging in.
// The anonymous whistleblower journey: submit a report, see the success screen
// (tracking code + PIN), and track an existing case by code + PIN. Plus the
// public landing page (the app's front door) and the invalid-tenant guard page.
export { default as LandingPage } from "./LandingPage.jsx";
export { default as PublicReportPortal } from "./PublicReportPortal.jsx";
export { default as ReportSuccessPage } from "./ReportSuccessPage.jsx";
export { default as TrackCasePage } from "./TrackCasePage.jsx";
export { default as InvalidTenantPage } from "./InvalidTenantPage.jsx";

// Shared chrome for the public pages (used by PublicLayout and the landing page).
export { PublicHeader } from "./PublicHeader.jsx";
export { PublicFooter } from "./PublicFooter.jsx";
