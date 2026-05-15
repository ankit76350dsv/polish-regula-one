import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useConfirmSignup, useResendCode } from '../../hooks/useAuth';

const schema = z.object({
  email: z.email('Invalid email'),
  code:  z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Digits only'),
});

export default function ConfirmSignupPage() {
  const navigate        = useNavigate();
  const [params]        = useSearchParams();
  const confirm         = useConfirmSignup();
  const resend          = useResendCode();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get('email') ?? '', code: '' },
  });

  // Pre-fill email from query param (set by SignupPage after successful registration)
  useEffect(() => {
    const email = params.get('email');
    if (email) setValue('email', email);
  }, [params, setValue]);

  const email = watch('email');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans antialiased">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(241,245,249,1)_0%,rgba(226,232,240,1)_100%)] opacity-50" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 shadow-xl shadow-red-200 border border-red-500 text-white font-bold text-2xl">R</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">RegulaOne</h1>
        </div>

        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                <MailCheck className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-slate-900 text-lg">Verify Your Email</CardTitle>
                <CardDescription className="text-slate-500 font-medium text-xs">Enter the 6-digit code sent to your inbox</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            <form onSubmit={handleSubmit(d => confirm.mutate(d))} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</Label>
                <Input
                  type="email"
                  className="bg-white border-slate-200 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  {...register('email')}
                />
                {errors.email && <p className="text-[10px] text-rose-600 font-bold">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Verification Code</Label>
                <Input
                  placeholder="123456"
                  maxLength={6}
                  className="bg-white border-slate-200 h-11 text-center text-xl tracking-[0.4em] font-mono focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  {...register('code')}
                />
                {errors.code && <p className="text-[10px] text-rose-600 font-bold">{errors.code.message}</p>}
              </div>

              <Button type="submit" disabled={confirm.isPending} className="w-full bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100">
                {confirm.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : 'Verify Email'}
              </Button>
            </form>
          </CardContent>

          <div className="bg-slate-50/50 border-t border-slate-100 py-4 px-6 flex items-center justify-between">
            <button
              type="button"
              disabled={resend.isPending || !email}
              onClick={() => resend.mutate(email)}
              className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider transition-colors disabled:opacity-40"
            >
              {resend.isPending ? 'Sending…' : 'Resend Code'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider transition-colors"
            >
              Back to Login
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
