// Firestore removed - using in-memory mock tenant data
import { useState } from 'react';
import { Tenant } from '../../types';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ShieldCheck, ShieldX, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const MOCK_TENANTS: Tenant[] = [
  {
    id: 't1',
    name: 'PolCorp Sp. z o.o.',
    taxId: 'PL1234567890',
    status: 'active',
    subscriptionTier: 'Enterprise',
    enabledModules: ['ksef', 'workpulse', 'safework', 'safevoice', 'wastesync', 'privacypilot'],
    createdAt: '2024-01-15',
  },
  {
    id: 't2',
    name: 'Vistula Logistics',
    taxId: 'PL9876543210',
    status: 'active',
    subscriptionTier: 'Pro',
    enabledModules: ['ksef', 'wastesync', 'workpulse'],
    createdAt: '2024-02-20',
  },
  {
    id: 't3',
    name: 'Amber Tech Group',
    taxId: 'PL5566778899',
    status: 'suspended',
    subscriptionTier: 'Basic',
    enabledModules: ['ksef'],
    createdAt: '2024-03-10',
  },
  {
    id: 't4',
    name: 'Nordic Services PL',
    taxId: 'PL1122334455',
    status: 'active',
    subscriptionTier: 'Pro',
    enabledModules: ['privacypilot', 'safevoice', 'ksef'],
    createdAt: '2024-04-05',
  },
  {
    id: 't5',
    name: 'Mazovia Capital SA',
    taxId: 'PL6677889900',
    status: 'active',
    subscriptionTier: 'Enterprise',
    enabledModules: ['ksef', 'workpulse', 'safework', 'privacypilot'],
    createdAt: '2024-05-12',
  },
];

export default function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>(MOCK_TENANTS);

  const toggleStatus = (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, status: newStatus as Tenant['status'] } : t));
    toast.success(`Tenant ${newStatus === 'active' ? 'activated' : 'suspended'}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Tenants</h2>
          <p className="text-sm text-slate-500 font-medium">Manage and monitor enterprise organizations on the network.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">
            Export Registry
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm">
            + Provision New
          </Button>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Organization Name</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tax Registration</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">License Tier</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Access Status</TableHead>
                <TableHead className="text-right px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Management</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-red-500" />
                      </div>
                      <span className="font-bold text-sm text-slate-700">{tenant.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold font-mono tracking-tighter uppercase">{tenant.taxId}</span>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant="outline" className="border-slate-200 text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-white">
                      {tenant.subscriptionTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-rose-500'}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${tenant.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tenant.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 transition-colors ${tenant.status === 'active' ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        onClick={() => toggleStatus(tenant.id, tenant.status)}
                        title={tenant.status === 'active' ? 'Revoke Access' : 'Restore Access'}
                      >
                        {tenant.status === 'active' ? <ShieldX className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
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
