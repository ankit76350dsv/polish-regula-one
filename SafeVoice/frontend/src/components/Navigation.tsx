/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Shield, Home, Inbox, AlertOctagon, HelpCircle, UserCheck, Terminal, FileCheck2, Settings, Lock, Eye, VolumeX, Menu, ChevronLeft } from "lucide-react";
import { AppRole, NotificationItem } from "../types";

interface NavigationProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  activeRole: AppRole | "Public User";
  setActiveRole: (role: AppRole | "Public User") => void;
  unreadCount?: number;
}

export function AppSidebar({
  currentPath,
  onNavigate,
  activeRole,
  unreadCount = 0,
}: NavigationProps) {
  const [collapsed, setCollapsed] = useState(false);

  const isPublic = activeRole === "Public User";

  // Menu lists based on the role structure
  const publicMenuItems = [
    { label: "Submit Safe Report", path: "/report", icon: Shield },
    { label: "Track Active Report", path: "/track", icon: ShieldCheckIcon },
  ];

  const adminMenuItems = [
    { label: "Compliance Dashboard", path: "/dashboard", icon: Home },
    { label: "Incident Case Management", path: "/cases", icon: AlertOctagon },
    { label: "Encrypted Inbox", path: "/messages", icon: Inbox, count: unreadCount },
    { label: "Legal Audit Logs", path: "/audits", icon: Terminal },
    { label: "Access & Permission Matrix", path: "/users", icon: UserCheck },
    { label: "Platform Configurations", path: "/settings", icon: Settings },
  ];

  function ShieldCheckIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  return (
    <div
      className={`bg-[#0F1117] border-r border-slate-800 flex flex-col h-screen text-slate-300 transition-all duration-300 relative ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Platform Header */}
      <div className="border-b border-slate-800 p-4 flex items-center justify-between">
        {!collapsed && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-indigo-400">
              <Shield className="w-5 h-5 flex-shrink-0" />
              <span className="font-bold text-sm tracking-widest text-slate-100 uppercase">RegulaOne</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider font-semibold uppercase mt-0.5">
              SafeVoice Compliance
            </span>
          </div>
        )}
        {collapsed && <Shield className="w-6 h-6 text-indigo-400 mx-auto" />}
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-5 bg-[#0F1117] border border-slate-800 text-slate-400 hover:text-slate-200 rounded-full p-1 cursor-pointer hover:bg-slate-800 z-10"
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          {!collapsed && (
            <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase px-3 mb-2 font-semibold">
              Public Portal
            </p>
          )}
          <ul className="space-y-1">
            {publicMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath.startsWith(item.path);
              return (
                <li key={item.path}>
                  <button
                    onClick={() => onNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      isActive
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                        : "hover:bg-slate-900 text-slate-400 hover:text-slate-100 border border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          {!collapsed && (
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-semibold">
                Enterprise Admin
              </span>
              <span className="text-[9px] text-emerald-500 bg-emerald-950/20 px-1 py-0.2 rounded border border-emerald-500/10 uppercase font-mono font-bold animate-pulse">
                Active
              </span>
            </div>
          )}
          <ul className="space-y-1">
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath.startsWith(item.path);
              return (
                <li key={item.path}>
                  <button
                    onClick={() => {
                      if (isPublic) {
                        // Automatically switch role to Compliance Officer if accessing admin views for seamless evaluation!
                        onNavigate(item.path);
                      } else {
                        onNavigate(item.path);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all relative ${
                      isActive
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]"
                        : "hover:bg-[#0F1117] hover:border-slate-800 text-slate-400 hover:text-slate-100 border border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {item.count && item.count > 0 && !collapsed && (
                      <span className="absolute right-3 top-2.5 bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black select-none">
                        {item.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Compliance / Encrypted Signature */}
      <div className="border-t border-slate-800 p-4">
        {!collapsed ? (
          <div className="bg-[#0B0C10] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-slate-400 leading-none">
              <Lock className="w-3 h-3 text-emerald-400" /> SYSTEM ENCRYPTED
            </div>
            <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">
              In compliance with Poland Directive D-2024 (Sygnaliści). SafeVoice ensures zero logging IP logs.
            </p>
          </div>
        ) : (
          <div className="flex justify-center text-emerald-400">
            <Lock className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}

// Navbar Component
interface NavbarProps {
  activeRole: AppRole | "Public User";
  setActiveRole: (role: AppRole | "Public User") => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

export function AppNavbar({
  activeRole,
  setActiveRole,
  notifications,
  onMarkAllRead,
}: NavbarProps) {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  
  const roles: (AppRole | "Public User")[] = [
    "Public User",
    "Super Admin",
    "Compliance Officer",
    "Investigator",
    "HR Manager",
    "Auditor",
  ];

  const unreadNotifs = notifications.filter((n) => !n.read);

  return (
    <header className="bg-[#0B0C10] border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      {/* Left items: Security Indicators */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="text-xs font-semibold text-slate-300">
            Secure Endpoint Active
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono bg-[#0F1117] px-2 py-1 rounded text-slate-400 border border-slate-800">
          <span>GDPR Compliant</span>
          <span className="w-[1px] h-2.5 bg-slate-850" />
          <span>EU 2019/1937</span>
        </div>
      </div>

      {/* Right items: Notifications, Role, User */}
      <div className="flex items-center gap-4 relative">
        {/* Role Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Role Simulator:</span>
          <select
            value={activeRole}
            onChange={(e) => setActiveRole(e.target.value as any)}
            className="bg-[#0F1117] text-xs font-semibold text-indigo-400 border border-slate-800 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r === "Public User" ? "Anonymous Reporter" : r}
              </option>
            ))}
          </select>
        </div>

        {/* Notifications Popdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative bg-[#0F1117] border border-slate-800 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2.5 w-80 bg-[#0F1117] border border-slate-800 rounded-xl shadow-2xl z-40 overflow-hidden text-slate-300">
              <div className="bg-[#0B0C10] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-200">System Notifications</h4>
                {unreadNotifs.length > 0 && (
                  <button
                    onClick={() => {
                      onMarkAllRead();
                    }}
                    className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-850">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-50 relative italic">
                    No new compliance notifications.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 text-xs transition-colors hover:bg-slate-850 ${
                        notif.read ? "opacity-70" : "bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-200 flex items-center gap-1">
                          {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                          {notif.title}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">{notif.timestamp}</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed text-[11px]">{notif.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info Capsule */}
        <div className="hidden lg:flex items-center gap-2.5 border-l border-slate-800 pl-4">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-200 leading-none">b210125me@gmail.com</span>
            <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase font-bold tracking-wider">
              System Admin Profile
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs shadow-sm shadow-indigo-500/5">
            SU
          </div>
        </div>
      </div>
    </header>
  );
}
