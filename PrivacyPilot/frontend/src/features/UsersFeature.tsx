/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Plus,
  ShieldCheck,
  Mail,
  UserCheck,
  Zap,
  Lock,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppDropdown } from '../components/AppDropdown';
import { AppTable } from '../components/AppTable';
import { AppModal } from '../components/AppModal';
import { User, Role } from '../types';

interface UsersFeatureProps {
  id: string;
  initialUsers: User[];
  onInviteUser: (user: Partial<User>) => void;
  onModifyUserRole: (id: string, newRole: Role) => void;
}

export const UsersFeature: React.FC<UsersFeatureProps> = ({
  id,
  initialUsers,
  onInviteUser,
  onModifyUserRole,
}) => {
  const [users, setUsers] = useState<User[]>(initialUsers);

  // Invite modal states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Compliance Officer');

  // Interactive permission matrix view switch
  const [matrixRole, setMatrixRole] = useState<Role>('Compliance Officer');

  const ROLE_PERMISSIONS: Record<Role, string[]> = {
    Admin: ['Read processing activity catalogs', 'Write / publish new ROPAs', 'Download ROPA CSV exports', 'Delete obsolete archives', 'Manage workspace users'],
    'Compliance Officer': ['Read processing activity catalogs', 'Write / publish new ROPAs', 'Download ROPA CSV exports'],
    Auditor: ['Read processing activity catalogs', 'Download ROPA CSV exports'],
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const newUser: User = {
      id: `usr-${Math.floor(Math.random() * 90) + 10}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: 'Pending',
    };

    onInviteUser(newUser);
    setUsers((prev) => [...prev, newUser]);
    setIsInviteOpen(false);

    // reset Form
    setInviteName('');
    setInviteEmail('');
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Deauthorize and purge this member from workspace authentication lists?')) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const handleRoleChange = (id: string, role: Role) => {
    onModifyUserRole(id, role);
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role } : u))
    );
  };

  return (
    <div id={id} className="space-y-6">
      {/* Top Header info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-105">
            User Authorization & Access Matrix (Art 32)
          </h2>
          <p className="text-xs text-slate-500">
            Define system roles access scopes. Limit ROPA modifications to authorized compliance administrators.
          </p>
        </div>

        <AppButton
          id="btn-invite-colleague-trigger"
          variant="primary"
          size="sm"
          className="h-9"
          onClick={() => setIsInviteOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Invite Compliance DPA
        </AppButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Users Table (lg:col-span-8) */}
        <div className="col-span-1 lg:col-span-8 space-y-4">
          <AppCard id="user-management-panel" title="Active Platform Coworkers">
            <AppTable<User>
              id="active-users-directory-table"
              columns={[
                {
                  key: 'name',
                  header: 'EMAIL PROFILE / UNIQUE ID',
                  render: (row) => (
                    <div className="flex items-center gap-2.5">
                      <div className="h-8.5 w-8.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-950 px-2 py-1.5 rounded-lg border border-indigo-200/30 flex items-center justify-center text-indigo-650 dark:text-indigo-400">
                        {row.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 truncate">
                          {row.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ID: {row.id} | {row.email}
                        </span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'role',
                  header: 'OPERATOR SYSTEM ROLE',
                  render: (row) => (
                    <select
                      value={row.role}
                      onChange={(e) => handleRoleChange(row.id, e.target.value as Role)}
                      className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md py-1 px-2 outline-hidden text-slate-700 dark:text-slate-350 font-bold cursor-pointer"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Compliance Officer">Compliance Officer</option>
                      <option value="Auditor">Auditor (Read-Only)</option>
                    </select>
                  ),
                },
                {
                  key: 'status',
                  header: 'STATUS',
                  render: (row) => (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        row.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 animate-pulse'
                      }`}
                    >
                      {row.status}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  render: (row) => (
                    <div className="flex justify-end pr-2">
                      <button
                        onClick={() => handleDeleteUser(row.id)}
                        className="p-1 px-2.5 text-slate-400 hover:text-red-550 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                        title="Deauthorize operator access"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ),
                },
              ]}
              data={users}
            />
          </AppCard>
        </div>

        {/* Right Permission Matrix Visualization (lg:col-span-4) */}
        <div className="col-span-1 lg:col-span-4 space-y-4">
          <AppCard id="audit-matrix-card" title="Dynamic Permission Matrix Scope">
            <div className="space-y-4">
              <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-bold">
                {(['Admin', 'Compliance Officer', 'Auditor'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setMatrixRole(r)}
                    className={`pb-2.5 px-3 cursor-pointer transition-colors ${
                      matrixRole === r
                        ? 'border-b-2 border-indigo-505 text-indigo-550 font-black'
                        : 'hover:text-slate-700'
                    }`}
                  >
                    {r.split(' ')[0]}
                  </button>
                ))}
              </div>

              {/* Permissions List */}
              <div className="space-y-3">
                {[
                  { key: 'Read activities', label: 'Read processed activity catalogs', tag: 'READ' },
                  { key: 'Write activities', label: 'Write / publish new ROPAs', tag: 'WRITE' },
                  { key: 'Export activities', label: 'Download ROPA CSV exports', tag: 'EXPORT' },
                  { key: 'Delete activities', label: 'Delete obsolete archives', tag: 'DELETE' },
                  { key: 'Manage users', label: 'Manage workspace users', tag: 'SECURITY' },
                ].map((perm) => {
                  const hasAccess = ROLE_PERMISSIONS[matrixRole].some((p) =>
                    p.toLowerCase().includes(perm.key.toLowerCase()) ||
                    (perm.key === 'Read activities' && p.toLowerCase().includes('read')) ||
                    (perm.key === 'Write activities' && p.toLowerCase().includes('write')) ||
                    (perm.key === 'Export activities' && p.toLowerCase().includes('download'))
                  );

                  return (
                    <div
                      key={perm.key}
                      className={`p-3 border rounded-xl flex items-center justify-between gap-4 transition-all ${
                        hasAccess
                          ? 'bg-indigo-50/10 border-indigo-200/50'
                          : 'opacity-50 bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                          {perm.label}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-400 mt-0.5 block">
                          Scope: {perm.tag}
                        </span>
                      </div>

                      <div className="flex-shrink-0">
                        {hasAccess ? (
                          <span className="text-[10px] font-black uppercase text-emerald-550 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm">
                            Authorized ✓
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase text-rose-500 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-sm">
                            Restricted 🔒
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AppCard>
        </div>
      </div>

      {/* Invite user dialog */}
      <AppModal
        id="invite-coworker-modal"
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Compliance DPA Colleague"
        maxWidth="md"
        footer={
          <div className="flex gap-2">
            <AppButton id="btn-cancel-inv" variant="ghost" size="sm" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </AppButton>
            <AppButton id="btn-submit-inv" variant="primary" size="sm" onClick={handleInviteSubmit}>
              Register Operator
            </AppButton>
          </div>
        }
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <AppTextField
            id="invite-name-input"
            label="Operator Full Name"
            placeholder="e.g. Grzegorz Brzęczyszczykiewicz"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            required
          />

          <AppTextField
            id="invite-email-input"
            label="Corporate Email Access"
            placeholder="e.g. g.brzeczy@privacy-pilot.io"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />

          <AppDropdown
            id="invite-role-input"
            label="Assigned system permission scope"
            items={[
              { value: 'Compliance Officer', label: 'Compliance Officer (Read + Write)' },
              { value: 'Admin', label: 'Admin (Full modifications access & Users management)' },
              { value: 'Auditor', label: 'Auditor (Audit inspections read-only access)' },
            ]}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
          />

          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-250/20 rounded-xl text-[11px] text-indigo-850 dark:text-indigo-400 leading-snug flex gap-2">
            <Lock className="h-4.5 w-4.5 text-indigo-550 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Security Guideline Notice:</strong> Every invited user is dispatched a cryptographically bounded onboarding invitation. Accounts are registered pending MFA bindings enrollment.
            </div>
          </div>
        </form>
      </AppModal>
    </div>
  );
};
