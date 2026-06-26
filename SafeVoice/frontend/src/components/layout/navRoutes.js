// This file holds the lists of links shown in the SafeVoice navigation.
// We keep them here in one place so the sidebar, top navbar, and mobile menu
// all read from the same source. If a link needs to change, we change it once.
import {
  AlertOctagon,
  Home,
  Inbox,
  Settings,
  Shield,
  ShieldCheck,
  Terminal,
  UserCheck,
} from "lucide-react";

// Links that anyone can use (no login needed): send a report or track one.
// "Submit report" has newTab: true so it opens the anonymous report page in its
// own tab at /company/{tenantId}/report — clean of any navbar or staff session.
export const publicRoutes = [
  { label: "Submit report", path: "/report", icon: Shield, newTab: true },
  { label: "Track report", path: "/track", icon: ShieldCheck },
];

// Links only for authorized staff who handle the reports.
export const staffRoutes = [
  { label: "Case operations", path: "/dashboard", icon: Home },
  { label: "Case register", path: "/cases", icon: AlertOctagon },
  { label: "Secure inbox", path: "/messages", icon: Inbox, count: 2 },
  { label: "Audit trail", path: "/audits", icon: Terminal },
  { label: "Access controls", path: "/users", icon: UserCheck },
  { label: "Compliance settings", path: "/settings", icon: Settings },
];
