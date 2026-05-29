/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, Users, ArrowRight, Activity } from 'lucide-react';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppCard } from '../components/AppCard';

interface LoginFeatureProps {
  id: string;
  onLoginSuccess: (email: string, role: string) => void;
}

export const LoginFeature: React.FC<LoginFeatureProps> = ({ id, onLoginSuccess }) => {
  const [email, setEmail] = useState('compliance-officer@regulaone.com');
  const [password, setPassword] = useState('********');
  const [role, setRole] = useState<'Admin' | 'Compliance Officer' | 'Auditor'>('Compliance Officer');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.includes('@')) {
      setErrorMsg('Please input a valid enterprise email address');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess(email, role);
    }, 1100);
  };

  return (
    <div id={id} className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Visual Workspace Hero Sidebar (Vanta/Stripe vibe) */}
      <div className="flex-1 lg:max-w-2xl bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 flex flex-col justify-between p-8 xl:p-12 border-b lg:border-b-0 lg:border-r border-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-md">
            P
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-wide leading-none">
              PrivacyPilot
            </h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-1">
              RegulaOne Enterprise Suite
            </span>
          </div>
        </div>

        <div className="my-12 max-w-lg">
          <span className="text-[10px] bg-slate-900 border border-slate-800 text-indigo-400 font-extrabold rounded-full px-3 py-1 uppercase tracking-wider inline-flex items-center gap-1.5">
            <Activity className="h-3 w-3 animate-pulse" /> RODO/GDPR SLA Active
          </span>
          <h2 className="text-2xl xl:text-3.5xl font-bold text-white tracking-tight leading-tight mt-4">
            Unified Legal Compliance Management.
          </h2>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            Record processing logs, generate Article 30 ROPAs dynamically, detect high-risk DPIA scenarios blockages, and synchronize enterprise privacy templates in real-time.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl">
              <ShieldCheck className="h-5 w-5 text-indigo-400 mb-2" />
              <h4 className="text-xs font-bold text-slate-200">Article 30 Registry</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Continuous compliant data categorization.
              </p>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl">
              <Users className="h-5 w-5 text-indigo-400 mb-2" />
              <h4 className="text-xs font-bold text-slate-200">Audit-Ready Center</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Auditor permissions & historical change logs.
              </p>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-650 font-medium">
          Licensed under RegulaOne Core Cloud Compliance Engine. TLS v1.3 Protected.
        </div>
      </div>

      {/* Main Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 xl:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-100 tracking-tight">
              Enterprise Access Portal
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Sign in with your standard RegulaOne credentials or local mock accounts.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AppTextField
              id="email"
              label="Enterprise Email Address"
              type="email"
              placeholder="e.g. s.kowalsky@privacy-pilot.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-900 dark:bg-slate-900 border-slate-800"
              icon={<Mail className="h-4 w-4" />}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className="text-xs font-semibold text-slate-300">
                Compliance Officer Role Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Admin', 'Compliance Officer', 'Auditor'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-3 py-2 text-[11px] font-bold rounded-lg border transition-all text-center cursor-pointer ${
                      role === r
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <AppTextField
              id="password"
              label="Master Access Code"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-900 dark:bg-slate-900 border-slate-800"
              icon={<Lock className="h-4 w-4" />}
            />

            {errorMsg && (
              <div className="p-3 bg-red-950/25 border border-red-900/60 text-red-400 text-xs rounded-lg font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-between text-xs py-1">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded-sm border-slate-800 text-indigo-600 focus:ring-0"
                />
                Remember compliance token
              </label>
              <a href="#reset" onClick={(e) => e.preventDefault()} className="text-indigo-400 hover:underline">
                Request bypass key
              </a>
            </div>

            <AppButton
              id="btn-login-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Establishing Secure Socket...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-bold">
                  Enter Secure Console <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </AppButton>
          </form>

          {/* Secure compliance tags */}
          <div className="mt-12 flex items-center justify-between border-t border-slate-900 pt-6 text-slate-600 text-[10px] font-bold">
            <span className="flex items-center gap-1.5">
              🛡️ ISO 27001 SECURED
            </span>
            <span className="flex items-center gap-1.5">
              🇪🇺 GDPR COMPLIANT
            </span>
            <span className="flex items-center gap-1.5">
              🇵🇱 GIODO/RODO STANDARD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
