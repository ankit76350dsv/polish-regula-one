/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { UserRole } from '../../types';

export const LoginView: React.FC = () => {
  const { switchRole, navigateTo, currentLanguage, showToast } = useApp();
  const [email, setEmail] = useState('compliance@abclogistics.pl');
  const [password, setPassword] = useState('••••••••••••');
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaStep) {
      setMfaStep(true);
      showToast(currentLanguage === 'pl' ? 'Weryfikacja dwuskładnikowa (MFA) wymagana.' : 'Multi-Factor Verification (MFA) code dispatched.', 'info');
    } else {
      showToast(currentLanguage === 'pl' ? 'Logowanie pomyślne' : 'Authorized successfully', 'success');
      navigateTo('#/app/dashboard');
    }
  };

  const handleDemoSelect = (role: UserRole, targetHash: string) => {
    switchRole(role);
    showToast(currentLanguage === 'pl' ? `Logowanie jako ${role}` : `Simulated access as: ${role}`, 'success');
    navigateTo(targetHash);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-900 text-slate-100">
      
      {/* Visual Column */}
      <div className="hidden md:flex flex-col justify-between w-1/2 p-12 bg-cover bg-center relative shrink-0"
           style={{ backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.85)), url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1000&fit=crop&q=80")' }}>
        <div>
          <span className="bg-blue-600 text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded">GDPR / RODO 2026</span>
          <h2 className="text-3xl font-extrabold tracking-tight mt-6 text-white">PrivacyPilot</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-sm">
            {currentLanguage === 'pl' 
              ? 'Wiodąca platforma zarządzania zgodnością RODO dla wymagających organizacji.' 
              : 'Enterprise GDPR compliance platform coordinating registers, thresholds, incidents, and DPO supervision.'}
          </p>
        </div>
        <div className="space-y-4">
          <blockquote className="border-l-2 border-blue-500 pl-4 italic text-sm text-slate-300">
            {currentLanguage === 'pl'
              ? '"Przekształciliśmy setki rozproszonych plików Excel i Word w jeden zintegrowany, audytowalny rejestr czynności przetwarzania."'
              : '"Replaced spreadsheets and word templates with a single operational ledger, saving dozens of assessment hours."'}
          </blockquote>
          <p className="text-xs font-mono text-slate-500">ABC Logistics Poland Sp. z o.o. (Customer ID: PP-93821)</p>
        </div>
      </div>

      {/* Login Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className="w-full max-w-md space-y-8">
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {currentLanguage === 'pl' ? 'Zaloguj się do platformy' : 'Log in to PrivacyPilot'}
            </h1>
            <p className="text-xs text-slate-400">
              {currentLanguage === 'pl' ? 'Podaj dane uwierzytelniające, aby kontynuować.' : 'Please enter your corporate access parameters.'}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {!mfaStep ? (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    {currentLanguage === 'pl' ? 'Adres E-mail' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                      {currentLanguage === 'pl' ? 'Hasło' : 'Password'}
                    </label>
                    <button
                      type="button"
                      onClick={() => navigateTo('#/forgot-password')}
                      className="text-[10px] text-blue-500 hover:underline"
                    >
                      {currentLanguage === 'pl' ? 'Zapomniałeś hasła?' : 'Forgot password?'}
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
                  {currentLanguage === 'pl' ? 'Kod weryfikacyjny (MFA)' : 'Verification Code (MFA)'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-white tracking-widest text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-500">
                  {currentLanguage === 'pl' 
                    ? 'Wprowadź 6-cyfrowy kod wygenerowany przez aplikację autoryzacyjną.' 
                    : 'Input the 6-digit confirmation code generated in your authenticator app.'}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded py-2.5 text-xs font-bold transition-colors cursor-pointer"
            >
              {mfaStep 
                ? (currentLanguage === 'pl' ? 'Potwierdź i wejdź' : 'Verify & Continue')
                : (currentLanguage === 'pl' ? 'Zaloguj się' : 'Authorize Credentials')}
            </button>
          </form>

          {/* DEMO ENTRY TRIGGER BOX */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white tracking-wide uppercase">
              🚀 {currentLanguage === 'pl' ? 'Szybkie Logowanie Demo' : 'SaaS Sandbox Persona Switcher'}
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              {currentLanguage === 'pl'
                ? 'Kliknij wybraną rolę roboczą, aby natychmiast zalogować się do zintegrowanego środowiska demo i przetestować uprawnienia.'
                : 'Instantly bypass manual input and deploy as any enterprise stakeholder to test compliance boards.'}
            </p>
            
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                onClick={() => handleDemoSelect('TENANT_ADMIN', '#/app/dashboard')}
                className="p-1.5 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900 text-indigo-300 rounded text-left font-medium transition-colors cursor-pointer"
              >
                CEO / Tenant Admin
              </button>
              <button
                onClick={() => handleDemoSelect('COMPLIANCE_OFFICER', '#/app/dashboard')}
                className="p-1.5 bg-blue-950/40 hover:bg-blue-900/40 border border-blue-900 text-blue-300 rounded text-left font-medium transition-colors cursor-pointer"
              >
                Compliance Officer
              </button>
              <button
                onClick={() => handleDemoSelect('DPO', '#/app/dashboard')}
                className="p-1.5 bg-teal-950/40 hover:bg-teal-900/40 border border-teal-900 text-teal-300 rounded text-left font-medium transition-colors cursor-pointer"
              >
                IOD / DPO Inspector
              </button>
              <button
                onClick={() => handleDemoSelect('AUDITOR', '#/app/dashboard')}
                className="p-1.5 bg-yellow-950/40 hover:bg-yellow-900/40 border border-yellow-900 text-yellow-300 rounded text-left font-medium transition-colors cursor-pointer"
              >
                Compliance Auditor
              </button>
              <button
                onClick={() => handleDemoSelect('MANAGER', '#/app/dashboard')}
                className="p-1.5 bg-orange-950/40 hover:bg-orange-900/40 border border-orange-900 text-orange-300 rounded text-left font-medium transition-colors cursor-pointer"
              >
                Department Manager
              </button>
              <button
                onClick={() => handleDemoSelect('SUPER_ADMIN', '#/super-admin')}
                className="p-1.5 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-900 text-purple-300 rounded text-left font-medium transition-colors cursor-pointer"
              >
                Platform Operator (SA)
              </button>
            </div>

            <div className="border-t border-slate-800 pt-2.5 flex justify-between items-center text-[9px] text-slate-500">
              <button onClick={() => navigateTo('#/signup')} className="hover:underline hover:text-white">
                {currentLanguage === 'pl' ? 'Utwórz konto próbne' : 'Sign up for a trial'}
              </button>
              <button onClick={() => navigateTo('#/privacy-portal/request')} className="hover:underline hover:text-white flex items-center gap-1">
                {currentLanguage === 'pl' ? 'Portal żądań RODO' : 'Public DSR Portal'} ↗
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export const SignupView: React.FC = () => {
  const { navigateTo, currentLanguage, showToast } = useApp();
  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast(currentLanguage === 'pl' ? 'Rozpoczęto konfigurację podmiotu' : 'Initializing company setup tenant', 'success');
    navigateTo('#/onboarding');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-8 space-y-6 shadow-2xl">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-white">{currentLanguage === 'pl' ? 'Rozpocznij okres próbny' : 'Start 14-Day Free Trial'}</h1>
          <p className="text-xs text-slate-400">{currentLanguage === 'pl' ? 'Przetestuj PrivacyPilot bez ograniczeń ryzyka.' : 'Experience full GDPR workspace compliance with mock records.'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{currentLanguage === 'pl' ? 'Pełna Nazwa Spółki' : 'Legal Organization Name'}</label>
            <input
              type="text"
              required
              placeholder="e.g. Vistula Retail Sp. z o.o."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{currentLanguage === 'pl' ? 'E-mail Administratora' : 'Corporate Administrator Email'}</label>
            <input
              type="email"
              required
              placeholder="admin@company.pl"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded py-2 text-xs font-bold transition-colors cursor-pointer">
            {currentLanguage === 'pl' ? 'Konfiguruj konto' : 'Proceed to Onboarding'}
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-500">
          Already have an account?{' '}
          <button onClick={() => navigateTo('#/login')} className="text-blue-500 hover:underline">
            Log in
          </button>
        </p>
      </div>
    </div>
  );
};

export const ForgotPasswordView: React.FC = () => {
  const { navigateTo, currentLanguage, showToast } = useApp();
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-8 space-y-6 shadow-2xl">
        <h1 className="text-lg font-bold text-white">{currentLanguage === 'pl' ? 'Zresetuj Hasło' : 'Reset Compliance Credentials'}</h1>
        {!sent ? (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); showToast('Password reset link dispatched', 'info'); }} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your E-mail Address</label>
              <input type="email" required className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-bold cursor-pointer">Send Reset Link</button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-xs text-slate-400">If the account exists, we have dispatched verification instructions to your email inbox.</p>
            <button onClick={() => navigateTo('#/login')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 px-4 rounded text-xs font-bold cursor-pointer">Return to Login</button>
          </div>
        )}
      </div>
    </div>
  );
};
