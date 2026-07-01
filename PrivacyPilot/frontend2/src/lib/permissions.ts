/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from '../types';

export interface NavItem {
  label: string;
  labelPl: string;
  hash: string;
  iconName: string;
}

export function getNavigationForRole(role: UserRole): NavItem[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        { label: 'Platform Overview', labelPl: 'Przegląd Platformy', hash: '#/super-admin', iconName: 'ShieldAlert' },
        { label: 'Tenants', labelPl: 'Klienci / Spółki', hash: '#/super-admin/tenants', iconName: 'Building2' },
        { label: 'SaaS Plans', labelPl: 'Plany Subskrypcji', hash: '#/super-admin/plans', iconName: 'CreditCard' },
        { label: 'Regulatory Templates', labelPl: 'Szablony RODO', hash: '#/super-admin/templates', iconName: 'FileStack' },
        { label: 'Feature Flags', labelPl: 'Flagi Funkcyjne', hash: '#/super-admin/feature-flags', iconName: 'ToggleRight' },
        { label: 'System Health', labelPl: 'Stan Systemu', hash: '#/super-admin/system-health', iconName: 'Activity' },
        { label: 'Support Queue', labelPl: 'Zgłoszenia Pomocy', hash: '#/super-admin/support', iconName: 'HelpCircle' },
        { label: 'Platform Audit Log', labelPl: 'Rejestr Zdarzeń', hash: '#/super-admin/audit-log', iconName: 'ListChecks' }
      ];

    case 'EXTERNAL_VENDOR':
      return [
        { label: 'Vendor Portal', labelPl: 'Portal Dostawcy', hash: '#/external/vendor/token-abc', iconName: 'FileCheck2' }
      ];

    case 'EXTERNAL_AUDITOR':
      return [
        { label: 'Auditor Snapshot', labelPl: 'Migawka Audytu', hash: '#/external/audit/token-xyz', iconName: 'Eye' }
      ];

    case 'EXTERNAL_SUBJECT':
      return [
        { label: 'Privacy Portal', labelPl: 'Portal Prywatności', hash: '#/privacy-portal/request', iconName: 'UserCheck' },
        { label: 'Check Status', labelPl: 'Sprawdź Status', hash: '#/privacy-portal/status/dsar-523', iconName: 'Clock' }
      ];

    case 'EMPLOYEE':
      return [
        { label: 'My Dashboard', labelPl: 'Mój Panel', hash: '#/app/dashboard', iconName: 'Home' },
        { label: 'Assigned Tasks', labelPl: 'Zadania', hash: '#/app/tasks', iconName: 'CheckSquare' },
        { label: 'Report Incident', labelPl: 'Zgłoś Naruszenie', hash: '#/app/incidents/new', iconName: 'AlertOctagon' },
        { label: 'My Requests', labelPl: 'Moje Wnioski', hash: '#/privacy-portal/request', iconName: 'Send' }
      ];

    case 'MANAGER':
      return [
        { label: 'HR Dashboard', labelPl: 'Panel Departamentu', hash: '#/app/dashboard', iconName: 'Home' },
        { label: 'Processing Activities', labelPl: 'Czynności (ROPA)', hash: '#/app/activities', iconName: 'FolderKanban' },
        { label: 'Assigned Tasks', labelPl: 'Zadania', hash: '#/app/tasks', iconName: 'CheckSquare' },
        { label: 'Analytics Reports', labelPl: 'Raporty i Analizy', hash: '#/app/reports', iconName: 'PieChart' }
      ];

    default: // TENANT_ADMIN, COMPLIANCE_OFFICER, DPO, LEGAL, AUDITOR
      const items = [
        { label: 'Dashboard', labelPl: 'Panel Główny', hash: '#/app/dashboard', iconName: 'Home' },
        { label: 'ROPA Register', labelPl: 'Rejestr RCP (Art. 30)', hash: '#/app/activities', iconName: 'FolderKanban' },
        { label: 'DPIA Workspace', labelPl: 'Analizy DPIA', hash: '#/app/dpia', iconName: 'Scale' },
        { label: 'Risk Register', labelPl: 'Rejestr Ryzyk', hash: '#/app/risks', iconName: 'ShieldAlert' },
        { label: 'Processors & Vendors', labelPl: 'Procesorzy / Dostawcy', hash: '#/app/vendors', iconName: 'Users' },
        { label: 'Intl Transfers', labelPl: 'Transfery Danych', hash: '#/app/transfers', iconName: 'Globe' },
        { label: 'Breach Register', labelPl: 'Rejestr Naruszeń', hash: '#/app/incidents', iconName: 'Skull' },
        { label: 'Subject Requests (DSR)', labelPl: 'Wnioski Podmiotów', hash: '#/app/requests', iconName: 'UserCheck' },
        { label: 'Audits & Evidence', labelPl: 'Audyty i Dowody', hash: '#/app/audits', iconName: 'FileStack' },
        { label: 'Compliance Reports', labelPl: 'Raporty Zgodności', hash: '#/app/reports', iconName: 'BarChart3' },
        { label: 'Task Center', labelPl: 'Centrum Zadań', hash: '#/app/tasks', iconName: 'CheckSquare' },
        { label: 'Documents Library', labelPl: 'Szablony / Pliki', hash: '#/app/documents', iconName: 'Files' }
      ];

      // Exclude settings for non-admin/officer roles to secure setup
      if (role === 'TENANT_ADMIN' || role === 'COMPLIANCE_OFFICER') {
        items.push({ label: 'Settings', labelPl: 'Ustawienia RODO', hash: '#/app/settings', iconName: 'Settings' });
      }

      return items;
  }
}

export function canPerformAction(role: UserRole, action: 'CREATE_ROPA' | 'APPROVE_ROPA' | 'DELETE_ROPA' | 'EDIT_SETTINGS' | 'ACCESS_SUPER_ADMIN' | 'TRIGGER_BREACH_NOTIFICATION'): boolean {
  if (role === 'SUPER_ADMIN') {
    return action === 'ACCESS_SUPER_ADMIN';
  }

  switch (action) {
    case 'CREATE_ROPA':
      return ['TENANT_ADMIN', 'COMPLIANCE_OFFICER', 'MANAGER'].includes(role);
    case 'APPROVE_ROPA':
      return ['TENANT_ADMIN', 'DPO', 'LEGAL'].includes(role);
    case 'DELETE_ROPA':
      return ['TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(role);
    case 'EDIT_SETTINGS':
      return ['TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(role);
    case 'TRIGGER_BREACH_NOTIFICATION':
      return ['TENANT_ADMIN', 'COMPLIANCE_OFFICER', 'DPO'].includes(role);
    default:
      return false;
  }
}
