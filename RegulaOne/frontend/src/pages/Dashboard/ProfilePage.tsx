import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, ShieldCheck, Calendar, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

export default function ProfilePage() {
  const { user } = useAuthStore();

  // Fetch the freshest profile from the backend on page load.
  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn:  authService.getMe,
    staleTime: 30_000,
  });

  const displayRole = (role: string) => role.replace('ROLE_', '').replace(/_/g, ' ');
  const formatDate  = (s?: string) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h2>
        <p className="text-sm text-slate-500 font-medium">Your account details and security settings.</p>
      </div>

      {/* Identity card */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-5">
          <CardTitle className="text-base font-bold text-slate-900">Account Identity</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="h-14 w-14 rounded-full bg-slate-100" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-100 rounded" />
                <div className="h-3 w-48 bg-slate-100 rounded" />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-xl font-bold text-red-600 flex-shrink-0">
                  {(profile?.name ?? user?.displayName ?? user?.email ?? '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{profile?.name ?? user?.displayName}</p>
                  <p className="text-xs text-slate-400 font-medium">Cognito ID: {profile?.id ?? user?.uid}</p>
                </div>
              </div>

              {/* Detail rows */}
              <div className="grid gap-3">
                {[
                  { icon: Mail,        label: 'Email',      value: profile?.email ?? user?.email },
                  { icon: ShieldCheck, label: 'Role',       value: displayRole(profile?.role ?? user?.role ?? '') },
                  { icon: Calendar,    label: 'Joined',     value: formatDate(profile?.createdAt) },
                  { icon: Calendar,    label: 'Updated',    value: formatDate(profile?.updatedAt) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                    <Icon className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-20">{label}</span>
                    <span className="text-sm font-semibold text-slate-700">{value ?? '—'}</span>
                  </div>
                ))}

                {/* Status row */}
                <div className="flex items-center gap-3 py-2.5">
                  <User className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-20">Status</span>
                  <div className="flex items-center gap-1.5">
                    {profile?.enabled !== false ? (
                      <><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-sm font-semibold text-emerald-600">Active</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-rose-500" /><span className="text-sm font-semibold text-rose-600">Disabled</span></>
                    )}
                  </div>
                </div>

                {/* Temp password warning */}
                {profile?.tempPassword && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg mt-2">
                    <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700 font-bold">You are using a temporary password. Please change it now.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security card */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900">Security</CardTitle>
            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 border-emerald-200 bg-emerald-50">
              Cognito Protected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Password</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Change your account password</p>
            </div>
            <Link
              to="/change-password"
              className="inline-flex items-center px-4 py-2 border border-slate-200 rounded-md text-xs font-bold text-slate-600 bg-white hover:border-red-300 hover:text-red-600 transition-colors"
            >
              Change Password
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
