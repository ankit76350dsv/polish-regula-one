/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bell,
  Search,
  ChevronRight,
  Shield,
  HelpCircle,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface AppNavbarProps {
  id: string;
  currentRoute: string;
  onNavigate: (route: string) => void;
  userEmail: string;
  userRole: string;
  onMobileMenuToggle?: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  id,
  currentRoute,
  onNavigate,
  userEmail,
  userRole,
  onMobileMenuToggle,
  theme,
  setTheme,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Simulated breadcrumbs
  const getBreadcrumbs = () => {
    const parts = currentRoute.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'RegulaOne Hub', route: '/dashboard' }];

    let path = '';
    parts.forEach((part, index) => {
      path += `/${part}`;
      let name = part.charAt(0).toUpperCase() + part.slice(1);
      if (part === 'dpia') name = 'DPIA Protection';
      if (part === 'audits') name = 'Audit Logs';
      if (part === 'activities') name = 'Processing Records';
      breadcrumbs.push({ name, route: path });
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  // Highlight notifications
  const notifications = [
    {
      id: '1',
      title: 'DPIA Report Authorized',
      desc: 'ACT-002 face recognition biometric assessment was signed as High-Risk.',
      time: '15m ago',
      type: 'warning',
    },
    {
      id: '2',
      title: 'Consent Script Updated',
      desc: 'EU Customer Subprocessing Standard clauses template generated.',
      time: '2h ago',
      type: 'success',
    },
    {
      id: '3',
      title: 'Audit Trigger Watch',
      desc: 'Małgorzata Nowak (Auditor) requested full ROPA catalog download.',
      time: '1d ago',
      type: 'critical',
    },
  ];

  // Quick navigation search matches
  const searchResults = searchQuery
    ? [
        { name: 'Dashboard Analytics', route: '/dashboard', type: 'View' },
        { name: 'Processing Activity Directory', route: '/activities', type: 'Module' },
        { name: 'Create Processing ROPA Wizard', route: '/activities?action=create', type: 'Wizard' },
        { name: 'DPIA Risk Assessment', route: '/dpia', type: 'Review' },
        { name: 'Privacy Policy PDF Builder', route: '/privacy-policy', type: 'Tool' },
        { name: 'Document Vault Repository', route: '/documents', type: 'Storage' },
      ].filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <header
      id={id}
      className="bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-900 h-14 px-4.5 flex items-center justify-between sticky top-0 z-25 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      {/* Left Breadcrumb Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-250 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350"
        >
          <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-semibold">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-350 dark:text-slate-600" />}
                <button
                  onClick={() => onNavigate(crumb.route)}
                  disabled={isLast}
                  className={`transition-colors font-bold ${
                    isLast
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'hover:text-indigo-500 dark:hover:text-indigo-400 hover:underline cursor-pointer'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Right Search, Alert, Utility Controls */}
      <div className="flex items-center gap-4">
        {/* Global Nav Search */}
        <div className="relative hidden lg:block">
          <div className="absolute left-3 inset-y-0 flex items-center text-slate-450 dark:text-slate-500 pointer-events-none">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search activities, laws, documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className="text-xs w-64 bg-slate-100 dark:bg-slate-950/80 border border-transparent hover:border-slate-200 dark:hover:border-slate-800/80 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 rounded-lg pl-9 pr-3 py-2 text-slate-800 dark:text-slate-200 outline-hidden transition-all duration-200 focus:ring-4 focus:ring-indigo-500/5 focus:w-80"
          />

          {/* Search Dropdown matches */}
          {searchFocused && (searchQuery || searchResults.length > 0) && (
            <div className="absolute top-11 right-0 w-80 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-lg p-2.5 space-y-1 z-40">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-2.5 block mb-1">
                Matching Systems
              </span>
              {searchResults.length === 0 ? (
                <div className="text-[11px] text-slate-450 p-2.5 text-center">
                  No matching compliance records. Try 'ROPA' or 'DPIA'.
                </div>
              ) : (
                searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onNavigate(item.route);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center justify-between text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-250">
                      {item.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-950/80 text-slate-400 dark:text-slate-500 font-extrabold uppercase">
                      {item.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-1.5 rounded-md text-slate-500 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-800 dark:hover:text-slate-150 transition-colors cursor-pointer"
          title="Toggle compliance colorway theme"
        >
          {theme === 'light' ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14 12a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          )}
        </button>

        {/* Help System Badge */}
        <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-md text-[10px] text-slate-500 dark:text-slate-405 font-bold">
          <Shield className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
          <span>RODO SLA Stable</span>
        </div>

        {/* Notification Bell Badge */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 rounded-md text-slate-500 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-800 dark:hover:text-slate-150 transition-colors cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-500 ring-2 ring-white dark:ring-slate-950" />
          </button>

          {showNotifications && (
            <div className="absolute top-10 right-0 w-80 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-lg shadow-md overflow-hidden z-40">
              <div className="p-2.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Compliance Risk Warnings
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-600 dark:bg-indigo-505 text-white font-extrabold">
                  3 Alert
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-80 overflow-y-auto">
                {notifications.map((item) => (
                  <div key={item.id} className="p-3 hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors">
                    <div className="flex gap-2">
                      <div className="mt-0.5">
                        {item.type === 'warning' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        {item.type === 'success' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                        {item.type === 'critical' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-250 truncate">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                          {item.desc}
                        </p>
                        <span className="text-[10px] text-slate-400 font-medium block mt-1">
                          {item.time}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                onClick={() => {
                  onNavigate('/dpia');
                  setShowNotifications(false);
                }}
                className="p-2 bg-slate-50 dark:bg-slate-950/20 text-center border-t border-slate-200 dark:border-slate-800 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                Scan Comprehensive Risks
              </div>
            </div>
          )}
        </div>

        {/* User Workspace Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="h-7.5 w-7.5 rounded-md bg-indigo-50 dark:bg-indigo-950/45 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold tracking-tight text-xs">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div className="hidden xl:flex flex-col">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-150 leading-tight">
              {userEmail.split('@')[0]}
            </span>
            <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 leading-none">
              {userRole}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
