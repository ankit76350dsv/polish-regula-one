// Firebase registration removed - using mock user creation
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Mock registration: creates an ADMIN profile for the new tenant
    setTimeout(() => {
      setUser({
        uid: `reg-${Date.now()}`,
        email,
        role: 'ADMIN',
        tenantId: `tenant-${Date.now()}`,
        displayName: `${companyName} Admin`,
        status: 'active',
      });
      navigate('/');
    }, 800);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans antialiased text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(241,245,249,1)_0%,rgba(226,232,240,1)_100%)] opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-lg"
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
            <CardTitle className="text-slate-900 text-xl">Register Organization</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Set up your enterprise tenant account</CardDescription>

            <div className="mt-6 flex gap-2">
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-red-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-red-600' : 'bg-slate-200'}`} />
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleRegister} className="space-y-6">
              {step === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right duration-300">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Legal Entity Name</Label>
                    <Input
                      placeholder="e.g. Acme Poland Sp. z o.o."
                      className="bg-white border-slate-200 text-slate-900 font-medium h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tax Identification (NIP)</Label>
                    <Input
                      placeholder="PL0000000000"
                      className="bg-white border-slate-200 text-slate-900 font-mono h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="button" onClick={() => setStep(2)} className="w-full bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100">
                    Next Phase <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-in slide-in-from-left duration-300">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Root Administrator Email</Label>
                    <Input
                      type="email"
                      placeholder="admin@company.pl"
                      className="bg-white border-slate-200 text-slate-900 font-medium h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Security Key (Password)</Label>
                    <Input
                      type="password"
                      className="bg-white border-slate-200 text-slate-900 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="ghost" onClick={() => setStep(1)} className="text-slate-400 font-bold hover:text-slate-600">Back</Button>
                    <Button type="submit" disabled={loading} className="flex-1 bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100">
                      {loading ? 'Deploying Tenant...' : 'Initialize Platform'}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
          <div className="bg-slate-50/50 border-t border-slate-100 py-4 px-6 text-center space-y-2">
            <p className="text-[10px] text-slate-400 font-medium">
              Data sovereignty within the EEA region is guaranteed by default.
            </p>
            <div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider transition-colors"
              >
                Already registered? Sign In
              </button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
