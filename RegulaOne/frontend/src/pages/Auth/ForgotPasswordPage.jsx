import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  clearPasswordRecoveryError,
  confirmPasswordReset,
  requestPasswordReset,
  restartPasswordRecovery,
  selectPasswordRecoveryEmail,
  selectPasswordRecoveryError,
  selectPasswordRecoveryRequestStatus,
  selectPasswordRecoveryResetStatus,
  selectPasswordRecoveryStep,
} from '../../slices/passwordRecoverySlice';

const requestSchema = z.object({
  email: z.email('Enter a valid email address'),
});

const resetSchema = z.object({
  code: z.string().min(6, 'Enter the complete reset code').max(64, 'Reset code is too long'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(256),
  confirmPassword: z.string().min(1, 'Confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function ForgotPasswordPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const step = useSelector(selectPasswordRecoveryStep);
  const recoveryEmail = useSelector(selectPasswordRecoveryEmail);
  const requestStatus = useSelector(selectPasswordRecoveryRequestStatus);
  const resetStatus = useSelector(selectPasswordRecoveryResetStatus);
  const apiError = useSelector(selectPasswordRecoveryError);

  const initialEmail = searchParams.get('email') || '';
  const redirectUri = searchParams.get('redirect_uri');
  const requestForm = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: initialEmail },
  });
  const resetForm = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  // Do not retain a recovery code step if the user leaves with browser navigation.
  useEffect(() => () => {
    dispatch(restartPasswordRecovery());
  }, [dispatch]);

  function loginPath() {
    return redirectUri ? `/login?redirect_uri=${encodeURIComponent(redirectUri)}` : '/login';
  }

  const onRequestCode = requestForm.handleSubmit(
    async ({ email }) => {
      try {
        await dispatch(requestPasswordReset({ email: email.trim() })).unwrap();
        toast.success('If the account is eligible, a reset code has been sent.');
      } catch (error) {
        toast.error(error?.message || 'Could not request a reset code.');
      }
    },
    (errors) => toast.error(errors.email?.message || 'Enter your account email.'),
  );

  const onResetPassword = resetForm.handleSubmit(
    async ({ code, newPassword }) => {
      try {
        await dispatch(confirmPasswordReset({
          email: recoveryEmail,
          code: code.trim(),
          newPassword,
        })).unwrap();
        toast.success('Password reset successfully. You can now sign in.');
        dispatch(restartPasswordRecovery());
        navigate(loginPath(), { replace: true });
      } catch (error) {
        toast.error(error?.message || 'Could not reset the password.');
      }
    },
    (errors) => {
      const message = errors.code?.message
        ?? errors.newPassword?.message
        ?? errors.confirmPassword?.message
        ?? 'Please correct the highlighted fields.';
      toast.error(message);
    },
  );

  const requestPending = requestStatus === 'loading';
  const resetPending = resetStatus === 'loading';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans antialiased text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(241,245,249,1)_0%,rgba(226,232,240,1)_100%)] opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500 bg-red-600 text-2xl font-bold text-white shadow-xl shadow-red-200">
            R
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">RegulaOne</h1>
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">Enterprise Compliance OS</p>
        </div>

        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50">
              {step === 'request'
                ? <KeyRound className="h-5 w-5 text-red-600" aria-hidden="true" />
                : <MailCheck className="h-5 w-5 text-red-600" aria-hidden="true" />}
            </div>
            <CardTitle className="text-xl text-slate-900">
              {step === 'request' ? 'Forgot Password?' : 'Enter Reset Code'}
            </CardTitle>
            <CardDescription className="mt-1 font-medium text-slate-500">
              {step === 'request'
                ? 'Enter your account email and we will send password recovery instructions.'
                : `Use the code sent for ${recoveryEmail}.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-8">
            {apiError?.message && (
              <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                {apiError.message}
              </div>
            )}

            {step === 'request' ? (
              <form onSubmit={onRequestCode} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    aria-invalid={Boolean(requestForm.formState.errors.email)}
                    className="h-11 border-slate-200 bg-white focus-visible:border-red-500 focus-visible:ring-red-500/20"
                    {...requestForm.register('email', {
                      onChange: () => dispatch(clearPasswordRecoveryError()),
                    })}
                  />
                  {requestForm.formState.errors.email && (
                    <p className="text-[10px] font-bold text-rose-600">{requestForm.formState.errors.email.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={requestPending}
                  className="h-11 w-full bg-red-600 font-bold text-white shadow-lg shadow-red-100 hover:bg-red-700"
                >
                  {requestPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code…</>
                    : 'Send Reset Code'}
                </Button>
              </form>
            ) : (
              <form onSubmit={onResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reset Code</Label>
                  <Input
                    autoComplete="one-time-code"
                    placeholder="Enter the code"
                    aria-invalid={Boolean(resetForm.formState.errors.code)}
                    className="h-11 border-slate-200 bg-white text-center font-mono text-lg tracking-[0.3em] focus-visible:border-red-500 focus-visible:ring-red-500/20"
                    {...resetForm.register('code', {
                      onChange: () => dispatch(clearPasswordRecoveryError()),
                    })}
                  />
                  {resetForm.formState.errors.code && (
                    <p className="text-[10px] font-bold text-rose-600">{resetForm.formState.errors.code.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    aria-invalid={Boolean(resetForm.formState.errors.newPassword)}
                    className="h-11 border-slate-200 bg-white focus-visible:border-red-500 focus-visible:ring-red-500/20"
                    {...resetForm.register('newPassword')}
                  />
                  {resetForm.formState.errors.newPassword && (
                    <p className="text-[10px] font-bold text-rose-600">{resetForm.formState.errors.newPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm Password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat the new password"
                    aria-invalid={Boolean(resetForm.formState.errors.confirmPassword)}
                    className="h-11 border-slate-200 bg-white focus-visible:border-red-500 focus-visible:ring-red-500/20"
                    {...resetForm.register('confirmPassword')}
                  />
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="text-[10px] font-bold text-rose-600">{resetForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={resetPending}
                  className="h-11 w-full bg-red-600 font-bold text-white shadow-lg shadow-red-100 hover:bg-red-700"
                >
                  {resetPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting password…</>
                    : 'Reset Password'}
                </Button>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => dispatch(restartPasswordRecovery())}
                    className="text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-red-600"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    disabled={requestPending}
                    onClick={async () => {
                      try {
                        await dispatch(requestPasswordReset({ email: recoveryEmail })).unwrap();
                        toast.success('A new reset code has been requested.');
                      } catch (error) {
                        toast.error(error?.message || 'Could not resend the code.');
                      }
                    }}
                    className="text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-red-600 disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}
          </CardContent>

          <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-center">
            <button
              type="button"
              onClick={() => {
                dispatch(restartPasswordRecovery());
                navigate(loginPath());
              }}
              className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-red-600"
            >
              <ArrowLeft className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Back to Sign In
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
