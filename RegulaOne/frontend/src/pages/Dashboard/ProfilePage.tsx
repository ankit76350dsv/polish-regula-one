import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User, Mail, ShieldCheck, Calendar, Hash, CheckCircle2, XCircle, Lock, KeyRound,
} from 'lucide-react';
import { authService } from '../../services/authService';

function formatDateTime(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 pt-2">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-slate-100" />
        <div className="space-y-2">
          <div className="h-4 w-40 bg-slate-100 rounded" />
          <div className="h-3 w-56 bg-slate-100 rounded" />
        </div>
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 bg-slate-50 rounded-lg" />
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { data: profile, isLoading, isError } = useQuery({
    queryKey:  ['me'],
    queryFn:   authService.getMe,
    staleTime: 60_000,
  });

  const initials = profile?.name
    ? profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const displayRole = (role: string) =>
    role.replace('ROLE_', '').replace(/_/g, ' ');

  const roleColor: Record<string, string> = {
    ROLE_SUPER_ADMIN: 'bg-red-50 text-red-700 border-red-200',
    ROLE_ADMIN:       'bg-blue-50 text-blue-700 border-blue-200',
    ROLE_USER:        'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h2>
        <p className="text-sm text-slate-500 font-medium">Your account details from the platform.</p>
      </div>

      {isError && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-600 font-medium">
          Could not load profile. Make sure you are connected to the backend.
        </div>
      )}

      {/* ── Profile card ──────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 py-5 px-6">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">Account Details</CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading ? <Skeleton /> : (
            <div className="space-y-6">

              {/* Avatar + name banner */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-red-50 border-2 border-red-100 flex items-center justify-center text-xl font-black text-red-600 flex-shrink-0">
                  {initials}
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900">{profile?.name}</p>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${roleColor[profile?.role ?? ''] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {displayRole(profile?.role ?? '')}
                  </span>
                </div>
              </div>

              {/* Detail grid */}
              <div className="divide-y divide-slate-50">

                {/* ID */}
                <div className="flex items-center gap-4 py-3.5">
                  <Hash className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28 flex-shrink-0">Account ID</span>
                  <span className="text-xs font-mono text-slate-600 break-all">{profile?.id}</span>
                </div>

                {/* Email */}
                <div className="flex items-center gap-4 py-3.5">
                  <Mail className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28 flex-shrink-0">Email</span>
                  <span className="text-sm text-slate-700 font-medium">{profile?.email}</span>
                </div>

                {/* Role */}
                <div className="flex items-center gap-4 py-3.5">
                  <ShieldCheck className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28 flex-shrink-0">Role</span>
                  <span className="text-sm text-slate-700 font-semibold">{profile?.role}</span>
                </div>

                {/* Enabled */}
                <div className="flex items-center gap-4 py-3.5">
                  <User className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28 flex-shrink-0">Status</span>
                  <div className="flex items-center gap-1.5">
                    {profile?.enabled ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-600">Enabled</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-rose-500" />
                        <span className="text-sm font-bold text-rose-600">Disabled</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Temp password */}
                <div className="flex items-center gap-4 py-3.5">
                  <KeyRound className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28 flex-shrink-0">Temp Password</span>
                  <div className="flex items-center gap-1.5">
                    {profile?.tempPassword ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-bold text-amber-600">Yes — please change it</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-slate-300" />
                        <span className="text-sm text-slate-400 font-medium">No</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Created at */}
                <div className="flex items-center gap-4 py-3.5">
                  <Calendar className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28 flex-shrink-0">Created At</span>
                  <span className="text-sm text-slate-700 font-medium">{formatDateTime(profile?.createdAt)}</span>
                </div>

                {/* Updated at */}
                <div className="flex items-center gap-4 py-3.5">
                  <Calendar className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28 flex-shrink-0">Updated At</span>
                  <span className="text-sm text-slate-700 font-medium">{formatDateTime(profile?.updatedAt)}</span>
                </div>

              </div>

              {/* Temp password warning banner */}
              {profile?.tempPassword && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <Lock className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-black text-amber-700 uppercase tracking-wide">Temporary Password Active</p>
                    <p className="text-xs text-amber-600 font-medium mt-0.5">
                      Your account is using a temporary password.{' '}
                      <Link to="/change-password" className="underline font-bold hover:text-amber-800">Change it now</Link>
                      {' '}before you lose access.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Security card ─────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 py-5 px-6">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">Security</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <Lock className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Password</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Update your account password via Cognito</p>
              </div>
            </div>
            <Link
              to="/change-password"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:border-red-300 hover:text-red-600 transition-colors"
            >
              Change Password
            </Link>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
