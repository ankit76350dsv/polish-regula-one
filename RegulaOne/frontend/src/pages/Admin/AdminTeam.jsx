import { useState } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, UserCheck, UserX, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

const MOCK_TENANT_USERS = [
  { id: 'u1', displayName: 'Anna Kowalska',        email: 'anna.kowalska@polcorp.pl',       role: 'ROLE_ADMIN', status: 'active',    joinedAt: '2024-01-16' },
  { id: 'u2', displayName: 'Jan Nowak',             email: 'jan.nowak@polcorp.pl',           role: 'ROLE_USER',  status: 'active',    joinedAt: '2024-01-20' },
  { id: 'u3', displayName: 'Zofia Kamińska',        email: 'z.kaminska@polcorp.pl',          role: 'ROLE_USER',  status: 'active',    joinedAt: '2024-02-10' },
  { id: 'u4', displayName: 'Piotr Malinowski',      email: 'p.malinowski@polcorp.pl',        role: 'ROLE_USER',  status: 'active',    joinedAt: '2024-03-05' },
  { id: 'u5', displayName: 'Ewa Szymańska',         email: 'e.szymanska@polcorp.pl',         role: 'ROLE_USER',  status: 'suspended', joinedAt: '2024-03-22' },
  { id: 'u6', displayName: 'Michał Wróbel',         email: 'm.wrobel@polcorp.pl',            role: 'ROLE_USER',  status: 'active',    joinedAt: '2024-04-08' },
];

const TIER_USER_LIMIT = 50;

const ROLE_STYLES = {
  ROLE_ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  ROLE_USER:  'bg-slate-100 text-slate-600 border-slate-200',
};

export default function AdminTeam() {
  const [users, setUsers]           = useState(MOCK_TENANT_USERS);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ROLE_USER');

  const active    = users.filter(u => u.status === 'active').length;
  const suspended = users.filter(u => u.status === 'suspended').length;
  const usagePct  = Math.round((users.length / TIER_USER_LIMIT) * 100);

  const toggleStatus = (id, current) => {
    const next = current === 'active' ? 'suspended' : 'active';
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: next } : u));
    toast.success(`User ${next === 'active' ? 'reactivated' : 'suspended'}`);
  };

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;

    const newUser = {
      id:          `u${Date.now()}`,
      displayName: inviteName,
      email:       inviteEmail,
      role:        inviteRole,
      status:      'active',
      joinedAt:    new Date().toISOString().split('T')[0],
    };

    setUsers(prev => [newUser, ...prev]);
    toast.success(`Invitation sent to ${inviteEmail}`);
    setShowInvite(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('ROLE_USER');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Team Management</h2>
          <p className="text-sm text-slate-500 font-medium">Manage users within your organisation — PolCorp Sp. z o.o.</p>
        </div>
        <Button
          className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm"
          onClick={() => setShowInvite(true)}
        >
          <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Members', value: users.length, icon: Users,     color: 'text-slate-300' },
          { label: 'Active',        value: active,        icon: UserCheck, color: 'text-emerald-300' },
          { label: 'Suspended',     value: suspended,     icon: UserX,     color: 'text-rose-300' },
          { label: 'Tier Limit',    value: TIER_USER_LIMIT, icon: Users,   color: 'text-red-300' },
        ].map((s, i) => (
          <Card key={i} className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Seat usage bar */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Seat Usage</span>
            <span className="text-xs font-bold text-slate-900">{users.length} / {TIER_USER_LIMIT} seats used</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${usagePct >= 80 ? 'bg-rose-500' : 'bg-red-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {TIER_USER_LIMIT - users.length} seats remaining on your <span className="text-red-600 font-bold">Pro</span> plan.
            {usagePct >= 80 && <span className="text-rose-600 font-bold ml-1">Consider upgrading.</span>}
          </p>
        </CardContent>
      </Card>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <Card className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-slate-200">
            <CardHeader className="border-b border-slate-100 py-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-900">Invite Team Member</CardTitle>
                <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                    onChange={e => setInviteName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Work Email</Label>
                  <Input
                    type="email"
                    placeholder="jan@polcorp.pl"
                    className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Role</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['ROLE_USER', 'ROLE_ADMIN'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
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
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setShowInvite(false)} className="flex-1 text-slate-400 font-bold">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold">
                    Send Invitation
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users table */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
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
              {users.map(u => (
                <TableRow key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">

                  {/* Avatar + name */}
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-xs font-bold text-red-600 flex-shrink-0">
                        {u.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-semibold text-sm text-slate-700">{u.displayName}</span>
                    </div>
                  </TableCell>

                  <TableCell className="px-6 py-4 text-xs text-slate-500 font-mono">{u.email}</TableCell>

                  <TableCell className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${ROLE_STYLES[u.role]}`}>
                      {u.role.replace('ROLE_', '')}
                    </span>
                  </TableCell>

                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className={`text-[10px] font-bold uppercase ${u.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {u.status}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="px-6 py-4 text-xs text-slate-400">{u.joinedAt}</TableCell>

                  <TableCell className="text-right px-6 py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs font-bold h-7 px-3 ${
                        u.status === 'active'
                          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      onClick={() => toggleStatus(u.id, u.status)}
                    >
                      {u.status === 'active'
                        ? <><UserX className="h-3.5 w-3.5 mr-1" />Suspend</>
                        : <><UserCheck className="h-3.5 w-3.5 mr-1" />Reactivate</>
                      }
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
