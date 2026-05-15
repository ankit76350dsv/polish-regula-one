import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSignup, useConfirmSignup, useResendCode } from '../../hooks/useAuth';

// ── Step 1: POST /api/auth/signup  { name, email, password } ─────────────────
const signupSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ── Step 2: POST /api/auth/confirm  { email, code } ──────────────────────────
const confirmSchema = z.object({
  code: z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Digits only'),
});

type SignupData  = z.infer<typeof signupSchema>;
type ConfirmData = z.infer<typeof confirmSchema>;

export default function SignupPage() {
  const navigate              = useNavigate();
  const signup                = useSignup();
  const confirm               = useConfirmSignup();
  const resend                = useResendCode();

  // Tracks which step we're on and the email used in step 1
  const [step, setStep]       = useState<1 | 2>(1);
  const [sentEmail, setSentEmail] = useState('');

  const signupForm = useForm<SignupData>({ resolver: zodResolver(signupSchema) });
  const confirmForm = useForm<ConfirmData>({ resolver: zodResolver(confirmSchema) });

  // Step 1 submit → calls POST /api/auth/signup
  const onSignup = signupForm.handleSubmit((data) => {
    signup.mutate(data, {
      onSuccess: () => {
        setSentEmail(data.email);
        setStep(2);
      },
    });
  });

  // Step 2 submit → calls POST /api/auth/confirm { email, code }
  const onConfirm = confirmForm.handleSubmit((data) => {
    confirm.mutate({ email: sentEmail, code: data.code });
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans antialiased text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(241,245,249,1)_0%,rgba(226,232,240,1)_100%)] opacity-50" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 shadow-xl shadow-red-200 border border-red-500 text-white font-bold text-2xl">R</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">RegulaOne</h1>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Enterprise Compliance OS</p>
        </div>

        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden">

          {/* Progress bar */}
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6">
            <div className="flex gap-2 mb-4">
              <div className="h-1.5 flex-1 rounded-full bg-red-600" />
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step === 2 ? 'bg-red-600' : 'bg-slate-200'}`} />
            </div>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div key="header-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <CardTitle className="text-slate-900 text-xl">Create Account</CardTitle>
                  <CardDescription className="text-slate-500 font-medium mt-1">
                    Register to access the compliance platform.
                  </CardDescription>
                </motion.div>
              ) : (
                <motion.div key="header-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                    <MailCheck className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 text-lg">Verify Your Email</CardTitle>
                    <CardDescription className="text-slate-500 font-medium text-xs mt-0.5">
                      Enter the 6-digit code sent to <span className="font-bold text-slate-700">{sentEmail}</span>
                    </CardDescription>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>

          <CardContent className="pt-8">
            <AnimatePresence mode="wait">

              {/* ── Step 1: Signup form ────────────────────────────────── */}
              {step === 1 && (
                <motion.form
                  key="form-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={onSignup}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                    <Input
                      placeholder="e.g. Jan Kowalski"
                      className="bg-white border-slate-200 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      {...signupForm.register('name')}
                    />
                    {signupForm.formState.errors.name && (
                      <p className="text-[10px] text-rose-600 font-bold">{signupForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</Label>
                    <Input
                      type="email"
                      placeholder="admin@company.pl"
                      className="bg-white border-slate-200 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      {...signupForm.register('email')}
                    />
                    {signupForm.formState.errors.email && (
                      <p className="text-[10px] text-rose-600 font-bold">{signupForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
                    <Input
                      type="password"
                      placeholder="Min. 8 characters"
                      className="bg-white border-slate-200 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      {...signupForm.register('password')}
                    />
                    {signupForm.formState.errors.password && (
                      <p className="text-[10px] text-rose-600 font-bold">{signupForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={signup.isPending}
                    className="w-full bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100"
                  >
                    {signup.isPending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</>
                      : 'Create Account'}
                  </Button>
                </motion.form>
              )}

              {/* ── Step 2: Email verification form ───────────────────── */}
              {step === 2 && (
                <motion.form
                  key="form-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={onConfirm}
                  className="space-y-5"
                >
                  {/* Email — read-only, pre-filled from step 1 */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</Label>
                    <Input
                      type="email"
                      value={sentEmail}
                      readOnly
                      className="bg-slate-50 border-slate-200 h-11 text-slate-500 cursor-not-allowed"
                    />
                  </div>

                  {/* 6-digit code */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Verification Code</Label>
                    <Input
                      placeholder="6-digit code"
                      maxLength={6}
                      autoFocus
                      className="bg-white border-slate-200 h-11 text-center text-2xl tracking-[0.5em] font-mono focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      {...confirmForm.register('code')}
                    />
                    {confirmForm.formState.errors.code && (
                      <p className="text-[10px] text-rose-600 font-bold">{confirmForm.formState.errors.code.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={confirm.isPending}
                    className="w-full bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100"
                  >
                    {confirm.isPending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
                      : 'Verify & Continue'}
                  </Button>

                  {/* Resend code */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      disabled={resend.isPending}
                      onClick={() => resend.mutate(sentEmail)}
                      className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider transition-colors disabled:opacity-40"
                    >
                      {resend.isPending ? 'Sending…' : "Didn't receive a code? Resend"}
                    </button>
                  </div>
                </motion.form>
              )}

            </AnimatePresence>
          </CardContent>

          <div className="bg-slate-50/50 border-t border-slate-100 py-4 px-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider transition-colors"
            >
              Already have an account? Sign In
            </button>
          </div>
        </Card>

      </motion.div>
    </div>
  );
}
