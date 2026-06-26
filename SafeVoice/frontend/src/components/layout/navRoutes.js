// Navigation link definitions, in one place so the sidebar, top navbar, and
// mobile menu stay in sync. `labelKey` is an i18n key translated at render time.
import { AlertOctagon, Home, Inbox, Settings, Shield, ShieldCheck, Terminal, UserCheck } from "lucide-react";

// Public links (no login). "Submit report" opens the anonymous portal in a new
// tab at /company/{tenantId}/report — clean of any staff session.
export const publicRoutes = [
  { labelKey: "nav.submitReport", path: "/report", icon: Shield, newTab: true },
  { labelKey: "nav.trackReport", path: "/track", icon: ShieldCheck },
];

// Staff-only links (behind the SSO AuthGate).
export const staffRoutes = [
  { labelKey: "nav.dashboard", path: "/dashboard", icon: Home },
  { labelKey: "nav.cases", path: "/cases", icon: AlertOctagon },
  { labelKey: "nav.inbox", path: "/messages", icon: Inbox, count: 2 },
  { labelKey: "nav.audit", path: "/audits", icon: Terminal },
  { labelKey: "nav.users", path: "/users", icon: UserCheck },
  { labelKey: "nav.settings", path: "/settings", icon: Settings },
];
