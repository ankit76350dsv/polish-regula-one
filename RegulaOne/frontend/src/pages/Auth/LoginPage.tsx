// Firebase auth removed - using mock accounts for role-based navigation
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../../types';

// DEV: Demo accounts — any password accepted, email determines role
const MOCK_ACCOUNTS: Record<string, UserProfile> = {
  'super@demo.com': {
    uid: 'mock-super',
    email: 'super@demo.com',
    role: 'ROLE_SUPER_ADMIN',
    displayName: 'Platform Root',
    status: 'active',
  },
  'admin@demo.com': {
    uid: 'mock-admin',
    email: 'admin@demo.com',
    role: 'ROLE_ADMIN',
    tenantId: 'tenant-001',
    displayName: 'Tenant Administrator',
    status: 'active',
  },
  'user@demo.com': {
    uid: 'mock-user',
    email: 'user@demo.com',
    role: 'ROLE_USER',
    tenantId: 'tenant-001',
    displayName: 'Jane Kowalski',
    status: 'active',
  },
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const mockUser = MOCK_ACCOUNTS[email.toLowerCase()];
    if (mockUser) {
      setUser(mockUser);
      navigate('/');
      return;
    }

    setError('Invalid credentials. Use one of the demo accounts below.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans antialiased text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(241,245,249,1)_0%,rgba(226,232,240,1)_100%)] opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 shadow-xl shadow-red-200 border border-red-500 text-white font-bold text-2xl">
            R
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">RegulaOne</h1>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Enterprise Compliance OS</p>
        </div>

        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6">
            <CardTitle className="text-slate-900 text-xl">Sign In</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Access your enterprise compliance dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-8">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-red-500/20 focus-visible:border-red-500 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="bg-white border-slate-200 text-slate-900 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">{error}</p>
                </div>
              )}
              <Button type="submit" className="w-full bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100">
                <LogIn className="mr-2 h-4 w-4" /> Sign In
              </Button>
            </form>

            {/* DEV: Clickable demo account hints */}
            <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3">Demo Accounts — any password</p>
              {[
                { email: 'super@demo.com', role: 'ROLE_SUPER_ADMIN', color: 'bg-red-100 text-red-700' },
                { email: 'admin@demo.com', role: 'ROLE_ADMIN', color: 'bg-blue-100 text-blue-700' },
                { email: 'user@demo.com', role: 'ROLE_USER', color: 'bg-emerald-100 text-emerald-700' },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => setEmail(acc.email)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-100 hover:border-red-300 transition-colors text-left cursor-pointer"
                >
                  <span className="text-xs font-mono text-slate-600">{acc.email}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${acc.color}`}>{acc.role.replace('ROLE_', '').replace(/_/g, ' ')}</span>
                </button>
              ))}
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider transition-colors"
              >
                No account? Register Organization
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
