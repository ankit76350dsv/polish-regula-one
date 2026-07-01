/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tenant, User, Activity, DPIA, Risk, Vendor, Transfer, Incident, DSARRequest, Audit, Task, Notification, SupportTicket } from '../types';
import {
  MOCK_TENANTS,
  MOCK_USERS,
  MOCK_ACTIVITIES,
  MOCK_DPIAS,
  MOCK_RISKS,
  MOCK_VENDORS,
  MOCK_TRANSFERS,
  MOCK_INCIDENTS,
  MOCK_REQUESTS,
  MOCK_AUDITS,
  MOCK_TASKS,
  MOCK_NOTIFICATIONS,
  MOCK_TICKETS,
  PLATFORM_AUDIT_LOGS
} from './mock-data';

// LocalStorage Persistence Helpers
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(`privacypilot_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error loading from storage', error);
    return defaultValue;
  }
};

const saveToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(`privacypilot_${key}`, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to storage', error);
  }
};

// Initial state loading
export const getInitialData = () => {
  const tenants = loadFromStorage<Tenant[]>('tenants', MOCK_TENANTS);
  const users = loadFromStorage<User[]>('users', MOCK_USERS);
  const activities = loadFromStorage<Activity[]>('activities', MOCK_ACTIVITIES);
  const dpias = loadFromStorage<DPIA[]>('dpias', MOCK_DPIAS);
  const risks = loadFromStorage<Risk[]>('risks', MOCK_RISKS);
  const vendors = loadFromStorage<Vendor[]>('vendors', MOCK_VENDORS);
  const transfers = loadFromStorage<Transfer[]>('transfers', MOCK_TRANSFERS);
  const incidents = loadFromStorage<Incident[]>('incidents', MOCK_INCIDENTS);
  const requests = loadFromStorage<DSARRequest[]>('requests', MOCK_REQUESTS);
  const audits = loadFromStorage<Audit[]>('audits', MOCK_AUDITS);
  const tasks = loadFromStorage<Task[]>('tasks', MOCK_TASKS);
  const notifications = loadFromStorage<Notification[]>('notifications', MOCK_NOTIFICATIONS);
  const tickets = loadFromStorage<SupportTicket[]>('tickets', MOCK_TICKETS);
  const platformLogs = loadFromStorage('platformLogs', PLATFORM_AUDIT_LOGS);

  // Settings
  const selectedTenantId = loadFromStorage<string>('selected_tenant_id', 'tenant-1');
  const activeRole = loadFromStorage<string>('selected_role', 'COMPLIANCE_OFFICER');
  const currentLanguage = loadFromStorage<'en' | 'pl'>('lang', 'pl'); // default pl as target is first Poland

  return {
    tenants,
    users,
    activities,
    dpias,
    risks,
    vendors,
    transfers,
    incidents,
    requests,
    audits,
    tasks,
    notifications,
    tickets,
    platformLogs,
    selectedTenantId,
    activeRole,
    currentLanguage
  };
};

export const persistAppState = (state: ReturnType<typeof getInitialData>) => {
  saveToStorage('tenants', state.tenants);
  saveToStorage('users', state.users);
  saveToStorage('activities', state.activities);
  saveToStorage('dpias', state.dpias);
  saveToStorage('risks', state.risks);
  saveToStorage('vendors', state.vendors);
  saveToStorage('transfers', state.transfers);
  saveToStorage('incidents', state.incidents);
  saveToStorage('requests', state.requests);
  saveToStorage('audits', state.audits);
  saveToStorage('tasks', state.tasks);
  saveToStorage('notifications', state.notifications);
  saveToStorage('tickets', state.tickets);
  saveToStorage('platformLogs', state.platformLogs);
  saveToStorage('selected_tenant_id', state.selectedTenantId);
  saveToStorage('selected_role', state.activeRole);
  saveToStorage('lang', state.currentLanguage);
};

// Simulate Network Delay Helper
export const simulateApiCall = <T>(result: T, delayMs = 400): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, delayMs);
  });
};
