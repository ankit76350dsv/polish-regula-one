// ── KSeFFlow navigation config ────────────────────────────────────────────────
// This file keeps the list of app sections in ONE place so three different parts
// of the UI never drift out of sync:
//   1. App.jsx          → decides if a URL is a known route.
//   2. Sidebar.jsx      → draws the left-hand menu (and the little lock icon).
//   3. WorkspaceContent → shows a "403" screen when a role opens a forbidden page.
//
// Keeping it here means: add a section once, and every part below knows about it.

import {
  LayoutDashboard,
  FileEdit,
  FolderSearch,
  Inbox,
  KeyRound,
  AlertTriangle,
  Cpu,
  ShieldCheck,
  BookOpen,
  Bell,
} from 'lucide-react';

// Which roles are allowed to open each section.
// If a role is NOT in the list, the sidebar shows a lock and the page shows a 403.
export const PAGE_ROLES_REQUIRED = {
  dashboard:        ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
  create:           ['Super Admin', 'Company Admin', 'Accountant'],
  invoices:         ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
  'invoice-detail': ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
  received:         ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
  permissions:      ['Super Admin', 'Company Admin'],
  offline:          ['Super Admin', 'Company Admin', 'Accountant'],
  integration:      ['Super Admin', 'Company Admin'],
  certificates:     ['Super Admin', 'Company Admin', 'Accountant'],
  audit:            ['Super Admin', 'Company Admin', 'Auditor'],
  notifications:    ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
  profile:          ['Super Admin', 'Company Admin', 'Accountant', 'Finance User', 'Auditor'],
};

// The ordered list of links drawn in the sidebar.
//   section  → the URL segment and the key used in PAGE_ROLES_REQUIRED.
//   labelKey → translation key for the link text (null = label handled inline).
//   Icon     → the lucide icon component for the link.
//   badge    → name of a live counter the sidebar knows how to show:
//                'offline'  → number of invoices stuck in the offline queue.
//                'hubUnread'→ number of unread notifications.
export const NAV_ITEMS = [
  { section: 'dashboard',     labelKey: 'sidebar.dashboard',        Icon: LayoutDashboard },
  { section: 'create',        labelKey: 'sidebar.createInvoice',    Icon: FileEdit },
  { section: 'invoices',      labelKey: 'sidebar.repository',       Icon: FolderSearch },
  { section: 'received',      labelKey: 'sidebar.receivedInvoices', Icon: Inbox },
  { section: 'permissions',   labelKey: 'sidebar.permissions',      Icon: KeyRound },
  { section: 'offline',       labelKey: 'sidebar.offlineQueue',     Icon: AlertTriangle, badge: 'offline' },
  { section: 'integration',   labelKey: 'sidebar.apiCenter',        Icon: Cpu },
  { section: 'certificates',  labelKey: 'sidebar.certificates',     Icon: ShieldCheck },
  { section: 'audit',         labelKey: 'sidebar.auditCenter',      Icon: BookOpen },
  // Notifications has no sidebar translation key, so its label is resolved inline.
  { section: 'notifications', labelKey: null,                       Icon: Bell, badge: 'hubUnread' },
];
