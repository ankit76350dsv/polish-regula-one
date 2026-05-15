import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useRespondChallenge } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';

const schema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirm:     z.string(),
}).refine(d => d.newPassword === d.confirm, {
  message: 'Passwords do not match',
  path:    ['confirm'],
});

export default function RespondChallengePage() {
  const navigate        = useNavigate();
  const { challengeState } = useAuthStore();
  const respond         = useRespondChallenge();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  // Guard: if there is no pending challenge, redirect to login.
  // This happens if the user navigates directly to /auth/challenge without going through login first.
  if (!challengeState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center space-y-4">
          <p className="text-slate-500 text-sm font-medium">No active challenge. Please log in again.</p>
          <Button onClick={() => navigate('/login')} className="bg-red-600 text-white hover:bg-red-700">
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  const onSubmit = handleSubmit((data) => {
    respond.mutate({
      username:    challengeState.username,
      session:     challengeState.session,
      newPassword: data.newPassword,
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
                <ShieldCheck className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-slate-900 text-lg">Set Permanent Password</CardTitle>
                <CardDescription className="text-slate-500 font-medium text-xs">
                  Your account requires a new password before you can continue.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            <div className="mb-5 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                Challenge: {challengeState.challengeName.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                Logged in as <span className="font-bold">{challengeState.username}</span>
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</Label>
                <Input
                  type="password"
                  placeholder="Min. 8 characters"
                  className="bg-white border-slate-200 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  {...register('newPassword')}
                />
                {errors.newPassword && <p className="text-[10px] text-rose-600 font-bold">{errors.newPassword.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm Password</Label>
                <Input
                  type="password"
                  className="bg-white border-slate-200 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  {...register('confirm')}
                />
                {errors.confirm && <p className="text-[10px] text-rose-600 font-bold">{errors.confirm.message}</p>}
              </div>

              <Button type="submit" disabled={respond.isPending} className="w-full bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100">
                {respond.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting password…</> : 'Set Password & Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
