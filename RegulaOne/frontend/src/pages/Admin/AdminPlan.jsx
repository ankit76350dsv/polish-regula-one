// removed unused useState import
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Check, RefreshCw, ArrowUpCircle, CreditCard, Calendar, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';

const ALL_MODULES = ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync', 'PrivacyPilot'];

const TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 149,
    users: '10',
    modules: ['KSeFFlow', 'WorkPulse'],
    current: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 399,
    users: '50',
    modules: ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync', 'PrivacyPilot'],
    current: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 999,
    users: 'Unlimited',
    modules: ['KSeFFlow', 'WorkPulse', 'SafeWork', 'SafeVoice', 'WasteSync', 'PrivacyPilot'],
    current: false,
  },
];

const BILLING_HISTORY = [
  { invoice: 'INV-2026-0005', period: 'May 2026', amount: '€399.00', status: 'PAID', date: '2026-05-01' },
  { invoice: 'INV-2026-0004', period: 'Apr 2026', amount: '€399.00', status: 'PAID', date: '2026-04-01' },
  { invoice: 'INV-2026-0003', period: 'Mar 2026', amount: '€399.00', status: 'PAID', date: '2026-03-01' },
  { invoice: 'INV-2026-0002', period: 'Feb 2026', amount: '€399.00', status: 'PAID', date: '2026-02-01' },
  { invoice: 'INV-2026-0001', period: 'Jan 2026', amount: '€149.00', status: 'PAID', date: '2026-01-01' },
];

export default function AdminPlan() {
  const currentTier = TIERS.find(t => t.current);

  const handleRenew = () =>
    toast.success('Plan renewed for another month. Invoice sent to billing email.');

  const handleUpgrade = (tierName) =>
    toast.success(`Upgrade request to ${tierName} submitted. Our team will contact you.`);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Plan</h2>
          <p className="text-sm text-slate-500 font-medium">
            Current subscription and available upgrade options.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            Renews in 17 days — 2026-06-01
          </div>
          <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">
            <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Billing Settings
          </Button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-3 items-start">
        {TIERS.map((tier) => {
          const isCurrent = tier.current;
          const isUpgrade = tier.price > currentTier.price;

          return (
            <Card
              key={tier.id}
              className={`relative rounded-2xl overflow-hidden transition-all ${
                isCurrent
                  ? 'border-2 border-red-500 shadow-lg shadow-red-100'
                  : 'border border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Top accent bar */}
              {isCurrent && <div className="h-1 bg-red-500 w-full" />}

              <CardContent className="p-6 space-y-6">

                {/* Plan name + badge */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900">{tier.name}</h3>
                  {isCurrent && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                      Current
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-black text-slate-900 leading-none">€{tier.price}</span>
                  <span className="text-sm text-slate-400 font-medium mb-1">/ mo</span>
                </div>

                {/* Users limit */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    Users
                  </div>
                  <span className="text-sm font-black text-slate-900">{tier.users}</span>
                </div>

                {/* Modules */}
                <div className="space-y-2.5">
                  {ALL_MODULES.map((mod) => {
                    const included = tier.modules.includes(mod);
                    return (
                      <div
                        key={mod}
                        className={`flex items-center gap-2.5 text-sm font-medium ${
                          included ? 'text-slate-700' : 'text-slate-300'
                        }`}
                      >
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                          included ? 'bg-emerald-100' : 'bg-slate-100'
                        }`}>
                          <Check className={`h-2.5 w-2.5 ${included ? 'text-emerald-600' : 'text-slate-300'}`} />
                        </div>
                        {mod}
                      </div>
                    );
                  })}
                </div>

                {/* Action button */}
                <div className="pt-2">
                  {isCurrent ? (
                    <Button
                      className="w-full bg-red-600 text-white hover:bg-red-700 text-xs font-bold rounded-xl py-2.5"
                      onClick={handleRenew}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Renew Plan
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl py-2.5"
                      onClick={() => handleUpgrade(tier.name)}
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" /> Upgrade to {tier.name}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-slate-200 text-slate-300 text-xs font-bold rounded-xl py-2.5 cursor-not-allowed"
                      disabled
                    >
                      Downgrade
                    </Button>
                  )}
                </div>

              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Billing history */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <h2 className="font-bold text-sm text-slate-800">Billing History</h2>
          </div>
          <span className="text-[10px] text-red-600 font-bold cursor-pointer uppercase tracking-wider hover:underline">
            Download All
          </span>
        </div>
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
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                    {row.status}
                  </span>
                </TableCell>
                <TableCell className="px-6 py-4 text-xs text-slate-400 text-right">{row.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

    </div>
  );
}
