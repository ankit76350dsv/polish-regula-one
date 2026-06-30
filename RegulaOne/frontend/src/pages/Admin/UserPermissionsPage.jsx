// User Permissions page — opened when an admin clicks a member in Team Management.
// Shows the user's details and lets the admin add/remove cross-app permission codes
// (e.g. the KSeF roles). Reuses the already-cached members list so no extra
// single-user endpoint is needed; React Query refetches it on a hard refresh.

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck, Loader2, AlertTriangle, Check } from 'lucide-react';
import {
  useTeamMembers, useUpdateUserPermissions,
  useSuperAdminUsers, useUpdateSuperAdminUserPermissions,
} from '../../hooks/useTeam';
import { useAuthStore } from '../../store/authStore';

// Catalogue of assignable permissions, grouped by the app that owns them.
// Adding a new app later = add another group here; the page renders it automatically.
// The codes MUST match what the backend/module expects (see KsefPermission on the
// KSeFFlow side: KSEF_ADMIN, KSEF_CASE_MANAGER, …).
const PERMISSION_GROUPS = [
  {
    app: 'KSeFFlow',
    description: 'National e-Invoice (KSeF) permissions',
    permissions: [
      {
        // PLATFORM-LEVEL: declaring the GLOBAL KSeF emergency/unavailability state (one value for
        // ALL tenants). Only a platform operator (ROLE_SUPER_ADMIN) may grant this — it is hidden
        // from company admins and the backend refuses to let a non-super-admin change it.
        code: 'KSEF_PLATFORM_ADMIN',
        label: 'Platform Operator (KSeF availability)',
        desc: 'Declare the global KSeF emergency / unavailability state for the whole platform. Operator-only.',
        superAdminOnly: true,
      },
      {
        code: 'KSEF_ADMIN',
        label: 'KSEF Admin',
        desc: 'Full control within the company: manage certificates and grant/revoke KSeF permissions.',
      },
      {
        code: 'KSEF_CASE_MANAGER',
        label: 'Case Manager',
        desc: 'Day-to-day invoicing: create, submit and correct invoices.',
      },
      {
        code: 'KSEF_COMPLIANCE_OFFICER',
        label: 'Compliance Officer',
        desc: 'Oversight and compliance checks; read access without issuing invoices.',
      },
      {
        code: 'KSEF_AUDITOR',
        label: 'Auditor',
        desc: 'Read-only access to invoices, UPOs and audit logs, plus export.',
      },
      {
        code: 'KSEF_EMPLOYEE',
        label: 'Employee',
        desc: 'Baseline member access; no invoicing rights.',
      },
    ],
  },
  {
    app: 'SafeVoice',
    description: 'Whistleblower case-management (EU Directive 2019/1937) permissions',
    // Codes MUST match SafeVoicePermission on the SafeVoice backend.
    permissions: [
      {
        code: 'SAFEVOICE_ADMIN',
        label: 'SafeVoice Admin',
        desc: 'Full control: invite officers, manage retention and legal holds.',
      },
      {
        code: 'SAFEVOICE_COMPLIANCE_OFFICER',
        label: 'Compliance Officer',
        desc: 'Triage cases, change status, assign investigators, message reporters.',
      },
      {
        code: 'SAFEVOICE_INVESTIGATOR',
        label: 'Investigator',
        desc: 'Work assigned cases: add evidence and post case messages.',
      },
      {
        code: 'SAFEVOICE_HR_MANAGER',
        label: 'HR Manager',
        desc: 'Handle HR-handoff (labour dispute / grievance) cases only.',
      },
      {
        code: 'SAFEVOICE_AUDITOR',
        label: 'Auditor',
        desc: 'Read-only access to cases, audit logs and retention exports.',
      },
    ],
  },
];

// Derives avatar initials from a full name string (up to 2 characters).
function initials(name = '') {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function UserPermissionsPage() {
  const { tenantId, userId } = useParams();
  const navigate = useNavigate();

  // The page is shared by two roles:
  //   - Company Admin (ROLE_ADMIN): edits their own tenant's users via /api/admin/**.
  //   - Platform operator (ROLE_SUPER_ADMIN): edits any user via /api/superadmin/** and is the
  //     ONLY role allowed to grant the platform-level KSEF_PLATFORM_ADMIN code.
  const role = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = role === 'ROLE_SUPER_ADMIN';

  // Both data sources are wired up unconditionally (React hooks rule); we use the one that
  // matches the current role. The admin query is auto-disabled when there is no tenantId,
  // so a super-admin (no tenant) does not trigger a bad request.
  const adminQuery = useTeamMembers();
  const superQuery = useSuperAdminUsers({ enabled: isSuperAdmin });
  const { data: members, isLoading, error } = isSuperAdmin ? superQuery : adminQuery;

  const user = useMemo(
    () => members?.find((m) => m.id === userId),
    [members, userId],
  );

  // Pick the matching save mutation for the current role's API namespace.
  const adminUpdate = useUpdateUserPermissions();
  const superUpdate = useUpdateSuperAdminUserPermissions();
  const updatePermissions = isSuperAdmin ? superUpdate : adminUpdate;

  // Hide platform-operator-only permissions from anyone who is not a platform operator.
  const visibleGroups = useMemo(
    () => PERMISSION_GROUPS.map((g) => ({
      ...g,
      permissions: g.permissions.filter((p) => isSuperAdmin || !p.superAdminOnly),
    })).filter((g) => g.permissions.length > 0),
    [isSuperAdmin],
  );
  const visibleCodeCount = useMemo(
    () => visibleGroups.flatMap((g) => g.permissions.map((p) => p.code)).length,
    [visibleGroups],
  );

  // Local working copy of the user's permission codes — edited until "Save".
  const [selected, setSelected] = useState([]);

  // Seed the local selection once the user is loaded (or changes).
  useEffect(() => {
    if (user) setSelected(user.permissions ?? []);
  }, [user]);

  const toggle = (code) =>
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  // Return to wherever this editor was opened from (super-admin users list vs admin team page).
  const goBack = () => navigate(`/company/${tenantId}/${isSuperAdmin ? 'users' : 'team'}`);

  const handleSave = () => {
    updatePermissions.mutate(
      { userId, permissions: selected },
      { onSuccess: goBack },
    );
  };

  // True when the working copy differs from what's stored — gates the Save button.
  const original = user?.permissions ?? [];
  const isDirty =
    selected.length !== original.length ||
    selected.some((c) => !original.includes(c));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto">

      {/* ── Back link ──────────────────────────────────────────────────────── */}
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Team Management
      </button>

      {/* ── Loading / error / not-found states ─────────────────────────────── */}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Failed to load user: {error.message}
        </div>
      ) : isLoading ? (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </CardContent>
        </Card>
      ) : !user ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          User not found in your organisation.
        </div>
      ) : (
        <>
          {/* ── User header card ─────────────────────────────────────────────── */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardContent className="py-5 px-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-base font-bold text-red-600 flex-shrink-0">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">{user.name}</h2>
                <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
              </div>
              <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border bg-slate-100 text-slate-600 border-slate-200">
                {user.role?.replace('ROLE_', '') ?? user.role}
              </span>
            </CardContent>
          </Card>

          {/* ── Permissions editor ───────────────────────────────────────────── */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-100 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-red-50">
                    <ShieldCheck className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">Permissions</CardTitle>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">
                      Grant or revoke what this user can do inside each app
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {selected.length} of {visibleCodeCount} granted
                </span>
              </div>
            </CardHeader>

            <CardContent className="py-6 px-6 space-y-7">
              {visibleGroups.map((group) => (
                <div key={group.app} className="space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{group.app}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{group.description}</p>
                  </div>

                  <div className="space-y-2">
                    {group.permissions.map((perm) => {
                      const active = selected.includes(perm.code);
                      return (
                        <button
                          key={perm.code}
                          type="button"
                          onClick={() => toggle(perm.code)}
                          disabled={updatePermissions.isPending}
                          className={`w-full flex items-start gap-3 text-left rounded-lg border p-3 transition-all ${
                            active
                              ? 'bg-red-50 border-red-400'
                              : 'bg-white border-slate-200 hover:border-red-200'
                          }`}
                        >
                          {/* Checkbox indicator */}
                          <span
                            className={`mt-0.5 h-4 w-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                              active ? 'bg-red-600 border-red-600' : 'bg-white border-slate-300'
                            }`}
                          >
                            {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0">
                            <span className={`block text-xs font-bold ${active ? 'text-red-700' : 'text-slate-700'}`}>
                              {perm.label}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-medium leading-snug">
                              {perm.desc}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Save / Cancel actions ────────────────────────────────────────── */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              className="text-slate-400 font-bold"
              disabled={updatePermissions.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || updatePermissions.isPending}
              className="bg-red-600 text-white hover:bg-red-700 font-bold px-6"
            >
              {updatePermissions.isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
                : 'Save Changes'
              }
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
