import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';
import { useChangePassword } from '../../hooks/useAuth';

const schema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword:     z.string().min(8, 'Password must be at least 8 characters'),
  confirm:         z.string(),
}).refine(d => d.newPassword === d.confirm, {
  message: 'Passwords do not match',
  path:    ['confirm'],
});

type FormData = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const changePassword = useChangePassword();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit((data) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      { onSuccess: () => reset() },
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Change Password</h2>
        <p className="text-sm text-slate-500 font-medium">Update your account password.</p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
              <Lock className="h-4 w-4 text-red-600" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900">Security Settings</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Password</Label>
              <Input
                type="password"
                className="border-slate-200 h-10 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                {...register('currentPassword')}
              />
              {errors.currentPassword && <p className="text-[10px] text-rose-600 font-bold">{errors.currentPassword.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</Label>
              <Input
                type="password"
                placeholder="Min. 8 characters"
                className="border-slate-200 h-10 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                {...register('newPassword')}
              />
              {errors.newPassword && <p className="text-[10px] text-rose-600 font-bold">{errors.newPassword.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm New Password</Label>
              <Input
                type="password"
                className="border-slate-200 h-10 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                {...register('confirm')}
              />
              {errors.confirm && <p className="text-[10px] text-rose-600 font-bold">{errors.confirm.message}</p>}
            </div>

            <div className="pt-2 flex gap-3">
              <Button type="submit" disabled={changePassword.isPending} className="bg-red-600 text-white hover:bg-red-700 font-bold px-6">
                {changePassword.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
