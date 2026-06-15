import { useState }        from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver }     from '@hookform/resolvers/zod';
import { z }               from 'zod';
import {
  ReceiptText, FileCode, Download, Plus, Trash2, Loader2,
  CheckCircle2, Clock, AlertCircle, FileX, RefreshCw, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  useKSeFStats, useKSeFInvoices, useCreateInvoice, useSubmitToKSeF, useDownloadXml
} from '../../hooks/useKSeF';

// ── Zod schema ────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  description:  z.string().min(1, 'Required').max(256),
  quantity:     z.coerce.number({ invalid_type_error: 'Required' }).positive('Must be > 0'),
  unit:         z.string().min(1, 'Required').max(20),
  unitPriceNet: z.coerce.number({ invalid_type_error: 'Required' }).nonnegative('Must be ≥ 0'),
  vatRate:      z.enum(['23', '8', '5', '0', 'ZW', 'NP'], { required_error: 'Required' }),
});

const invoiceSchema = z.object({
  buyerName:       z.string().min(1, 'Buyer name is required').max(256),
  buyerNip:        z.string()
                     .refine(v => !v || /^[0-9]{10}$/.test(v), 'NIP must be 10 digits')
                     .optional(),
  buyerEmail:      z.string()
                     .refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email')
                     .optional(),
  buyerAddress:    z.string().max(512).optional(),
  issueDate:       z.string().min(1, 'Issue date is required'),
  dueDate:         z.string().optional(),
  currency:        z.string().default('PLN'),
  referenceNumber: z.string().max(64).optional(),
  items:           z.array(itemSchema).min(1, 'At least one item required'),
});

// ── Shared select class ───────────────────────────────────────────────────────

const SELECT_CLS =
  'h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 ' +
  'focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 cursor-pointer';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT:    { label: 'Draft',    cls: 'bg-amber-50 text-amber-600 border border-amber-200',        icon: FileText },
  QUEUED:   { label: 'Queued',   cls: 'bg-blue-50 text-blue-600 border border-blue-200',           icon: Clock },
  SENT:     { label: 'Sent',     cls: 'bg-slate-100 text-slate-600 border border-slate-200',       icon: RefreshCw },
  ACCEPTED: { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',  icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-600 border border-red-200',             icon: AlertCircle },
};

function StatusBadge({ status }) {
  const cfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight ${cfg.cls}`}>
      <Icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KSeFFlow() {
  const [showCreate, setShowCreate] = useState(false);

  const { data: stats,    isLoading: statsLoading    } = useKSeFStats();
  const { data: invoices, isLoading: invoicesLoading } = useKSeFInvoices();
  const submit      = useSubmitToKSeF();
  const downloadXml = useDownloadXml();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">KSeFFlow</h2>
          <p className="text-sm text-slate-500 font-medium">
            Native FA(3) XML Generation & Krajowy System e-Faktur Integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2">
            Archive Access
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />Create Structured Invoice
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Gateway Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /> : (
              <div className="flex items-center gap-2 text-emerald-600">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  KSeF {stats?.gatewayStatus ?? 'ONLINE'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Processing Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" /> : (
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {(stats?.queued ?? 0) + (stats?.sent ?? 0)}
                <span className="text-[10px] text-slate-400 font-medium uppercase ml-2">pending sync</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Official UPO Hub</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" /> : (
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {stats?.upoCount ?? 0}
                <span className="text-[10px] text-slate-400 font-medium uppercase ml-2">received</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice table */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {invoicesLoading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />)}
            </div>
          ) : !invoices?.length ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
              <FileX className="w-10 h-10" />
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500">No invoices yet</p>
                <p className="text-xs mt-1">Create your first FA(3) structured invoice above.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Invoice</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Buyer</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Gross Value</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">KSeF ID</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">State</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Issue Date</TableHead>
                  <TableHead className="text-right px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <ReceiptText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="font-mono text-xs font-bold text-slate-700">{inv.invoiceNumber}</p>
                          {inv.referenceNumber && <p className="text-[10px] text-slate-400">{inv.referenceNumber}</p>}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-6 py-4">
                      <p className="text-xs font-medium text-slate-700">{inv.buyerName}</p>
                      {inv.buyerNip && <p className="text-[10px] text-slate-400 font-mono">NIP {inv.buyerNip}</p>}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-xs font-bold text-slate-900">
                      {parseFloat(inv.totalGross).toLocaleString('pl-PL', { minimumFractionDigits: 2 })}{' '}
                      <span className="font-normal text-slate-400">{inv.currency}</span>
                    </TableCell>

                    <TableCell className="px-6 py-4">
                      {inv.ksefId
                        ? <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{inv.ksefId}</span>
                        : <span className="text-[10px] text-slate-300">—</span>}
                    </TableCell>

                    <TableCell className="px-6 py-4"><StatusBadge status={inv.status} /></TableCell>

                    <TableCell className="px-6 py-4 text-xs text-slate-500">{inv.issueDate ?? '—'}</TableCell>

                    <TableCell className="text-right px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {inv.canSubmit && (
                          <Button
                            variant="ghost" size="sm"
                            className="text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={submit.isPending}
                            onClick={() => submit.mutate(inv.id)}
                          >
                            {submit.isPending && submit.variables === inv.id
                              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              : <FileCode className="mr-1.5 h-3.5 w-3.5" />}
                            Ship to Ministry
                          </Button>
                        )}
                        {inv.hasXml && (
                          <Button
                            variant="ghost" size="sm"
                            className="text-xs font-bold text-slate-500 hover:bg-slate-100"
                            disabled={downloadXml.isPending}
                            onClick={() => downloadXml.mutate(inv.id)}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />XML
                          </Button>
                        )}
                        {!inv.canSubmit && !inv.hasXml && (
                          <span className="text-[10px] text-slate-300 pr-2">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

// ── Create Invoice Modal ──────────────────────────────────────────────────────

function CreateInvoiceModal({ open, onClose }) {
  const createInvoice = useCreateInvoice(onClose);

  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      currency: 'PLN',
      items: [{ description: '', quantity: 1, unit: 'szt.', unitPriceNet: 0, vatRate: '23' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = watch('items');

  // Live totals
  const totals = (watchedItems ?? []).reduce((acc, item) => {
    const qty   = parseFloat(item.quantity)     || 0;
    const price = parseFloat(item.unitPriceNet) || 0;
    const net   = qty * price;
    const rate  = ['ZW', 'NP'].includes(item.vatRate) ? 0 : (parseFloat(item.vatRate) || 0);
    const vat   = net * rate / 100;
    return { net: acc.net + net, vat: acc.vat + vat, gross: acc.gross + net + vat };
  }, { net: 0, vat: 0, gross: 0 });

  const onSubmit = handleSubmit((data) => {
    createInvoice.mutate({
      ...data,
      buyerNip:   data.buyerNip   || undefined,
      buyerEmail: data.buyerEmail || undefined,
    });
  });

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Create Structured FA(3) Invoice
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Fill in buyer details and line items. FA(3) XML is generated automatically on submission to KSeF.
          </p>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6 mt-2">

          {/* Buyer */}
          <section className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Buyer Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Company Name *</Label>
                <Input {...register('buyerName')} placeholder="PolTech Sp. z o.o." className="h-9 text-sm" />
                {errors.buyerName && <p className="text-[10px] text-red-500">{errors.buyerName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">NIP (10 digits)</Label>
                <Input {...register('buyerNip')} placeholder="1234567890" maxLength={10} className="h-9 text-sm font-mono" />
                {errors.buyerNip && <p className="text-[10px] text-red-500">{errors.buyerNip.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Email</Label>
                <Input {...register('buyerEmail')} type="email" placeholder="finance@company.pl" className="h-9 text-sm" />
                {errors.buyerEmail && <p className="text-[10px] text-red-500">{errors.buyerEmail.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Address</Label>
                <Input {...register('buyerAddress')} placeholder="ul. Główna 1, 00-001 Warsaw" className="h-9 text-sm" />
              </div>
            </div>
          </section>

          {/* Dates & currency */}
          <section className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dates & Reference</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Issue Date *</Label>
                <Input {...register('issueDate')} type="date" className="h-9 text-sm" />
                {errors.issueDate && <p className="text-[10px] text-red-500">{errors.issueDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Due Date</Label>
                <Input {...register('dueDate')} type="date" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Currency</Label>
                <select {...register('currency')} className={SELECT_CLS + ' h-9'}>
                  <option value="PLN">PLN</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Internal Reference</Label>
                <Input {...register('referenceNumber')} placeholder="PO-2024-001" className="h-9 text-sm" />
              </div>
            </div>
          </section>

          {/* Line items */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Line Items</p>
              <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                onClick={() => append({ description: '', quantity: 1, unit: 'szt.', unitPriceNet: 0, vatRate: '23' })}>
                <Plus className="mr-1 h-3 w-3" />Add Item
              </Button>
            </div>

            <div className="rounded-lg border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-slate-50 text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                <span>Description</span><span>Qty</span><span>Unit</span>
                <span>Net Price</span><span>VAT Rate</span><span />
              </div>

              {fields.map((field, index) => (
                <div key={field.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-3 py-2 border-t border-slate-50 items-start">
                  <div>
                    <Input {...register(`items.${index}.description`)} placeholder="Service description" className="h-8 text-xs" />
                    {errors.items?.[index]?.description && (
                      <p className="text-[9px] text-red-400 mt-0.5">{errors.items[index].description.message}</p>
                    )}
                  </div>
                  <div>
                    <Input {...register(`items.${index}.quantity`)} type="number" step="0.001" min="0.001" className="h-8 text-xs" />
                    {errors.items?.[index]?.quantity && (
                      <p className="text-[9px] text-red-400 mt-0.5">{errors.items[index].quantity.message}</p>
                    )}
                  </div>
                  <div>
                    <Input {...register(`items.${index}.unit`)} placeholder="szt." className="h-8 text-xs" />
                  </div>
                  <div>
                    <Input {...register(`items.${index}.unitPriceNet`)} type="number" step="0.01" min="0" className="h-8 text-xs" />
                    {errors.items?.[index]?.unitPriceNet && (
                      <p className="text-[9px] text-red-400 mt-0.5">{errors.items[index].unitPriceNet.message}</p>
                    )}
                  </div>
                  <div>
                    <select {...register(`items.${index}.vatRate`)} className={SELECT_CLS}>
                      <option value="23">23%</option>
                      <option value="8">8%</option>
                      <option value="5">5%</option>
                      <option value="0">0%</option>
                      <option value="ZW">ZW (exempt)</option>
                      <option value="NP">NP (N/A)</option>
                    </select>
                  </div>
                  <Button type="button" variant="ghost" size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    disabled={fields.length === 1} onClick={() => remove(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Live totals */}
          <div className="bg-slate-50 rounded-lg p-4 flex justify-end">
            <div className="space-y-1 text-right text-xs">
              <div className="flex gap-8 text-slate-500">
                <span>Net Total</span>
                <span className="font-mono font-semibold text-slate-700 w-28 text-right">
                  {totals.net.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex gap-8 text-slate-500">
                <span>VAT</span>
                <span className="font-mono font-semibold text-slate-700 w-28 text-right">
                  {totals.vat.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex gap-8 border-t border-slate-200 pt-1 text-slate-900 font-bold">
                <span>Gross Total</span>
                <span className="font-mono w-28 text-right">
                  {totals.gross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="text-xs">Cancel</Button>
            <Button type="submit" disabled={createInvoice.isPending}
              className="bg-red-600 text-white hover:bg-red-700 text-xs font-bold">
              {createInvoice.isPending
                ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</>
                : 'Save as Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
