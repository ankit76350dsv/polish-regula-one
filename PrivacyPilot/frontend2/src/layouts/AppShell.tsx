/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../lib/app-context';
import { getNavigationForRole } from '../lib/permissions';
import { ComplianceIcon } from '../components/common/icons';
import { UserRole } from '../types';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentHash,
    navigateTo,
    activeRole,
    switchRole,
    selectedTenantId,
    switchTenant,
    tenants,
    currentLanguage,
    switchLanguage,
    toasts,
    notifications,
    markNotificationsAsRead,
    showCommandPalette,
    setShowCommandPalette,
    showNotificationDrawer,
    setShowNotificationDrawer,
    activities,
    vendors,
    incidents,
    requests
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Command palette keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(!showCommandPalette);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette]);

  const navigation = getNavigationForRole(activeRole);
  const activeTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filtered search items for command palette
  const searchResults = searchQuery.trim() === '' ? [] : [
    ...activities.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())).map(a => ({ title: a.name, category: 'ROPA Register', hash: `#/app/activities/${a.id}` })),
    ...vendors.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase())).map(v => ({ title: v.name, category: 'Processor/Vendor', hash: `#/app/vendors/${v.id}` })),
    ...incidents.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase())).map(i => ({ title: i.title, category: 'Breach Incident', hash: `#/app/incidents/${i.id}` })),
    ...requests.filter(r => r.requesterName.toLowerCase().includes(searchQuery.toLowerCase())).map(r => ({ title: `DSAR: ${r.requesterName}`, category: 'Subject Request', hash: `#/app/requests/${r.id}` }))
  ].slice(0, 5);

  const roleLabels: Record<UserRole, { en: string; pl: string; color: string }> = {
    SUPER_ADMIN: { en: 'Platform Super Admin', pl: 'Super Administrator', color: 'bg-purple-600 text-white' },
    TENANT_ADMIN: { en: 'Tenant Admin (CEO/Owner)', pl: 'Administrator Spółki', color: 'bg-indigo-600 text-white' },
    COMPLIANCE_OFFICER: { en: 'Compliance Officer (DPO Deputy)', pl: 'Specjalista ds. Zgodności', color: 'bg-blue-600 text-white' },
    DPO: { en: 'DPO / IOD (Inspector)', pl: 'Inspektor Ochrony Danych', color: 'bg-teal-600 text-white' },
    MANAGER: { en: 'Department Manager (HR/IT)', pl: 'Kierownik Działu', color: 'bg-orange-600 text-white' },
    EMPLOYEE: { en: 'General Employee', pl: 'Pracownik', color: 'bg-slate-600 text-white' },
    AUDITOR: { en: 'Auditor (Internal/External)', pl: 'Audytor RODO', color: 'bg-yellow-600 text-black' },
    LEGAL: { en: 'Legal Counsel (DPA Advisor)', pl: 'Radca Prawny', color: 'bg-pink-600 text-white' },
    EXTERNAL_VENDOR: { en: 'External Processor / Vendor', pl: 'Podmiot Przetwarzający (Dostawca)', color: 'bg-cyan-600 text-white' },
    EXTERNAL_AUDITOR: { en: 'External Auditor', pl: 'Zewnętrzny Audytor', color: 'bg-emerald-600 text-white' },
    EXTERNAL_SUBJECT: { en: 'External Data Subject', pl: 'Klient (Wnioskodawca)', color: 'bg-gray-700 text-white' }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row antialiased">
      
      {/* 1. SIDEBAR - Desktop and Tablet */}
      <aside className="hidden md:flex flex-col w-64 bg-[#161618] text-slate-300 border-r border-[#2A2A2C] shrink-0">
        
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-[#2A2A2C] bg-[#0A0A0B] gap-3">
          <div className="p-1.5 bg-[#C5A059] text-[#0A0A0B] rounded-xs flex items-center justify-center">
            <ComplianceIcon name="Shield" size={18} />
          </div>
          <div>
            <h1 className="text-sm font-light tracking-[0.22em] text-[#C5A059] uppercase">{currentLanguage === 'pl' ? 'PrivacyPilot' : 'PrivacyPilot'}</h1>
            <p className="text-[9px] text-[#8E8E93] font-mono tracking-widest uppercase">
              {currentLanguage === 'pl' ? 'Zgodność RODO' : 'Compliance Hub'}
            </p>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          <p className="text-[9px] text-[#8E8E93] font-bold uppercase px-3 mb-2 tracking-widest">
            {currentLanguage === 'pl' ? 'Rejestry' : 'REGISTRIES'}
          </p>
          {navigation.map((item) => {
            const isActive = currentHash.startsWith(item.hash);
            return (
              <button
                key={item.hash}
                id={`sidebar-nav-${item.hash.replace('#/', '').replace(/\//g, '-')}`}
                onClick={() => {
                  navigateTo(item.hash);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center px-3 py-2 text-xs font-medium transition-all gap-3 ${
                  isActive
                    ? 'bg-[#2A2A2C] text-[#C5A059] font-bold border-l-2 border-[#C5A059] rounded-none'
                    : 'text-slate-400 hover:bg-[#2A2A2C]/40 hover:text-white rounded-xs'
                }`}
              >
                <ComplianceIcon name={item.iconName} size={15} />
                <span className="tracking-wide">{currentLanguage === 'pl' ? item.labelPl : item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* App Footer */}
        <div className="p-4 border-t border-[#2A2A2C] bg-[#0A0A0B] text-[#8E8E93]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400">EU-Frankfurt Node</p>
          </div>
          <p className="text-[9px] mt-1 text-[#8E8E93] leading-tight">
            {currentLanguage === 'pl' ? 'Sovereign GDPR • AES-256 Active' : 'Sovereign GDPR • AES-256 Active'}
          </p>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-xs gap-3 shrink-0">
          
          {/* Left: Mobile menu toggle and dynamic context info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 md:hidden hover:bg-slate-100 rounded text-slate-600"
            >
              <ComplianceIcon name="Menu" size={20} />
            </button>
            
            {/* Tenant Selection Dropdown */}
            {activeRole !== 'SUPER_ADMIN' ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs hidden sm:inline">
                  {currentLanguage === 'pl' ? 'Podmiot:' : 'Tenant:'}
                </span>
                <select
                  value={selectedTenantId}
                  onChange={(e) => switchTenant(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <span className="hidden lg:inline text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">
                  {activeTenant.dataResidencyRegion.split(' ')[0]} Region
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-1 rounded">
                  ★ {currentLanguage === 'pl' ? 'WŁAŚCICIEL PLATFORMY' : 'PLATFORM OPERATOR'}
                </span>
              </div>
            )}
          </div>

          {/* Right: Search, Language, Role Switcher, Notifications, User */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            
            {/* Search command bar trigger */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-xs text-slate-500 transition-colors"
            >
              <ComplianceIcon name="Search" size={14} />
              <span>{currentLanguage === 'pl' ? 'Szukaj... (Ctrl+K)' : 'Search... (Ctrl+K)'}</span>
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => switchLanguage(currentLanguage === 'en' ? 'pl' : 'en')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold rounded text-slate-800 cursor-pointer"
              title={currentLanguage === 'en' ? 'Zmień na język Polski' : 'Switch to English'}
            >
              {currentLanguage === 'en' ? 'PL 🇵🇱' : 'EN 🇬🇧'}
            </button>

            {/* DEMO ROLE SWITCHER dropdown */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded px-1.5 py-1 gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold hidden xl:inline px-1">
                {currentLanguage === 'pl' ? 'Symuluj rolę:' : 'Simulate Role:'}
              </span>
              <select
                value={activeRole}
                onChange={(e) => {
                  const r = e.target.value as UserRole;
                  switchRole(r);
                  // Redirect appropriately
                  if (r === 'SUPER_ADMIN') {
                    navigateTo('#/super-admin');
                  } else if (r === 'EXTERNAL_VENDOR') {
                    navigateTo('#/external/vendor/token-abc');
                  } else if (r === 'EXTERNAL_AUDITOR') {
                    navigateTo('#/external/audit/token-xyz');
                  } else if (r === 'EXTERNAL_SUBJECT') {
                    navigateTo('#/privacy-portal/request');
                  } else {
                    navigateTo('#/app/dashboard');
                  }
                }}
                className={`text-xs font-bold border-none rounded px-2 py-0.5 focus:outline-none cursor-pointer ${roleLabels[activeRole].color}`}
              >
                {Object.entries(roleLabels).map(([key, item]) => (
                  <option key={key} value={key} className="bg-white text-slate-900 font-normal">
                    {currentLanguage === 'pl' ? item.pl : item.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Notification trigger */}
            <button
              onClick={() => setShowNotificationDrawer(true)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 relative cursor-pointer"
            >
              <ComplianceIcon name="Bell" size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-bounce" />
              )}
            </button>

            {/* Current user avatar with tooltips */}
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&fit=crop&q=80"
                alt="User profile"
                className="w-8 h-8 rounded-full border border-slate-300 shadow-sm"
              />
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-3">Karolina Wójcik</p>
                <p className="text-[9px] text-slate-400 font-medium font-mono">Compliance Dir</p>
              </div>
            </div>

          </div>
        </header>

        {/* MOBILE NAVIGATION OVERLAY DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex flex-col w-64 max-w-xs bg-slate-950 text-slate-200 p-6 z-50">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-lg">PrivacyPilot</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400">
                  <ComplianceIcon name="X" size={20} />
                </button>
              </div>
              <nav className="space-y-3">
                {navigation.map((item) => {
                  const isActive = currentHash.startsWith(item.hash);
                  return (
                    <button
                      key={item.hash}
                      onClick={() => {
                        navigateTo(item.hash);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-3 py-2.5 rounded text-sm ${
                        isActive ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-900'
                      } gap-3`}
                    >
                      <ComplianceIcon name={item.iconName} size={18} />
                      <span>{currentLanguage === 'pl' ? item.labelPl : item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* WORKSPACE CANVAS */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          
          {/* Regulatory Disclaimer Overlay Banner */}
          <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded shadow-xs flex items-center justify-between text-xs text-yellow-800">
            <div className="flex items-center gap-2">
              <ComplianceIcon name="AlertTriangle" className="text-yellow-600 shrink-0" size={16} />
              <p>
                <strong>{currentLanguage === 'pl' ? 'Wskazówka legalna:' : 'Compliance Note:'}</strong>{' '}
                {currentLanguage === 'pl'
                  ? 'Szkic wygenerowany na podstawie wpisów RCP. Wymaga weryfikacji prawnej (DPO/IOD) przed publikacją.'
                  : 'Draft compiled from active records. Requires strict DPO legal review before administrative publication.'}
              </p>
            </div>
            <span className="hidden sm:inline bg-yellow-200 text-yellow-900 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">RODO compliance</span>
          </div>

          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* 3. NOTIFICATION DRAWER (SLIDE OUT PANEL) */}
      {showNotificationDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={() => setShowNotificationDrawer(false)} />
          <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col z-50 animate-slide-in">
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-950 text-base flex items-center gap-2">
                <ComplianceIcon name="Bell" className="text-blue-600" size={18} />
                <span>{currentLanguage === 'pl' ? 'Centrum Powiadomień' : 'Notification Center'}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    markNotificationsAsRead();
                    setShowNotificationDrawer(false);
                  }}
                  className="text-[10px] text-blue-600 hover:underline font-semibold"
                >
                  {currentLanguage === 'pl' ? 'Oznacz jako przeczytane' : 'Mark all read'}
                </button>
                <button onClick={() => setShowNotificationDrawer(false)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                  <ComplianceIcon name="X" size={18} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded border text-xs transition-all ${
                    !n.read
                      ? 'bg-blue-50/50 border-blue-100 text-blue-900'
                      : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 font-semibold text-slate-900 gap-2">
                    <span className="flex items-center gap-1.5">
                      {n.type === 'alert' && <ComplianceIcon name="Skull" className="text-red-500" size={12} />}
                      {n.type === 'warning' && <ComplianceIcon name="AlertTriangle" className="text-amber-500" size={12} />}
                      {n.type === 'success' && <ComplianceIcon name="Check" className="text-emerald-500" size={12} />}
                      {n.title}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">{n.date}</span>
                  </div>
                  <p>{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. COMMAND PALETTE MODAL OVERLAY */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowCommandPalette(false)} />
          <div className="relative mx-auto max-w-xl bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 z-50 transition-all transform animate-scale-up">
            <div className="p-4 flex items-center gap-3 bg-slate-50">
              <ComplianceIcon name="Search" className="text-slate-400 shrink-0" size={18} />
              <input
                type="text"
                placeholder={currentLanguage === 'pl' ? 'Wpisz wyszukiwaną frazę...' : 'Search records, processors, incidents...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm text-slate-900 placeholder-slate-400 bg-transparent border-0 focus:outline-none"
                autoFocus
              />
              <button onClick={() => setShowCommandPalette(false)} className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase font-bold cursor-pointer">
                esc
              </button>
            </div>
            
            <div className="max-h-72 overflow-y-auto p-2 text-xs text-slate-700">
              {searchQuery.trim() === '' ? (
                <div className="p-4 text-center text-slate-400 space-y-1">
                  <p className="font-medium">{currentLanguage === 'pl' ? 'Wyszukiwanie dynamiczne' : 'Global Command Access'}</p>
                  <p className="text-[11px]">{currentLanguage === 'pl' ? 'Zacznij pisać, aby wyszukać ROPA, DPIA lub incydenty.' : 'Type to query ROPA registers, vendor data sheets, or active breach reports.'}</p>
                </div>
              ) : searchResults.length === 0 ? (
                <p className="p-4 text-center text-slate-400">{currentLanguage === 'pl' ? 'Brak dopasowań...' : 'No matches found...'}</p>
              ) : (
                searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      navigateTo(res.hash);
                      setShowCommandPalette(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left p-3 hover:bg-slate-100 rounded flex justify-between items-center transition-colors group cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{res.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">{res.category}</span>
                    </div>
                    <ComplianceIcon name="ChevronRight" className="text-slate-300 group-hover:text-blue-600 transition-colors" size={14} />
                  </button>
                ))
              )}
            </div>
            
            <div className="p-3 bg-slate-50 text-[10px] text-slate-400 flex justify-between font-mono shrink-0">
              <span>↑↓ navigation</span>
              <span>↵ enter</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. TOAST OVERLAY GRID */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3.5 rounded-lg shadow-xl border flex items-center justify-between text-xs font-medium animate-slide-in gap-3 text-white ${
              t.type === 'error'
                ? 'bg-red-600 border-red-500'
                : t.type === 'warning'
                ? 'bg-amber-600 border-amber-500'
                : t.type === 'info'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <span>{t.message}</span>
            <span className="text-[9px] uppercase tracking-wider bg-black/20 px-1 py-0.5 rounded font-bold font-mono shrink-0">ok</span>
          </div>
        ))}
      </div>

    </div>
  );
};
