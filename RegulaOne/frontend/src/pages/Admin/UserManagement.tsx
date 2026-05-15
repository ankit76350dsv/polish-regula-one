import { useState } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '../../types';

interface PlatformUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  tenant: string;
  status: 'active' | 'suspended';
  joinedAt: string;
}

const MOCK_USERS: PlatformUser[] = [
  { id: 'u1', displayName: 'Anna Kowalska',     email: 'anna.kowalska@polcorp.pl',       role: 'ROLE_ADMIN',       tenant: 'PolCorp Sp. z o.o.',  status: 'active',    joinedAt: '2024-01-16' },
  { id: 'u2', displayName: 'Jan Nowak',          email: 'jan.nowak@polcorp.pl',           role: 'ROLE_USER',        tenant: 'PolCorp Sp. z o.o.',  status: 'active',    joinedAt: '2024-01-20' },
  { id: 'u3', displayName: 'Piotr Wiśniewski',   email: 'p.wisniewski@vistula.pl',        role: 'ROLE_ADMIN',       tenant: 'Vistula Logistics',   status: 'active',    joinedAt: '2024-02-22' },
  { id: 'u4', displayName: 'Maria Zielińska',    email: 'm.zielinska@vistula.pl',         role: 'ROLE_USER',        tenant: 'Vistula Logistics',   status: 'suspended', joinedAt: '2024-03-05' },
  { id: 'u5', displayName: 'Tomasz Wójcik',      email: 't.wojcik@ambertech.pl',          role: 'ROLE_ADMIN',       tenant: 'Amber Tech Group',    status: 'suspended', joinedAt: '2024-03-12' },
  { id: 'u6', displayName: 'Katarzyna Lewandowska', email: 'k.lewandowska@nordic.pl',    role: 'ROLE_USER',        tenant: 'Nordic Services PL',  status: 'active',    joinedAt: '2024-04-08' },
  { id: 'u7', displayName: 'Michał Dąbrowski',   email: 'm.dabrowski@nordic.pl',         role: 'ROLE_ADMIN',       tenant: 'Nordic Services PL',  status: 'active',    joinedAt: '2024-04-10' },
  { id: 'u8', displayName: 'Agnieszka Kamińska', email: 'a.kaminska@mazovia.pl',          role: 'ROLE_USER',        tenant: 'Mazovia Capital SA',  status: 'active',    joinedAt: '2024-05-14' },
];

const ROLE_STYLES: Record<UserRole, string> = {
  ROLE_SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200',
  ROLE_ADMIN:       'bg-blue-100 text-blue-700 border-blue-200',
  ROLE_USER:        'bg-slate-100 text-slate-600 border-slate-200',
};

export default function UserManagement() {
  const [users, setUsers] = useState<PlatformUser[]>(MOCK_USERS);

  const toggleStatus = (id: string, current: string) => {
    const next = current === 'active' ? 'suspended' : 'active';
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: next as PlatformUser['status'] } : u));
    toast.success(`User ${next === 'active' ? 'reactivated' : 'suspended'}`);
  };

  const active    = users.filter(u => u.status === 'active').length;
  const suspended = users.filter(u => u.status === 'suspended').length;
  const admins    = users.filter(u => u.role === 'ROLE_ADMIN').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Users</h2>
          <p className="text-sm text-slate-500 font-medium">Manage all user accounts across every tenant node.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">
            Export CSV
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm">
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite User
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Users',  value: users.length, icon: Users,      color: 'text-slate-300' },
          { label: 'Active',       value: active,        icon: UserCheck,  color: 'text-emerald-300' },
          { label: 'Suspended',    value: suspended,     icon: UserX,      color: 'text-rose-300' },
          { label: 'Admins',       value: admins,        icon: ShieldCheck, color: 'text-red-300' },
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

      {/* Users table */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Name</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Role</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tenant</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Joined</TableHead>
                <TableHead className="text-right px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">

                  {/* Name + avatar */}
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-xs font-bold text-red-600">
                        {u.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-semibold text-sm text-slate-700">{u.displayName}</span>
                    </div>
                  </TableCell>

                  <TableCell className="px-6 py-4 text-xs text-slate-500 font-mono">{u.email}</TableCell>

                  {/* Role badge */}
                  <TableCell className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${ROLE_STYLES[u.role]}`}>
                      {u.role.replace('ROLE_', '').replace(/_/g, ' ')}
                    </span>
                  </TableCell>

                  <TableCell className="px-6 py-4 text-xs text-slate-500">{u.tenant}</TableCell>

                  {/* Status */}
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className={`text-[10px] font-bold uppercase ${u.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {u.status}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="px-6 py-4 text-xs text-slate-400">{u.joinedAt}</TableCell>

                  {/* Toggle action */}
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
                      {u.status === 'active' ? (
                        <><UserX className="h-3.5 w-3.5 mr-1" /> Suspend</>
                      ) : (
                        <><UserCheck className="h-3.5 w-3.5 mr-1" /> Reactivate</>
                      )}
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
