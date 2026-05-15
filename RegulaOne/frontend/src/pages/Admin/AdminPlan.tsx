import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Check, Package, RefreshCw, ArrowUpCircle, CreditCard, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const ALL_MODULES = ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync', 'PrivacyPilot'];

const TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 149,
    users: '10',
    storage: '5 GB',
    apiCalls: '10k / mo',
    modules: ['KSeFFlow', 'WorkPulse'],
    current: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 399,
    users: '50',
    storage: '25 GB',
    apiCalls: '100k / mo',
    modules: ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync'],
    current: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 999,
    users: 'Unlimited',
    storage: '500 GB',
    apiCalls: 'Unlimited',
    modules: ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync', 'PrivacyPilot'],
    current: false,
  },
];

const BILLING_HISTORY = [
  { invoice: 'INV-2026-0005', period: 'May 2026',  amount: '€399.00', status: 'PAID',    date: '2026-05-01' },
  { invoice: 'INV-2026-0004', period: 'Apr 2026',  amount: '€399.00', status: 'PAID',    date: '2026-04-01' },
  { invoice: 'INV-2026-0003', period: 'Mar 2026',  amount: '€399.00', status: 'PAID',    date: '2026-03-01' },
  { invoice: 'INV-2026-0002', period: 'Feb 2026',  amount: '€399.00', status: 'PAID',    date: '2026-02-01' },
  { invoice: 'INV-2026-0001', period: 'Jan 2026',  amount: '€149.00', status: 'PAID',    date: '2026-01-01' },
];

export default function AdminPlan() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const currentTier = TIERS.find(t => t.current)!;

  const handleRenew = () => {
    toast.success('Plan renewed for another month. Invoice sent to billing email.');
  };

  const handleUpgrade = (tierName: string) => {
    toast.success(`Upgrade request to ${tierName} submitted. Our team will contact you.`);
    setSelectedTier(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Plan</h2>
          <p className="text-sm text-slate-500 font-medium">Current subscription and available upgrade options for your organisation.</p>
        </div>
        <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">
          <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Billing Settings
        </Button>
      </div>

      {/* Current plan banner */}
      <Card className="bg-white border-2 border-red-500 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-red-500 w-full" />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">

            {/* Plan info */}
            <div className="flex items-center gap-4 flex-1">
              <div className="h-14 w-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <Package className="h-7 w-7 text-red-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-900">{currentTier.name} Plan</h3>
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <p className="text-sm text-slate-500 font-medium mt-0.5">
                  <span className="text-2xl font-black text-slate-900">€{currentTier.price}</span>
                  <span className="text-sm text-slate-400"> / month</span>
                </p>
              </div>
            </div>

            {/* Renewal info */}
            <div className="flex flex-col items-start md:items-end gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Calendar className="h-4 w-4 text-slate-400" />
                Renews on <span className="font-bold text-slate-700">2026-06-01</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5" />
                Renews in 17 days
              </div>
              <Button
                className="bg-red-600 text-white hover:bg-red-700 text-xs font-bold px-5 py-2 shadow-sm"
                onClick={handleRenew}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Renew Plan
              </Button>
            </div>
          </div>

          {/* Current plan feature summary */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-4">
            {[
              { label: 'Users',     value: currentTier.users },
              { label: 'Storage',   value: currentTier.storage },
              { label: 'API Calls', value: currentTier.apiCalls },
            ].map(l => (
              <div key={l.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{l.label}</p>
                <p className="text-sm font-black text-slate-800 mt-0.5">{l.value}</p>
              </div>
            ))}
          </div>

          {/* Modules included */}
          <div className="mt-5 flex flex-wrap gap-2">
            {ALL_MODULES.map(mod => {
              const included = currentTier.modules.includes(mod);
              return (
                <span
                  key={mod}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    included
                      ? 'bg-red-50 border-red-100 text-red-700'
                      : 'bg-slate-50 border-slate-100 text-slate-300'
                  }`}
                >
                  <Check className={`h-3 w-3 ${included ? 'text-emerald-500' : 'text-slate-200'}`} />
                  {mod}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Available tiers */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4">Available Plans</h3>
        <div className="grid gap-5 md:grid-cols-3">
          {TIERS.map(tier => (
            <Card
              key={tier.id}
              className={`bg-white rounded-2xl border-2 transition-all ${
                tier.current
                  ? 'border-red-500 opacity-60'
                  : selectedTier === tier.id
                    ? 'border-red-400 shadow-lg shadow-red-100'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <CardHeader className="pb-2 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-black text-slate-900">{tier.name}</CardTitle>
                  {tier.current && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-slate-900">€{tier.price}</span>
                  <span className="text-xs text-slate-400">/ mo</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Limits */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Users',   value: tier.users },
                    { label: 'Storage', value: tier.storage },
                    { label: 'API',     value: tier.apiCalls },
                  ].map(l => (
                    <div key={l.label} className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{l.label}</p>
                      <p className="text-[10px] font-black text-slate-700 mt-0.5 leading-tight">{l.value}</p>
                    </div>
                  ))}
                </div>

                {/* Modules */}
                <div className="space-y-1">
                  {ALL_MODULES.map(mod => {
                    const included = tier.modules.includes(mod);
                    return (
                      <div key={mod} className={`flex items-center gap-2 text-xs ${included ? 'text-slate-600' : 'text-slate-300'}`}>
                        <Check className={`h-3 w-3 flex-shrink-0 ${included ? 'text-emerald-500' : 'text-slate-200'}`} />
                        {mod}
                      </div>
                    );
                  })}
                </div>

                {/* Action */}
                {tier.current ? (
                  <Button
                    className="w-full bg-red-600 text-white hover:bg-red-700 text-xs font-bold"
                    onClick={handleRenew}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Renew
                  </Button>
                ) : tier.price > currentTier.price ? (
                  <Button
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold"
                    onClick={() => handleUpgrade(tier.name)}
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" /> Upgrade to {tier.name}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed"
                    disabled
                  >
                    Downgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Billing history */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-800">Billing History</h2>
            <span className="text-[10px] text-red-600 font-bold cursor-pointer uppercase tracking-wider hover:underline">Download All</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Invoice</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Period</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Amount</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</TableHead>
                <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 text-right tracking-wider">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BILLING_HISTORY.map((row, i) => (
                <TableRow key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6 py-4 text-xs font-mono font-bold text-slate-700">{row.invoice}</TableCell>
                  <TableCell className="px-6 py-4 text-xs text-slate-500">{row.period}</TableCell>
                  <TableCell className="px-6 py-4 text-xs font-bold text-slate-900">{row.amount}</TableCell>
                  <TableCell className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600">
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs text-slate-400 text-right">{row.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
