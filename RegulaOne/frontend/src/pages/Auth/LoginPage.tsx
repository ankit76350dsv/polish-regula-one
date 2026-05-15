import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useLogin } from '../../hooks/useAuth';

const schema = z.object({
  email:    z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const login    = useLogin();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit((data) => {
    login.mutate({ email: data.email, password: data.password });
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans antialiased text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(241,245,249,1)_0%,rgba(226,232,240,1)_100%)] opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 shadow-xl shadow-red-200 border border-red-500 text-white font-bold text-2xl">R</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">RegulaOne</h1>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Enterprise Compliance OS</p>
        </div>

        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6">
            <CardTitle className="text-slate-900 text-xl">Sign In</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Access your enterprise compliance dashboard</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-8">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</Label>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-red-500/20 focus-visible:border-red-500 h-11"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-[10px] text-rose-600 font-bold">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  className="bg-white border-slate-200 text-slate-900 h-11 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-[10px] text-rose-600 font-bold">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={login.isPending}
                className="w-full bg-red-600 text-white hover:bg-red-700 h-11 font-bold shadow-lg shadow-red-100"
              >
                {login.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                  : <><LogIn className="mr-2 h-4 w-4" />Sign In</>}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/auth/signup')}
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
