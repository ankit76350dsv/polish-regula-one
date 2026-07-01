/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './lib/app-context';
import { AppShell } from './layouts/AppShell';

// Import Views
import { LoginView } from './features/auth/AuthViews';
import { OnboardingView } from './features/onboarding/OnboardingView';
import { DashboardView } from './features/dashboard/DashboardViews';
import {
  ActivitiesRegisterView,
  ActivityWizardView,
  ActivityDetailView
} from './features/activities/ActivitiesViews';
import { DpiaCenterView } from './features/dpia/DpiaViews';
import { VendorsInventoryView, ExternalVendorPortalView } from './features/vendors/VendorsViews';
import { IncidentsCenterView } from './features/incidents/IncidentsViews';
import { RequestsQueueView } from './features/requests/RequestsViews';
import { AuditsCenterView } from './features/audits/AuditsViews';
import { TasksCenterView } from './features/tasks/TasksViews';
import { SettingsViews } from './features/settings/SettingsViews';
import { SuperAdminViews } from './features/super-admin/SuperAdminViews';

const AppRouter: React.FC = () => {
  const { currentHash } = useApp();

  // Route resolver helper
  const renderRoute = () => {
    // 1. Unauthenticated / Standalone Routes
    if (currentHash === '#/login' || currentHash === '' || currentHash === '#/') {
      return <LoginView />;
    }
    if (currentHash === '#/onboarding') {
      return <OnboardingView />;
    }
    if (currentHash.startsWith('#/external/vendor')) {
      return (
        <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
          <ExternalVendorPortalView />
        </div>
      );
    }

    // 2. Authenticated Routes (Wrapped in master layout Shell)
    if (currentHash.startsWith('#/app')) {
      const appSubPath = currentHash.replace('#/app', '');

      let childView = <DashboardView />;

      if (appSubPath === '/dashboard' || appSubPath === '') {
        childView = <DashboardView />;
      } else if (appSubPath === '/activities') {
        childView = <ActivitiesRegisterView />;
      } else if (appSubPath === '/activities/new') {
        childView = <ActivityWizardView />;
      } else if (appSubPath.startsWith('/activities/')) {
        const id = appSubPath.replace('/activities/', '');
        childView = <ActivityDetailView id={id} />;
      } else if (appSubPath === '/dpia') {
        childView = <DpiaCenterView />;
      } else if (appSubPath === '/vendors') {
        childView = <VendorsInventoryView />;
      } else if (appSubPath === '/incidents') {
        childView = <IncidentsCenterView />;
      } else if (appSubPath === '/requests') {
        childView = <RequestsQueueView />;
      } else if (appSubPath === '/audits') {
        childView = <AuditsCenterView />;
      } else if (appSubPath === '/tasks') {
        childView = <TasksCenterView />;
      } else if (appSubPath === '/settings') {
        childView = <SettingsViews />;
      } else if (appSubPath === '/super-admin') {
        childView = <SuperAdminViews />;
      }

      return <AppShell>{childView}</AppShell>;
    }

    // Fallback default
    return <LoginView />;
  };

  return <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">{renderRoute()}</div>;
};

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
