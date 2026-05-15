import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, Pencil, Package, TrendingUp, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface Tier {
  id: string;
  name: 'Basic' | 'Pro' | 'Enterprise';
  price: number;       // EUR / month per tenant
  tenantCount: number;
  modules: string[];
  limits: { users: number | 'Unlimited'; storage: string; apiCalls: string };
  color: string;       // accent colour class
  highlight: boolean;  // featured / recommended
}

const TIERS: Tier[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 149,
    tenantCount: 38,
    modules: ['KSeFFlow', 'WorkPulse'],
    limits: { users: 10, storage: '5 GB', apiCalls: '10k / mo' },
    color: 'border-slate-200',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 399,
    tenantCount: 71,
    modules: ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync'],
    limits: { users: 50, storage: '25 GB', apiCalls: '100k / mo' },
    color: 'border-red-400',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 999,
    tenantCount: 33,
    modules: ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync', 'PrivacyPilot'],
    limits: { users: 'Unlimited', storage: '500 GB', apiCalls: 'Unlimited' },
    color: 'border-slate-900',
    highlight: false,
  },
];

const ALL_MODULES = ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync', 'PrivacyPilot'];

// Recent tier change log (mock)
const CHANGE_LOG = [
  { tenant: 'Mazovia Capital SA',  from: 'Pro',      to: 'Enterprise', date: '2026-05-10', reason: 'Volume growth' },
  { tenant: 'Nordic Services PL',  from: 'Basic',    to: 'Pro',        date: '2026-04-22', reason: 'Added SafeVoice' },
  { tenant: 'Amber Tech Group',    from: 'Pro',      to: 'Basic',      date: '2026-04-01', reason: 'Tenant suspended' },
  { tenant: 'Vistula Logistics',   from: 'Basic',    to: 'Pro',        date: '2026-03-14', reason: 'Module expansion' },
];

export default function PackageTiers() {
  const [tiers] = useState<Tier[]>(TIERS);

  const totalMRR = tiers.reduce((sum, t) => sum + t.price * t.tenantCount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">License Tiers</h2>
          <p className="text-sm text-slate-500 font-medium">Manage platform subscription packages and module entitlements.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">
            Export Billing Report
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm">
            <Package className="h-3.5 w-3.5 mr-1.5" /> New Tier
          </Button>
        </div>
      </div>

      {/* MRR summary strip */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Total MRR',        value: `€${totalMRR.toLocaleString()}`, icon: TrendingUp, sub: 'across all tiers' },
          { label: 'Paying Tenants',   value: tiers.reduce((s, t) => s + t.tenantCount, 0).toString(), icon: Building2, sub: 'active subscriptions' },
          { label: 'Most Popular',     value: 'Pro',  icon: Package, sub: `${tiers[1].tenantCount} tenants` },
        ].map((s, i) => (
          <Card key={i} className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={`bg-white shadow-sm rounded-2xl border-2 relative overflow-hidden transition-shadow hover:shadow-md ${tier.color}`}
          >
            {tier.highlight && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
            )}
            <CardHeader className="pt-6 pb-2">
              <div className="flex items-start justify-between">
                <div>
                  {tier.highlight && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full mb-2 inline-block">
                      Most Popular
                    </span>
                  )}
                  <CardTitle className="text-xl font-black text-slate-900">{tier.name}</CardTitle>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{tier.tenantCount} active tenants</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => toast.info(`Edit ${tier.name} tier — coming soon`)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Price */}
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">€{tier.price}</span>
                <span className="text-sm text-slate-400 font-medium">/ mo</span>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Users',     value: tier.limits.users.toString() },
                  { label: 'Storage',   value: tier.limits.storage },
                  { label: 'API Calls', value: tier.limits.apiCalls },
                ].map((l) => (
                  <div key={l.label} className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{l.label}</p>
                    <p className="text-xs font-black text-slate-700 mt-0.5">{l.value}</p>
                  </div>
                ))}
              </div>

              {/* Module access */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Modules</p>
                {ALL_MODULES.map((mod) => {
                  const included = tier.modules.includes(mod);
                  return (
                    <div key={mod} className={`flex items-center gap-2 text-xs font-medium ${included ? 'text-slate-700' : 'text-slate-300'}`}>
                      <Check className={`h-3.5 w-3.5 flex-shrink-0 ${included ? 'text-emerald-500' : 'text-slate-200'}`} />
                      {mod}
                    </div>
                  );
                })}
              </div>

              {/* MRR from this tier */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tier MRR</span>
                <span className="text-sm font-black text-slate-900">€{(tier.price * tier.tenantCount).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent tier change log */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-800">Recent Tier Changes</h2>
            <span className="text-[10px] text-red-600 font-bold cursor-pointer uppercase tracking-wider hover:underline">Full History</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tenant</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">From</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">To</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reason</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 text-right tracking-wider">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CHANGE_LOG.map((log, i) => (
                <TableRow key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6 py-4 text-xs font-semibold text-slate-700">{log.tenant}</TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest text-slate-500 border-slate-200 bg-white">
                      {log.from}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest text-red-600 border-red-200 bg-red-50">
                      {log.to}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs text-slate-500">{log.reason}</TableCell>
                  <TableCell className="px-6 py-4 text-xs text-slate-400 text-right font-medium">{log.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
