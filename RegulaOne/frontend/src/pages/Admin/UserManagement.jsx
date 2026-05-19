// Platform-wide User Management page for ROLE_SUPER_ADMIN.
// Replaces the mock-data implementation used during UI development.
// Now wired to:
//   GET  /api/superadmin/team-management   → stats cards
//   GET  /api/superadmin/list-all-users    → users table
//   PATCH /api/admin/users/{userId}/status → suspend / reactivate

import { useState, useMemo } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Users, UserCheck, UserX, ShieldCheck, UserPlus,
  AlertTriangle, Loader2, Search, ChevronLeft, ChevronRight,
  CalendarDays, Package,
} from 'lucide-react';
import { useSuperAdminStats, useSuperAdminUsers, useUpdateSuperAdminUserStatus } from '../../hooks/useTeam';

// OLD MOCK DATA — commented out in favour of real API data from /api/superadmin/*
// const MOCK_USERS = [
//   { id: 'u1', displayName: 'Anna Kowalska',        email: 'anna.kowalska@polcorp.pl',    role: 'ROLE_ADMIN', tenant: 'PolCorp Sp. z o.o.', status: 'active',    joinedAt: '2024-01-16' },
//   { id: 'u2', displayName: 'Jan Nowak',             email: 'jan.nowak@polcorp.pl',        role: 'ROLE_USER',  tenant: 'PolCorp Sp. z o.o.', status: 'active',    joinedAt: '2024-01-20' },
//   { id: 'u3', displayName: 'Piotr Wiśniewski',      email: 'p.wisniewski@vistula.pl',     role: 'ROLE_ADMIN', tenant: 'Vistula Logistics',  status: 'active',    joinedAt: '2024-02-22' },
//   { id: 'u4', displayName: 'Maria Zielińska',       email: 'm.zielinska@vistula.pl',      role: 'ROLE_USER',  tenant: 'Vistula Logistics',  status: 'suspended', joinedAt: '2024-03-05' },
//   { id: 'u5', displayName: 'Tomasz Wójcik',         email: 't.wojcik@ambertech.pl',       role: 'ROLE_ADMIN', tenant: 'Amber Tech Group',   status: 'suspended', joinedAt: '2024-03-12' },
//   { id: 'u6', displayName: 'Katarzyna Lewandowska', email: 'k.lewandowska@nordic.pl',     role: 'ROLE_USER',  tenant: 'Nordic Services PL', status: 'active',    joinedAt: '2024-04-08' },
//   { id: 'u7', displayName: 'Michał Dąbrowski',      email: 'm.dabrowski@nordic.pl',       role: 'ROLE_ADMIN', tenant: 'Nordic Services PL', status: 'active',    joinedAt: '2024-04-10' },
//   { id: 'u8', displayName: 'Agnieszka Kamińska',    email: 'a.kaminska@mazovia.pl',       role: 'ROLE_USER',  tenant: 'Mazovia Capital SA', status: 'active',    joinedAt: '2024-05-14' },
// ];

const ROLE_STYLES = {
  ROLE_SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200',
  ROLE_ADMIN:       'bg-blue-100 text-blue-700 border-blue-200',
  ROLE_USER:        'bg-slate-100 text-slate-600 border-slate-200',
};

const PAGE_SIZE = 10;

function initials(name = '') {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function UserManagement() {
  // ── Server state ──────────────────────────────────────────────────────────
  const { data: stats,   isLoading: statsLoading,   error: statsError   } = useSuperAdminStats();
  const { data: users,   isLoading: usersLoading,   error: usersError   } = useSuperAdminUsers();
  const updateStatus = useUpdateSuperAdminUserStatus();

  // ── Local UI state ────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'suspended'
  const [page,         setPage]         = useState(1);

  // Confirmation modal state — holds the user pending a status change
  const [confirmUser, setConfirmUser] = useState(null); // { id, name, enabled }

  // ── Client-side filtering + pagination ────────────────────────────────────
  // Applied in-memory so we don't need extra API calls for search/filter.
  const filtered = useMemo(() => {
    let result = users ?? [];

    if (statusFilter === 'active')    result = result.filter((u) => u.enabled);
    if (statusFilter === 'suspended') result = result.filter((u) => !u.enabled);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.tenantName?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [users, statusFilter, search]);

  // Reset to page 1 whenever the filtered set changes
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleFilterChange = (f) => {
    setStatusFilter(f);
    setPage(1);
  };

  // ── Confirmation modal handlers ───────────────────────────────────────────
  const handleStatusClick = (user) => {
    setConfirmUser({ id: user.id, name: user.name, enabled: user.enabled });
  };

  const handleConfirmStatus = () => {
    if (!confirmUser) return;
    updateStatus.mutate(
      { userId: confirmUser.id, enabled: !confirmUser.enabled },
      { onSettled: () => setConfirmUser(null) },
    );
  };

  // ── Derived stats values ──────────────────────────────────────────────────
  const totalMembers     = stats?.totalMembers      ?? 0;
  const activeMembers    = stats?.activeMembers     ?? 0;
  const suspendedMembers = stats?.suspendedMembers  ?? 0;
  const userCapacity     = stats?.tierLimit         ?? 0;
  const remainingCapacity= stats?.remainingSeats    ?? 0;
  const packageName      = stats?.currentPlan       ?? '—';
  const packageExpiry    = stats?.planExpiresAt     ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Users</h2>
          <p className="text-sm text-slate-500 font-medium">Manage all user accounts across every tenant node.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2"
          >
            Export CSV
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm">
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite User
          </Button>
        </div>
      </div>

      {/* ── Stats error banner ────────────────────────────────────────────── */}
      {statsError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Failed to load platform stats: {statsError.message}
        </div>
      )}

      {/* ── Row 1: Member count cards ─────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Members',  value: totalMembers,     icon: Users,      color: 'text-slate-300'   },
          { label: 'Active',         value: activeMembers,    icon: UserCheck,  color: 'text-emerald-300' },
          { label: 'Suspended',      value: suspendedMembers, icon: UserX,      color: 'text-rose-300'    },
          { label: 'User Capacity',  value: userCapacity,     icon: ShieldCheck, color: 'text-red-300'   },
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

      {/* ── Row 2: Package / capacity info cards ──────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remaining Capacity</CardTitle>
            <Users className="h-4 w-4 text-amber-300" />
          </CardHeader>
          <CardContent>
            {statsLoading
              ? <div className="h-8 w-12 bg-slate-100 rounded animate-pulse" />
              : <p className="text-2xl font-bold text-slate-900 tracking-tight">{remainingCapacity}</p>
            }
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Package</CardTitle>
            <Package className="h-4 w-4 text-violet-300" />
          </CardHeader>
          <CardContent>
            {statsLoading
              ? <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
              : <p className="text-xl font-bold text-slate-900 tracking-tight">{packageName}</p>
            }
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Package Expiry</CardTitle>
            <CalendarDays className="h-4 w-4 text-rose-300" />
          </CardHeader>
          <CardContent>
            {statsLoading
              ? <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
              : <p className={`text-lg font-bold tracking-tight ${packageExpiry ? 'text-slate-900' : 'text-slate-300'}`}>
                  {formatDate(packageExpiry)}
                </p>
            }
          </CardContent>
        </Card>
      </div>

      {/* ── Confirmation modal ────────────────────────────────────────────── */}
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
                  ? <>Are you sure you want to suspend <strong>{confirmUser.name}</strong>? They will lose platform access immediately.</>
                  : <>Are you sure you want to reactivate <strong>{confirmUser.name}</strong>? They will regain platform access.</>
                }
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmUser(null)}
                  className="flex-1 text-slate-400 font-bold"
                  disabled={updateStatus.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmStatus}
                  disabled={updateStatus.isPending}
                  className={`flex-1 font-bold text-white ${
                    confirmUser.enabled
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {updateStatus.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Updating…</>
                  ) : confirmUser.enabled ? 'Yes, Suspend' : 'Yes, Reactivate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Users table card ─────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">

        {/* Search + filter toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by name, email, or organisation…"
              className="pl-8 h-9 text-xs border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500 w-full"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {[
              { key: 'all',       label: 'All' },
              { key: 'active',    label: 'Active' },
              { key: 'suspended', label: 'Suspended' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`h-9 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  statusFilter === f.key
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <CardContent className="p-0">
          {usersError ? (
            <div className="px-6 py-10 flex flex-col items-center gap-2 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
              <p className="text-sm font-medium">Failed to load users</p>
              <p className="text-xs text-slate-400">{usersError.message}</p>
            </div>
          ) : usersLoading ? (
            // Skeleton rows while loading
            <div className="divide-y divide-slate-50">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                    <div className="h-2.5 w-48 bg-slate-100 rounded" />
                  </div>
                  <div className="h-5 w-14 bg-slate-100 rounded-full" />
                  <div className="h-4 w-28 bg-slate-100 rounded" />
                  <div className="h-5 w-16 bg-slate-100 rounded-full" />
                  <div className="h-4 w-20 bg-slate-100 rounded" />
                  <div className="h-7 w-20 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-slate-400">
              <Users className="h-10 w-10 text-slate-200" />
              <p className="text-sm font-semibold text-slate-500">
                {search || statusFilter !== 'all' ? 'No users match your search.' : 'No users found.'}
              </p>
              {(search || statusFilter !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setStatusFilter('all'); }}
                  className="text-xs text-red-600 font-semibold hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Member</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Role</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Organisation</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Created</TableHead>
                  <TableHead className="text-right px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((u) => {
                  const isActive      = u.enabled;
                  const isPendingThis = updateStatus.isPending && updateStatus.variables?.userId === u.id;

                  return (
                    <TableRow key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">

                      {/* Avatar + full name */}
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-xs font-bold text-red-600 flex-shrink-0">
                            {initials(u.name)}
                          </div>
                          <span className="font-semibold text-sm text-slate-700">{u.name}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-6 py-4 text-xs text-slate-500 font-mono">{u.email}</TableCell>

                      {/* Role badge */}
                      <TableCell className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${ROLE_STYLES[u.role] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {u.role?.replace('ROLE_', '').replace(/_/g, ' ') ?? u.role}
                        </span>
                      </TableCell>

                      {/* Tenant name — from UserResponse.tenantName */}
                      <TableCell className="px-6 py-4 text-xs text-slate-500">
                        {u.tenantName ?? <span className="text-slate-300 italic">No org</span>}
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

                      {/* Created date — formatted from createdAt ISO string */}
                      <TableCell className="px-6 py-4 text-xs text-slate-400">
                        {formatDate(u.createdAt)}
                      </TableCell>

                      {/* Action button — opens confirmation modal */}
                      <TableCell className="text-right px-6 py-4">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* ── Pagination footer ─────────────────────────────────────────── */}
        {!usersLoading && !usersError && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-600">{(safePage - 1) * PAGE_SIZE + 1}</span>
              {' '}–{' '}
              <span className="font-semibold text-slate-600">{Math.min(safePage * PAGE_SIZE, filtered.length)}</span>
              {' '}of{' '}
              <span className="font-semibold text-slate-600">{filtered.length}</span> users
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page number pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                .reduce((acc, n, idx, arr) => {
                  if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '…' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-300">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item)}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                        safePage === item
                          ? 'bg-red-600 text-white'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
