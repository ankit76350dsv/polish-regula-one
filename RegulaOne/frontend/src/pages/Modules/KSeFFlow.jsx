import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReceiptText, FileCode, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function KSeFFlow() {
  const [invoices, setInvoices] = useState([
    { id: 'INV-2024-001', client: 'PolTech Sp. z o.o.', amount: 1250.00, currency: 'PLN', status: 'accepted', date: '2024-05-12' },
    { id: 'INV-2024-002', client: 'Global Services LLC', amount: 3400.00, currency: 'USD', status: 'sent', date: '2024-05-13' },
    { id: 'INV-2024-003', client: 'Local Shop', amount: 450.25, currency: 'PLN', status: 'draft', date: '2024-05-14' },
  ]);

  const handleSendToKSeF = (id) => {
    toast.info(`Generating FA(3) XML for ${id}...`);
    setTimeout(() => {
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'sent' } : inv));
      toast.success(`Invoice ${id} sent to KSeF queue.`);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">KSeFFlow</h2>
          <p className="text-sm text-slate-500 font-medium">Native FA(3) XML Generation & Krajowy System e-Faktur Integration</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">
            Archive Access
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm">
            + Create Structured Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Gateway status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-emerald-600">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider">KSeF Production Linked</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Processing Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">0 <span className="text-[10px] text-slate-400 font-medium uppercase ml-2">pending sync</span></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Official UPO Hub</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">412 <span className="text-[10px] text-slate-400 font-medium uppercase ml-2">received</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Invoice Identifier</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Trading Entity</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Gross Value</TableHead>
                <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lifecycle State</TableHead>
                <TableHead className="text-right px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Interactions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-xs font-bold text-slate-700">{inv.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs font-medium text-slate-600">{inv.client}</TableCell>
                  <TableCell className="px-6 py-4 text-xs font-bold text-slate-900">
                    {inv.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} {inv.currency}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight ${
                      inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' :
                      inv.status === 'sent' ? 'bg-slate-100 text-slate-600' :
                      'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {inv.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right px-6 py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs font-bold ${inv.status === 'draft' ? 'text-red-600 hover:bg-red-50 hover:text-red-700' : 'text-slate-400 opacity-50 cursor-not-allowed'}`}
                      disabled={inv.status !== 'draft'}
                      onClick={() => handleSendToKSeF(inv.id)}
                    >
                      <FileCode className="mr-2 h-4 w-4" /> Ship to Ministry
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
