/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  AlertTriangle,
  FileSignature,
  FolderOpen,
  History,
  Users,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  LogOut,
} from 'lucide-react';

interface AppSidebarProps {
  id: string;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  currentRoute: string;
  onNavigate: (route: string) => void;
  onLogout: () => void;
  activeCompanyName: string;
  onCompanySwitchClick: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  id,
  isCollapsed,
  setIsCollapsed,
  currentRoute,
  onNavigate,
  onLogout,
  activeCompanyName,
  onCompanySwitchClick,
}) => {
  const menuItems = [
    { name: 'Dashboard', route: '/dashboard', icon: LayoutDashboard },
    { name: 'Processing Activities', route: '/activities', icon: ShieldCheck },
    { name: 'DPIA Detection', route: '/dpia', icon: AlertTriangle, badge: 'Smart' },
    { name: 'Privacy Policy', route: '/privacy-policy', icon: FileSignature },
    { name: 'Documents', route: '/documents', icon: FolderOpen },
    { name: 'Audit Logs', route: '/audits', icon: History },
    { name: 'Users & Access', route: '/users', icon: Users },
    { name: 'Settings', route: '/settings', icon: Settings },
  ];

  return (
    <aside
      id={id}
      className={`bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-900 text-slate-700 dark:text-slate-300 min-h-screen flex flex-col justify-between transition-all duration-300 z-30 ${
        isCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Top Brand Area */}
      <div>
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-900 flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex flex-col">
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest pb-1 leading-none ms-0.5">
                RegulaOne
              </span>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-indigo-600 rounded-md flex items-center justify-center text-white font-black text-xs shadow-xs">
                  P
                </div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                  PrivacyPilot
                </h1>
              </div>
            </div>
          ) : (
            <div className="h-6 w-6 mx-auto bg-indigo-600 rounded-md flex items-center justify-center text-white font-black text-xs">
              P
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className="p-2.5 border-b border-slate-200 dark:border-slate-900">
          {!isCollapsed ? (
            <div
              onClick={onCompanySwitchClick}
              className="flex items-center justify-between p-1.5 rounded-md bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850/60 hover:bg-slate-100 dark:hover:bg-slate-900/60 cursor-pointer transition-all duration-200"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="h-5.5 w-5.5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  <Layers className="h-3 w-3" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                    {activeCompanyName}
                  </h4>
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase mt-0.5 block leading-none">
                    GDPR Secured
                  </span>
                </div>
              </div>
              <ChevronRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
            </div>
          ) : (
            <div
              onClick={onCompanySwitchClick}
              className="h-7 w-7 rounded-md bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 flex items-center justify-center mx-auto text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title={activeCompanyName}
            >
              <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
          )}
        </div>

        {/* Navigation Menu Links */}
        <nav className="p-2 space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isSelected =
              currentRoute === item.route ||
              (item.route !== '/dashboard' && currentRoute.startsWith(item.route));

            return (
              <button
                key={item.name}
                onClick={() => onNavigate(item.route)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50/70 dark:hover:bg-slate-900/40'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400 dark:text-slate-500'}`} />
                {!isCollapsed && (
                  <span className="flex-1 text-left truncate">{item.name}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="text-[9px] px-1 py-0.5 rounded-xs bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-0.5">
                    <Sparkles className="h-2 w-2" />
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-900 space-y-0.5">
        {!isCollapsed && (
          <div className="p-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850/60 rounded-md mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-mono text-slate-550 dark:text-slate-400 font-bold">
                SYSTEM SHIELDED
              </span>
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
              TLS 1.3 / AES-256 Storage
            </p>
          </div>
        )}

        <button
          onClick={onLogout}
          className={`w-full flex items-center justify-start gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-650 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/10 transition-colors cursor-pointer`}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-left font-bold">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
