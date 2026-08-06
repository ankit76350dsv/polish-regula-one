// Team Management — the people in one company, and what each of them may use.
//
// Every figure and every list on this page comes from the API. Nothing is sampled or
// assumed, and no action is offered that the server would refuse: seat limits, your own
// account and the last remaining administrator are all checked here as well, so the
// button is disabled with a reason instead of failing after the click.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Users, UserCheck, UserX, UserPlus, AlertTriangle, Loader2, LayoutGrid,
  ShieldCheck, Trash2, Info, UserCog,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { packageService } from '../../services/packageService';
import { formatDate } from '../../lib/dashboardLabels';
import {
  useTeamStats, useTeamMembers, useInviteUser, useUpdateUserStatus,
  useUpdateUserModules, useUpdateUserRole, useDeleteUser,
} from '../../hooks/useTeam';

const ROLE_STYLES = {
  ROLE_ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  ROLE_USER:  'bg-slate-100 text-slate-600 border-slate-200',
};

// What each role may do, stated plainly where an admin chooses one.
const ROLE_OPTIONS = [
  {
    value: 'ROLE_USER',
    label: 'Member',
    help:  'Uses the modules you give them.',
  },
  {
    value: 'ROLE_ADMIN',
    label: 'Administrator',
    help:  'Also manages the team, module access and the company profile.',
  },
];

// Every compliance module, in the order used across the application.
const MODULES = [
  { key: 'KSEFFLOW',     label: 'KSeFFlow' },
  { key: 'WORKPULSE',    label: 'WorkPulse' },
  { key: 'SAFEWORK',     label: 'SafeWork' },
  { key: 'SAFEVOICE',    label: 'SafeVoice' },
  { key: 'WASTESYNC',    label: 'WasteSync' },
  { key: 'PRIVACYPILOT', label: 'PrivacyPilot' },
];

/** Up to two initials for the avatar; blank names simply produce no initials. */
function initials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The module picker, shared by the invite dialog and the edit-access dialog.
 *
 * Modules the company's plan does not include are shown but cannot be selected:
 * granting one would put an entry in the sidebar that opens nothing, because access is
 * the overlap of what the plan includes and what the person was given.
 */
function ModulePicker({ selected, onToggle, disabled, planModules }) {
  // planModules === null means the plan could not be read. In that case nothing is
  // restricted — a secondary request failing must not take away a real capability.
  const includedInPlan = (key) => planModules === null || planModules.includes(key);
  const availableCount = MODULES.filter((m) => includedInPlan(m.key)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Module access
        </Label>
        <span className="text-[10px] text-slate-400 font-medium">
          {selected.length} of {availableCount} selected
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {MODULES.map((m) => {
          const inPlan = includedInPlan(m.key);
          const active = selected.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onToggle(m.key)}
              disabled={disabled || !inPlan}
              aria-pressed={active}
              title={inPlan ? undefined : 'Not included in your plan'}
              className={`h-9 rounded-lg border text-xs font-bold tracking-wide transition-all ${
                !inPlan
                  ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                  : active
                    ? 'bg-red-50 text-red-700 border-red-400'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-red-200'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {planModules !== null && availableCount < MODULES.length && (
        <p className="text-[10px] text-slate-400">
          Greyed-out modules are not part of your current plan.
        </p>
      )}
      {selected.length === 0 && (
        <p className="text-[10px] text-amber-600 font-medium">
          With no modules selected, this person can sign in but will not see any module.
        </p>
      )}
    </div>
  );
}

export default function AdminTeam() {
  const currentUser = useAuthStore((s) => s.user);
  const tenantName  = currentUser?.tenantName ?? 'your organisation';

  const navigate = useNavigate();
  const { tenantId } = useParams();
  const openPermissions = (user) => navigate(`/company/${tenantId}/team/${user.id}`);

  // Server state
  const { data: stats,   isLoading: statsLoading,   error: statsError   } = useTeamStats();
  const { data: members, isLoading: membersLoading, error: membersError } = useTeamMembers();

  // The plans on offer, so module access can be limited to what this company bought.
  // Same query key as the My Plan page, so the two share one cached response.
  const { data: packages = [] } = useQuery({
    queryKey: ['admin-packages'],
    queryFn:  packageService.getAdminPackages,
  });
  const currentPackage = packages.find((p) => p.id === currentUser?.packageId);
  const planModules = currentPackage?.appIds ?? null;

  // Mutations
  const inviteUser        = useInviteUser();
  const updateUserStatus  = useUpdateUserStatus();
  const updateUserModules = useUpdateUserModules();
  const updateUserRole    = useUpdateUserRole();
  const deleteUser        = useDeleteUser();

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName,    setInviteName]    = useState('');
  const [inviteEmail,   setInviteEmail]   = useState('');
  const [inviteRole,    setInviteRole]    = useState('ROLE_USER');
  const [inviteModules, setInviteModules] = useState([]);

  const [editModulesUser, setEditModulesUser] = useState(null);
  const [editModules,     setEditModules]     = useState([]);

  const [confirmUser,   setConfirmUser]   = useState(null); // pending status change
  const [confirmRole,   setConfirmRole]   = useState(null); // pending role change
  const [confirmDelete, setConfirmDelete] = useState(null); // pending deletion

  const resetInvite = () => {
    setInviteName('');
    setInviteEmail('');
    setInviteRole('ROLE_USER');
    setInviteModules([]);
  };

  const toggleInModules = (setter) => (key) =>
    setter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const openEditModules = (user) => {
    setEditModulesUser(user);
    setEditModules(user.moduleIds ?? []);
  };

  const closeEditModules = () => {
    setEditModulesUser(null);
    setEditModules([]);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInvite = (e) => {
    e.preventDefault();
    inviteUser.mutate(
      {
        name:      inviteName.trim(),
        email:     inviteEmail.trim(),
        role:      inviteRole,
        moduleIds: inviteModules,
      },
      {
        onSuccess: () => {
          setShowInvite(false);
          resetInvite();
        },
      },
    );
  };

  const handleSaveModules = () => {
    updateUserModules.mutate(
      { userId: editModulesUser.id, moduleIds: editModules },
      { onSuccess: closeEditModules },
    );
  };

  const handleConfirmStatus = () => {
    if (!confirmUser) return;
    updateUserStatus.mutate(
      { userId: confirmUser.id, enabled: !confirmUser.enabled },
      { onSettled: () => setConfirmUser(null) },
    );
  };

  const handleConfirmRole = () => {
    if (!confirmRole) return;
    updateUserRole.mutate(
      { userId: confirmRole.id, role: confirmRole.nextRole },
      { onSettled: () => setConfirmRole(null) },
    );
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    deleteUser.mutate(confirmDelete.id, { onSettled: () => setConfirmDelete(null) });
  };

  // ── Seats ─────────────────────────────────────────────────────────────────
  // The figures are counted by the server; only the wording is decided here. A limit of
  // 0 or missing means the plan states no limit, which is shown as "—" rather than as a
  // zero that would read like "no seats at all".
  const totalMembers     = stats?.totalMembers     ?? 0;
  const activeMembers    = stats?.activeMembers    ?? 0;
  const suspendedMembers = stats?.suspendedMembers ?? 0;
  const seatLimit        = stats?.tierLimit ?? 0;
  const hasSeatLimit     = seatLimit > 0;
  const seatsLeft        = hasSeatLimit ? Math.max(0, seatLimit - totalMembers) : null;
  const seatsFull        = hasSeatLimit && totalMembers >= seatLimit;
  const usagePct         = hasSeatLimit ? Math.min(100, Math.round((totalMembers / seatLimit) * 100)) : 0;
  const currentPlan      = stats?.currentPlan && stats.currentPlan !== 'No Plan'
    ? stats.currentPlan
    : null;

  // ── Rules that also live on the server, applied here so a button is never a trap ──
  const activeAdminCount = (members ?? []).filter(
    (m) => m.enabled && m.role === 'ROLE_ADMIN',
  ).length;

  /** Why this member cannot be suspended or deleted — or null when they can be. */
  const protectedReason = (member) => {
    if (member.id === currentUser?.uid) return 'You cannot change your own account here.';
    if (member.enabled && member.role === 'ROLE_ADMIN' && activeAdminCount <= 1) {
      return 'This is the only active administrator. Add another one first.';
    }
    return null;
  };

  /**
   * Why this member's role cannot be changed — or null when it can be.
   *
   * The same rules the server applies, so the button explains itself instead of failing
   * after the click. Promoting a member is always allowed; only REMOVING administrator
   * rights is restricted, which is why the last-admin rule is checked on that direction.
   */
  const roleChangeBlockedReason = (member) => {
    if (member.id === currentUser?.uid) return 'You cannot change your own role.';
    if (member.role === 'ROLE_ADMIN' && member.enabled && activeAdminCount <= 1) {
      return 'This is the only active administrator. Make someone else an administrator first.';
    }
    return null;
  };

  const inviteBlockedReason = seatsFull
    ? `All ${seatLimit} seats on your plan are in use.`
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team</h1>
          <p className="text-sm text-slate-500 font-medium">
            People in <span className="text-slate-700">{tenantName}</span> and the modules they can use.
          </p>
        </div>
        <Button
          className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm w-full sm:w-auto"
          onClick={() => setShowInvite(true)}
          disabled={!!inviteBlockedReason}
          title={inviteBlockedReason ?? undefined}
        >
          <UserPlus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Invite member
        </Button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      {statsError ? (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 sm:px-6 py-4 text-sm text-rose-700 flex items-start gap-2"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          Team figures could not be loaded. Refresh the page to try again.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Members',   value: totalMembers,     icon: Users,     color: 'text-slate-300' },
            { label: 'Active',    value: activeMembers,    icon: UserCheck, color: 'text-emerald-300' },
            { label: 'Suspended', value: suspendedMembers, icon: UserX,     color: 'text-rose-300' },
            {
              label: 'Seats in plan',
              value: hasSeatLimit ? seatLimit : '—',
              icon: Users,
              color: 'text-red-300',
            },
          ].map((s) => (
            <Card key={s.label} className="bg-white border-slate-200 shadow-sm rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {s.label}
                </CardTitle>
                <s.icon className={`h-4 w-4 flex-shrink-0 ${s.color}`} aria-hidden="true" />
              </CardHeader>
              <CardContent>
                {statsLoading
                  ? <div className="h-8 w-12 bg-slate-100 rounded animate-pulse" />
                  : <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Seat usage ─────────────────────────────────────────────────────── */}
      {/* Only shown when the plan actually states a limit — a progress bar against an
          unknown total would be meaningless. */}
      {!statsError && (statsLoading || hasSeatLimit) && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="py-4 px-4 sm:px-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-bold text-slate-600">Seats used</span>
              <span className="text-xs font-bold text-slate-900 tabular-nums">
                {statsLoading ? '…' : `${totalMembers} / ${seatLimit}`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${seatsFull ? 'bg-rose-500' : 'bg-red-500'}`}
                style={{ width: statsLoading ? '0%' : `${usagePct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              {statsLoading ? (
                <span className="inline-block h-3 w-48 bg-slate-100 rounded animate-pulse" />
              ) : seatsFull ? (
                <>
                  All seats on your{currentPlan ? <> <span className="font-bold text-slate-500">{currentPlan}</span></> : null}{' '}
                  plan are in use. To invite more people you need more seats —{' '}
                  <Link to={`/company/${tenantId}/my-plan`} className="text-red-600 font-bold hover:underline">
                    see your plan
                  </Link>.
                </>
              ) : (
                <>
                  {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} still free
                  {currentPlan ? <> on your <span className="font-bold text-slate-500">{currentPlan}</span> plan</> : null}.
                </>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Members ────────────────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {membersError ? (
            <div className="px-6 py-10 flex flex-col items-center gap-2 text-center" role="alert">
              <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700">The team list could not be loaded.</p>
              <p className="text-xs text-slate-400">Refresh the page to try again.</p>
            </div>
          ) : membersLoading ? (
            <div className="divide-y divide-slate-50" role="status" aria-live="polite">
              <span className="sr-only">Loading team members</span>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-4 sm:px-6 py-4 flex items-center gap-4 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                    <div className="h-2.5 w-48 bg-slate-100 rounded" />
                  </div>
                  <div className="h-5 w-14 bg-slate-100 rounded-full hidden sm:block" />
                  <div className="h-7 w-20 bg-slate-100 rounded hidden md:block" />
                </div>
              ))}
            </div>
          ) : !members || members.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <Users className="h-10 w-10 text-slate-200" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-500">No members yet</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Invite a colleague to give them access to your compliance modules.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="px-4 sm:px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Member</TableHead>
                  <TableHead className="px-4 sm:px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email</TableHead>
                  <TableHead className="px-4 sm:px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Role</TableHead>
                  <TableHead className="px-4 sm:px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</TableHead>
                  <TableHead className="px-4 sm:px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Added</TableHead>
                  <TableHead className="text-right px-4 sm:px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((u) => {
                  const isActive      = u.enabled;
                  const isPendingThis = updateUserStatus.isPending && updateUserStatus.variables?.userId === u.id;
                  const locked        = protectedReason(u);
                  const isAdmin       = u.role === 'ROLE_ADMIN';
                  const roleLocked    = roleChangeBlockedReason(u);
                  const roleIsPending = updateUserRole.isPending && updateUserRole.variables?.userId === u.id;

                  return (
                    <TableRow key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">

                      <TableCell className="px-4 sm:px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openPermissions(u)}
                          className="flex items-center gap-3 text-left group rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                        >
                          <span className="h-8 w-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-xs font-bold text-red-600 flex-shrink-0" aria-hidden="true">
                            {initials(u.name)}
                          </span>
                          <span className="font-semibold text-sm text-slate-700 group-hover:text-red-600 group-hover:underline transition-colors">
                            {u.name}
                            {u.id === currentUser?.uid && (
                              <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-400">(you)</span>
                            )}
                          </span>
                        </button>
                      </TableCell>

                      <TableCell className="px-4 sm:px-6 py-4 text-xs text-slate-500 break-all">{u.email}</TableCell>

                      <TableCell className="px-4 sm:px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border whitespace-nowrap ${ROLE_STYLES[u.role] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {u.role === 'ROLE_ADMIN' ? 'Administrator' : 'Member'}
                        </span>
                      </TableCell>

                      <TableCell className="px-4 sm:px-6 py-4">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden="true" />
                          <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isActive ? 'Active' : 'Suspended'}
                          </span>
                        </span>
                      </TableCell>

                      <TableCell className="px-4 sm:px-6 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </TableCell>

                      {/* Labels collapse to icons on narrow screens so the row still fits. */}
                      <TableCell className="text-right px-4 sm:px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold h-8 px-2 lg:px-3 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openPermissions(u)}
                          >
                            <ShieldCheck className="h-3.5 w-3.5 lg:mr-1" aria-hidden="true" />
                            <span className="hidden lg:inline">Permissions</span>
                            <span className="sr-only lg:hidden">Permissions for {u.name}</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold h-8 px-2 lg:px-3 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openEditModules(u)}
                            disabled={updateUserModules.isPending}
                          >
                            <LayoutGrid className="h-3.5 w-3.5 lg:mr-1" aria-hidden="true" />
                            <span className="hidden lg:inline">Modules</span>
                            <span className="sr-only lg:hidden">Modules for {u.name}</span>
                          </Button>

                          {/* Role — the only action whose label depends on where the
                              member currently stands. */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold h-8 px-2 lg:px-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => setConfirmRole({
                              id: u.id,
                              name: u.name,
                              currentRole: u.role,
                              nextRole: isAdmin ? 'ROLE_USER' : 'ROLE_ADMIN',
                            })}
                            disabled={roleIsPending || !!roleLocked}
                            title={roleLocked ?? (isAdmin ? 'Remove administrator rights' : 'Make administrator')}
                          >
                            {roleIsPending
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              : <UserCog className="h-3.5 w-3.5 lg:mr-1" aria-hidden="true" />}
                            <span className="hidden lg:inline">
                              {isAdmin ? 'Make member' : 'Make admin'}
                            </span>
                            <span className="sr-only lg:hidden">
                              {isAdmin ? `Remove administrator rights from ${u.name}` : `Make ${u.name} an administrator`}
                            </span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={`text-xs font-bold h-8 px-2 lg:px-3 text-slate-400 ${
                              isActive ? 'hover:text-rose-600 hover:bg-rose-50' : 'hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            onClick={() => setConfirmUser({ id: u.id, name: u.name, enabled: u.enabled })}
                            disabled={isPendingThis || !!locked}
                            title={locked ?? undefined}
                          >
                            {isPendingThis ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : isActive ? (
                              <>
                                <UserX className="h-3.5 w-3.5 lg:mr-1" aria-hidden="true" />
                                <span className="hidden lg:inline">Suspend</span>
                                <span className="sr-only lg:hidden">Suspend {u.name}</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5 lg:mr-1" aria-hidden="true" />
                                <span className="hidden lg:inline">Reactivate</span>
                                <span className="sr-only lg:hidden">Reactivate {u.name}</span>
                              </>
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold h-8 px-2 lg:px-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => setConfirmDelete({ id: u.id, name: u.name })}
                            disabled={deleteUser.isPending || !!locked}
                            title={locked ?? undefined}
                          >
                            <Trash2 className="h-3.5 w-3.5 lg:mr-1" aria-hidden="true" />
                            <span className="hidden lg:inline">Delete</span>
                            <span className="sr-only lg:hidden">Delete {u.name}</span>
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

      {/* ── Invite ─────────────────────────────────────────────────────────── */}
      <Dialog
        open={showInvite}
        onOpenChange={(open) => {
          if (inviteUser.isPending) return;
          setShowInvite(open);
          if (!open) resetInvite();
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">Invite a team member</DialogTitle>
            <DialogDescription className="text-slate-500">
              They receive an email with a temporary password and choose their own password
              when they first sign in.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Full name
              </Label>
              <Input
                id="invite-name"
                placeholder="e.g. Jan Kowalski"
                className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                maxLength={200}
                autoComplete="off"
                disabled={inviteUser.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Work email
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jan.kowalski@example.pl"
                className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                maxLength={254}
                autoComplete="off"
                disabled={inviteUser.isPending}
              />
              <p className="text-[10px] text-slate-400">The invitation is sent to this address.</p>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Role</span>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setInviteRole(r.value)}
                    disabled={inviteUser.isPending}
                    aria-pressed={inviteRole === r.value}
                    className={`h-10 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${
                      inviteRole === r.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-red-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                {ROLE_OPTIONS.find((r) => r.value === inviteRole)?.help}
              </p>
            </div>

            <ModulePicker
              selected={inviteModules}
              onToggle={toggleInModules(setInviteModules)}
              disabled={inviteUser.isPending}
              planModules={planModules}
            />

            {/* Data minimisation, stated where the data is collected (GDPR Art. 5(1)(c)). */}
            <p className="flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px text-slate-300" aria-hidden="true" />
              Only the name, work email and access level above are stored for this person.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowInvite(false); resetInvite(); }}
                className="flex-1 text-slate-500 font-bold"
                disabled={inviteUser.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold"
                disabled={inviteUser.isPending}
              >
                {inviteUser.isPending
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />Sending…</>
                  : 'Send invitation'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Suspend / reactivate ───────────────────────────────────────────── */}
      <Dialog
        open={!!confirmUser}
        onOpenChange={(open) => { if (!open && !updateUserStatus.isPending) setConfirmUser(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">
              {confirmUser?.enabled ? 'Suspend this member?' : 'Reactivate this member?'}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {confirmUser?.enabled ? (
                <>
                  <strong className="text-slate-700">{confirmUser?.name}</strong> will not be able to
                  sign in, and their email notifications are switched off. Their account and records
                  are kept, and you can reactivate them at any time.
                </>
              ) : (
                <>
                  <strong className="text-slate-700">{confirmUser?.name}</strong> will be able to sign
                  in again. Their modules and permissions are unchanged; email notifications stay off
                  until they are turned back on.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmUser(null)}
              className="flex-1 text-slate-500 font-bold"
              disabled={updateUserStatus.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmStatus}
              disabled={updateUserStatus.isPending}
              className={`flex-1 font-bold text-white ${
                confirmUser?.enabled ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {updateUserStatus.isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />Saving…</>
                : confirmUser?.enabled ? 'Suspend' : 'Reactivate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change role ────────────────────────────────────────────────────── */}
      <Dialog
        open={!!confirmRole}
        onOpenChange={(open) => { if (!open && !updateUserRole.isPending) setConfirmRole(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">
              {confirmRole?.nextRole === 'ROLE_ADMIN'
                ? 'Make this person an administrator?'
                : 'Remove administrator rights?'}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {confirmRole?.nextRole === 'ROLE_ADMIN' ? (
                <>
                  <strong className="text-slate-700">{confirmRole?.name}</strong> will be able to
                  invite and remove people, change what everyone can use, and edit the company
                  profile — the same things you can do.
                </>
              ) : (
                <>
                  <strong className="text-slate-700">{confirmRole?.name}</strong> will keep their
                  modules and permissions, but will no longer be able to manage the team or the
                  company profile.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <p className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 leading-relaxed">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px text-slate-400" aria-hidden="true" />
            The change applies the next time they load the application, and is recorded in the
            audit trail.
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmRole(null)}
              className="flex-1 text-slate-500 font-bold"
              disabled={updateUserRole.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRole}
              disabled={updateUserRole.isPending}
              className="flex-1 font-bold text-white bg-red-600 hover:bg-red-700"
            >
              {updateUserRole.isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />Saving…</>
                : confirmRole?.nextRole === 'ROLE_ADMIN' ? 'Make administrator' : 'Make member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete ─────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open && !deleteUser.isPending) setConfirmDelete(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">Delete this member?</DialogTitle>
            <DialogDescription className="text-slate-500">
              <strong className="text-slate-700">{confirmDelete?.name}</strong> is removed from your
              organisation and can no longer sign in. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {/* Says what deletion does NOT remove, so nobody treats this as an erasure
              request under GDPR Art. 17 — compliance records are kept on purpose. */}
          <p className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 leading-relaxed">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px text-slate-400" aria-hidden="true" />
            Records they entered in the modules, and the audit trail of what they did, are kept —
            RegulaOne has to retain those for compliance.
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(null)}
              className="flex-1 text-slate-500 font-bold"
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
              {deleteUser.isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />Deleting…</>
                : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit module access ─────────────────────────────────────────────── */}
      <Dialog
        open={!!editModulesUser}
        onOpenChange={(open) => { if (!open && !updateUserModules.isPending) closeEditModules(); }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">Module access</DialogTitle>
            <DialogDescription className="text-slate-500">
              Choose what <strong className="text-slate-700">{editModulesUser?.name}</strong> can open.
              Changes apply the next time they load the application.
            </DialogDescription>
          </DialogHeader>

          <ModulePicker
            selected={editModules}
            onToggle={toggleInModules(setEditModules)}
            disabled={updateUserModules.isPending}
            planModules={planModules}
          />

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={closeEditModules}
              className="flex-1 text-slate-500 font-bold"
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
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />Saving…</>
                : 'Save changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
