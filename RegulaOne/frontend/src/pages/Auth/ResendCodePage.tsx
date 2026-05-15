import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useResendCode } from '../../hooks/useAuth';

const schema = z.object({
  email: z.email('Invalid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ResendCodePage() {
  const navigate = useNavigate();
  const resend   = useResendCode();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit((data) => {
    resend.mutate(data.email, {
      onSuccess: () => {
        navigate(`/auth/confirm?email=${encodeURIComponent(data.email)}`);
      },
    });
  });

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
                <RefreshCw className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-slate-900 text-lg">Resend Code</CardTitle>
                <CardDescription className="text-slate-500 font-medium text-xs">Enter your email to receive a new verification code</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</Label>
                <Input
                  type="email"
                  placeholder="admin@company.pl"
                  className="bg-white border-slate-200 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  {...register('email')}
                />
                {errors.email && <p className="text-[10px] text-rose-600 font-bold">{errors.email.message}</p>}
              </div>

              <Button type="submit" disabled={resend.isPending} className="w-full bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100">
                {resend.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : 'Send New Code'}
              </Button>
            </form>
          </CardContent>

          <div className="bg-slate-50/50 border-t border-slate-100 py-4 px-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/auth/confirm')}
              className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider transition-colors"
            >
              Already have a code? Verify now
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
