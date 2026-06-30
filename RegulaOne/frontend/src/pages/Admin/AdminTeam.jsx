// Team Management page — wired to real backend APIs via useTeam hooks.
// Replaces the mock-data implementation that was used during UI development.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, UserCheck, UserX, UserPlus, X, AlertTriangle, Loader2, LayoutGrid, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTeamStats, useTeamMembers, useInviteUser, useUpdateUserStatus, useUpdateUserModules, useDeleteUser } from '../../hooks/useTeam';

// OLD MOCK DATA — commented out in favour of real API data from /api/admin/*
// const MOCK_TENANT_USERS = [
//   { id: 'u1', displayName: 'Anna Kowalska',   email: 'anna.kowalska@polcorp.pl', role: 'ROLE_ADMIN', status: 'active',    joinedAt: '2024-01-16' },
//   { id: 'u2', displayName: 'Jan Nowak',        email: 'jan.nowak@polcorp.pl',     role: 'ROLE_USER',  status: 'active',    joinedAt: '2024-01-20' },
//   { id: 'u3', displayName: 'Zofia Kamińska',   email: 'z.kaminska@polcorp.pl',    role: 'ROLE_USER',  status: 'active',    joinedAt: '2024-02-10' },
//   { id: 'u4', displayName: 'Piotr Malinowski', email: 'p.malinowski@polcorp.pl',  role: 'ROLE_USER',  status: 'active',    joinedAt: '2024-03-05' },
//   { id: 'u5', displayName: 'Ewa Szymańska',    email: 'e.szymanska@polcorp.pl',   role: 'ROLE_USER',  status: 'suspended', joinedAt: '2024-03-22' },
//   { id: 'u6', displayName: 'Michał Wróbel',    email: 'm.wrobel@polcorp.pl',      role: 'ROLE_USER',  status: 'active',    joinedAt: '2024-04-08' },
// ];
// const TIER_USER_LIMIT = 50;

const ROLE_STYLES = {
  ROLE_ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  ROLE_USER:  'bg-slate-100 text-slate-600 border-slate-200',
};

// Derives avatar initials from a full name string (up to 2 characters).
function initials(name = '') {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

// Formats an ISO LocalDateTime string (e.g. "2024-01-16T10:00:00") to "Jan 16, 2024".
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });
}

export default function AdminTeam() {
  const tenantName = useAuthStore((s) => s.user?.tenantName ?? 'your organisation');

  // Used to open a member's permissions page when their name is clicked.
  const navigate   = useNavigate();
  const { tenantId } = useParams();
  const openPermissions = (user) =>
    navigate(`/company/${tenantId}/team/${user.id}`);

  // Server state — fetched from backend
  const { data: stats,   isLoading: statsLoading,   error: statsError   } = useTeamStats();
  const { data: members, isLoading: membersLoading, error: membersError } = useTeamMembers();

  // Mutations
  const inviteUser        = useInviteUser();
  const updateUserStatus  = useUpdateUserStatus();
  const updateUserModules = useUpdateUserModules();
  const deleteUser        = useDeleteUser();

  // Edit-modules modal state — holds the user whose modules are being edited
  const [editModulesUser, setEditModulesUser] = useState(null); // full user object
  const [editModules,     setEditModules]     = useState([]);

  const openEditModules = (user) => {
    setEditModulesUser(user);
    setEditModules(user.moduleIds ?? []);
  };

  const closeEditModules = () => {
    setEditModulesUser(null);
    setEditModules([]);
  };

  const toggleEditModule = (key) =>
    setEditModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const handleSaveModules = () => {
    updateUserModules.mutate(
      { userId: editModulesUser.id, moduleIds: editModules },
      { onSuccess: closeEditModules },
    );
  };

  // Invite modal state
  const [showInvite,   setShowInvite]   = useState(false);
  const [inviteName,   setInviteName]   = useState('');
  const [inviteEmail,  setInviteEmail]  = useState('');
  const [inviteRole,   setInviteRole]   = useState('ROLE_USER');
  const [inviteModules, setInviteModules] = useState([]);

  // All available compliance modules the admin can assign to the invited user
  const MODULES = [
    { key: 'KSEFFLOW',     label: 'KSeFFlow' },
    { key: 'WORKPULSE',    label: 'WorkPulse' },
    { key: 'SAFEWORK',     label: 'SafeWork' },
    { key: 'SAFEVOICE',    label: 'SafeVoice' },
    { key: 'WASTESYNC',    label: 'WasteSync' },
    { key: 'PRIVACYPILOT', label: 'PrivacyPilot' },
  ];

  const toggleModule = (key) =>
    setInviteModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  // Confirmation modal state — holds the user pending a status change
  const [confirmUser, setConfirmUser] = useState(null); // { id, name, enabled }
  // Confirmation modal state — holds the user pending permanent deletion
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  // ── Invite handler ──────────────────────────────────────────────────────────
  const handleInvite = (e) => {
    e.preventDefault();
    inviteUser.mutate(
      { name: inviteName, email: inviteEmail, role: inviteRole, moduleIds: inviteModules },
      {
        onSuccess: () => {
          setShowInvite(false);
          setInviteName('');
          setInviteEmail('');
          setInviteRole('ROLE_USER');
          setInviteModules([]);
        },
      },
    );
  };

  // ── Status toggle handler ──────────────────────────────────────────────────
  // Opens a confirmation modal instead of toggling immediately.
  const handleStatusClick = (user) => {
    // user comes from UserResponse: id, name, enabled
    setConfirmUser({ id: user.id, name: user.name, enabled: user.enabled });
  };

  const handleConfirmStatus = () => {
    if (!confirmUser) return;
    updateUserStatus.mutate(
      { userId: confirmUser.id, enabled: !confirmUser.enabled },
      { onSettled: () => setConfirmUser(null) },
    );
  };

  // ── Delete handler ─────────────────────────────────────────────────────────
  // Opens a confirmation modal; the actual delete removes the user from the database
  // AND Cognito. The backend refuses to delete the organisation's primary-contact
  // account and returns a clear reason (shown via the mutation's error toast).
  const handleDeleteClick = (user) => {
    setConfirmDelete({ id: user.id, name: user.name });
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    deleteUser.mutate(confirmDelete.id, { onSettled: () => setConfirmDelete(null) });
  };

  // ── Derived values from stats response ────────────────────────────────────
  const totalMembers    = stats?.totalMembers    ?? 0;
  const activeMembers   = stats?.activeMembers   ?? 0;
  const suspendedMembers= stats?.suspendedMembers ?? 0;
  const tierLimit       = stats?.tierLimit        ?? 0;
  const seatUsage       = stats?.seatUsage        ?? '— / — seats used';
  const remainingSeats  = stats?.remainingSeats   ?? 0;
  const currentPlan     = stats?.currentPlan      ?? 'Unknown';
  const usagePct        = tierLimit > 0 ? Math.round((totalMembers / tierLimit) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Team Management</h2>
          <p className="text-sm text-slate-500 font-medium">
            Manage users within your organisation — <span className="text-slate-700">{tenantName}</span>
          </p>
        </div>
        <Button
          className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm"
          onClick={() => setShowInvite(true)}
        >
          <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite User
        </Button>
      </div>

      {/* ── Stats cards ────────────────────────────────────────────────────── */}
      {statsError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Failed to load team stats: {statsError.message}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Members', value: totalMembers,     icon: Users,     color: 'text-slate-300' },
            { label: 'Active',        value: activeMembers,    icon: UserCheck, color: 'text-emerald-300' },
            { label: 'Suspended',     value: suspendedMembers, icon: UserX,     color: 'text-rose-300' },
            { label: 'Tier Limit',    value: tierLimit,        icon: Users,     color: 'text-red-300' },
          ].map((s) => (
            <Card key={s.label} className="bg-white border-slate-200 shadow-sm rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</CardTitle>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </CardHeader>
              <CardContent>
                {statsLoading
                  ? <div className="h-8 w-12 bg-slate-100 rounded animate-pulse" />
                  : <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
                }
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Seat usage bar ─────────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Seat Usage</span>
            <span className="text-xs font-bold text-slate-900">
              {statsLoading ? '…' : seatUsage}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${usagePct >= 80 ? 'bg-rose-500' : 'bg-red-500'}`}
              style={{ width: statsLoading ? '0%' : `${usagePct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {statsLoading ? (
              <span className="inline-block h-3 w-48 bg-slate-100 rounded animate-pulse" />
            ) : (
              <>
                {remainingSeats} seats remaining on your{' '}
                <span className="text-red-600 font-bold">{currentPlan}</span> plan.
                {usagePct >= 80 && (
                  <span className="text-rose-600 font-bold ml-1">Consider upgrading.</span>
                )}
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ── Invite modal ───────────────────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <Card className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-slate-200">
            <CardHeader className="border-b border-slate-100 py-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-900">Invite Team Member</CardTitle>
                <button
                  onClick={() => setShowInvite(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={inviteUser.isPending}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                  <Input
                    placeholder="e.g. Jan Kowalski"
                    className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                    disabled={inviteUser.isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Work Email</Label>
                  <Input
                    type="email"
                    placeholder="jan@polcorp.pl"
                    className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={inviteUser.isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Role</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['ROLE_USER', 'ROLE_ADMIN'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        disabled={inviteUser.isPending}
                        className={`h-10 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${
                          inviteRole === r
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-red-300'
                        }`}
                      >
                        {r.replace('ROLE_', '')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Module access — admin picks which modules the user can see */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Module Access
                    </Label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {inviteModules.length} of {MODULES.length} selected
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MODULES.map((m) => {
                      const active = inviteModules.includes(m.key);
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => toggleModule(m.key)}
                          disabled={inviteUser.isPending}
                          className={`h-9 rounded-lg border text-xs font-bold tracking-wide transition-all ${
                            active
                              ? 'bg-red-50 text-red-700 border-red-400'
                              : 'bg-white text-slate-400 border-slate-200 hover:border-red-200'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  {inviteModules.length === 0 && (
                    <p className="text-[10px] text-amber-500 font-medium">
                      No modules selected — user will not see any modules.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 text-slate-400 font-bold"
                    disabled={inviteUser.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold"
                    disabled={inviteUser.isPending}
                  >
                    {inviteUser.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Sending…</>
                    ) : 'Send Invitation'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Status confirmation modal ──────────────────────────────────────── */}
      {confirmUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <Card className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border-slate-200">
            <CardHeader className="border-b border-slate-100 py-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${confirmUser.enabled ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                  {confirmUser.enabled
                    ? <UserX     className="h-5 w-5 text-rose-500" />
                    : <UserCheck className="h-5 w-5 text-emerald-500" />
                  }
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  {confirmUser.enabled ? 'Suspend User' : 'Reactivate User'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-5 pb-6 space-y-5">
              <p className="text-sm text-slate-600">
                {confirmUser.enabled
                  ? <>Are you sure you want to suspend <strong>{confirmUser.name}</strong>? They will lose access to the platform immediately.</>
                  : <>Are you sure you want to reactivate <strong>{confirmUser.name}</strong>? They will regain access to the platform.</>
                }
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmUser(null)}
                  className="flex-1 text-slate-400 font-bold"
                  disabled={updateUserStatus.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmStatus}
                  disabled={updateUserStatus.isPending}
                  className={`flex-1 font-bold text-white ${
                    confirmUser.enabled
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {updateUserStatus.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Updating…</>
                  ) : confirmUser.enabled ? 'Yes, Suspend' : 'Yes, Reactivate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <Card className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border-slate-200">
            <CardHeader className="border-b border-slate-100 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-rose-50">
                  <Trash2 className="h-5 w-5 text-rose-500" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">Delete User</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-5 pb-6 space-y-5">
              <p className="text-sm text-slate-600">
                Are you sure you want to permanently delete <strong>{confirmDelete.name}</strong>?
                This removes their account from the platform and cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 text-slate-400 font-bold"
                  disabled={deleteUser.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteUser.isPending}
                  className="flex-1 font-bold text-white bg-rose-600 hover:bg-rose-700"
                >
                  {deleteUser.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Deleting…</>
                  ) : 'Yes, Delete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Edit modules modal ────────────────────────────────────────────── */}
      {editModulesUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <Card className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-slate-200">
            <CardHeader className="border-b border-slate-100 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Edit Module Access</CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">{editModulesUser.name}</p>
                </div>
                <button
                  onClick={closeEditModules}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={updateUserModules.isPending}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-5 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium">Select which modules this user can access</p>
                <span className="text-[10px] font-bold text-slate-400">
                  {editModules.length} of {MODULES.length} selected
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MODULES.map((m) => {
                  const active = editModules.includes(m.key);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => toggleEditModule(m.key)}
                      disabled={updateUserModules.isPending}
                      className={`h-9 rounded-lg border text-xs font-bold tracking-wide transition-all ${
                        active
                          ? 'bg-red-50 text-red-700 border-red-400'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-red-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {editModules.length === 0 && (
                <p className="text-[10px] text-amber-500 font-medium">
                  No modules selected — user will not see any modules in the sidebar.
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeEditModules}
                  className="flex-1 text-slate-400 font-bold"
                  disabled={updateUserModules.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveModules}
                  className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold"
                  disabled={updateUserModules.isPending}
                >
                  {updateUserModules.isPending
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
                    : 'Save Changes'
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Users table ────────────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {membersError ? (
            <div className="px-6 py-10 flex flex-col items-center gap-2 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
              <p className="text-sm font-medium">Failed to load team members</p>
              <p className="text-xs text-slate-400">{membersError.message}</p>
            </div>
          ) : membersLoading ? (
            // Skeleton rows while loading
            <div className="divide-y divide-slate-50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                    <div className="h-2.5 w-48 bg-slate-100 rounded" />
                  </div>
                  <div className="h-5 w-14 bg-slate-100 rounded-full" />
                  <div className="h-5 w-16 bg-slate-100 rounded-full" />
                  <div className="h-4 w-20 bg-slate-100 rounded" />
                  <div className="h-7 w-20 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : !members || members.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-slate-400">
              <Users className="h-10 w-10 text-slate-200" />
              <p className="text-sm font-semibold text-slate-500">No team members yet</p>
              <p className="text-xs">Invite your first team member using the button above.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Member</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Role</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Joined</TableHead>
                  <TableHead className="text-right px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((u) => {
                  const isActive       = u.enabled;
                  const isPendingThis  = updateUserStatus.isPending && updateUserStatus.variables?.userId === u.id;

                  return (
                    <TableRow key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">

                      {/* Avatar + full name — clicking opens the user's permissions page */}
                      <TableCell className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openPermissions(u)}
                          className="flex items-center gap-3 text-left group"
                          title="Manage permissions"
                        >
                          <div className="h-8 w-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-xs font-bold text-red-600 flex-shrink-0">
                            {initials(u.name)}
                          </div>
                          <span className="font-semibold text-sm text-slate-700 group-hover:text-red-600 group-hover:underline transition-colors">
                            {u.name}
                          </span>
                        </button>
                      </TableCell>

                      <TableCell className="px-6 py-4 text-xs text-slate-500 font-mono">{u.email}</TableCell>

                      {/* Role badge */}
                      <TableCell className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${ROLE_STYLES[u.role] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {u.role?.replace('ROLE_', '') ?? u.role}
                        </span>
                      </TableCell>

                      {/* Status badge — derived from enabled boolean */}
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isActive ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Joined date — formatted from createdAt ISO string */}
                      <TableCell className="px-6 py-4 text-xs text-slate-400">
                        {formatDate(u.createdAt)}
                      </TableCell>

                      {/* Action buttons — status toggle + module editor */}
                      <TableCell className="text-right px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold h-7 px-3 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openPermissions(u)}
                          >
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" />Permissions
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold h-7 px-3 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openEditModules(u)}
                            disabled={updateUserModules.isPending}
                          >
                            <LayoutGrid className="h-3.5 w-3.5 mr-1" />Modules
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`text-xs font-bold h-7 px-3 ${
                              isActive
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            onClick={() => handleStatusClick(u)}
                            disabled={isPendingThis}
                          >
                            {isPendingThis ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isActive ? (
                              <><UserX     className="h-3.5 w-3.5 mr-1" />Suspend</>
                            ) : (
                              <><UserCheck className="h-3.5 w-3.5 mr-1" />Reactivate</>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold h-7 px-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteClick(u)}
                            disabled={deleteUser.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
