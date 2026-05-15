import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Building2, Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle,
} from 'lucide-react';
import { useTenants, useCreateTenant, useUpdateTenant, useDeleteTenant, useChangeTenantStatus } from '../../hooks/useTenant';

// ── Zod schema matches TenantRequest validation rules ─────────────────────────
const tenantSchema = z.object({
  name:       z.string().min(2, 'Min 2 characters').max(200, 'Max 200 characters'),
  nip:        z.string().regex(/^\d{10}$/, 'NIP must be exactly 10 digits'),
  regon:      z.string().regex(/^\d{9}$|^\d{14}$/, 'REGON must be 9 or 14 digits').optional().or(z.literal('')),
  email:      z.email('Invalid email address'),
  phone:      z.string().regex(/^[+]?[0-9\s\-()\s]{7,20}$/, 'Invalid phone number').optional().or(z.literal('')),
  address:    z.string().optional(),
  city:       z.string().max(100, 'Max 100 characters').optional(),
  postalCode: z.string().regex(/^\d{2}-\d{3}$/, 'Format: XX-XXX (e.g. 00-001)').optional().or(z.literal('')),
  status:     z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

// ── Status display helpers ─────────────────────────────────────────────────────
const STATUS_STYLES = {
  ACTIVE:    { dot: 'bg-emerald-500', text: 'text-emerald-600', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  INACTIVE:  { dot: 'bg-slate-400',   text: 'text-slate-500',   badge: 'border-slate-200 bg-slate-50 text-slate-600' },
  SUSPENDED: { dot: 'bg-rose-500',    text: 'text-rose-600',    badge: 'border-rose-200 bg-rose-50 text-rose-700' },
};

// ── Tenant form (shared by create + edit) ─────────────────────────────────────
function TenantForm({ defaultValues, onSubmit, isPending, submitLabel }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      status: 'ACTIVE',
      ...defaultValues,
    },
  });

  const field = (label, name, opts = {}) => (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}{opts.required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      <Input
        {...register(name)}
        placeholder={opts.placeholder ?? ''}
        className="h-9 text-sm border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
      />
      {errors[name] && <p className="text-[10px] text-rose-600 font-semibold">{errors[name].message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">{field('Company Name', 'name', { required: true, placeholder: 'Acme Sp. z o.o.' })}</div>
        {field('NIP', 'nip', { required: true, placeholder: '1234567890' })}
        {field('REGON', 'regon', { placeholder: '123456789' })}
        {field('Email', 'email', { required: true, placeholder: 'contact@company.pl' })}
        {field('Phone', 'phone', { placeholder: '+48 123 456 789' })}
        <div className="col-span-2">{field('Address', 'address', { placeholder: 'ul. Przykładowa 1' })}</div>
        {field('City', 'city', { placeholder: 'Warsaw' })}
        {field('Postal Code', 'postalCode', { placeholder: '00-001' })}

        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Status<span className="text-rose-500 ml-0.5">*</span>
          </Label>
          <select
            {...register('status')}
            className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          {errors.status && <p className="text-[10px] text-rose-600 font-semibold">{errors.status.message}</p>}
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-red-600 hover:bg-red-700 text-white font-bold"
        >
          {isPending ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TenantManagement() {
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebounced]   = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [page, setPage]                   = useState(0);
  const [createOpen, setCreateOpen]       = useState(false);
  const [editTarget, setEditTarget]       = useState(null); // TenantResponse | null
  const [deleteTarget, setDeleteTarget]   = useState(null); // TenantResponse | null

  // Debounce search — reset page on new query
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [statusFilter]);

  const params = { search: debouncedSearch, status: statusFilter, page, size: 10 };
  const { data, isLoading, isError, error } = useTenants(params);

  const createTenant     = useCreateTenant({ onSuccess: () => setCreateOpen(false) });
  const updateTenant     = useUpdateTenant({ onSuccess: () => setEditTarget(null) });
  const deleteTenant     = useDeleteTenant({ onSuccess: () => setDeleteTarget(null) });
  const changeStatus     = useChangeTenantStatus();

  const tenants     = data?.content ?? [];
  const totalPages  = data?.totalPages ?? 0;
  const totalItems  = data?.totalElements ?? 0;

  // Strip empty optional strings before sending to API
  const cleanPayload = (values) =>
    Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Tenants</h2>
          <p className="text-sm text-slate-500 font-medium">
            {totalItems > 0 ? `${totalItems} organization${totalItems !== 1 ? 's' : ''} registered` : 'Manage enterprise organizations on the network'}
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-red-600 text-white hover:bg-red-700 text-xs font-bold px-4 py-2 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Tenant
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or NIP…"
            className="pl-9 h-9 text-sm border-slate-200 bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {/* ── Table ── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Loading tenants…</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-sm font-semibold">{error?.message ?? 'Failed to load tenants'}</span>
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400">
              <Building2 className="h-8 w-8" />
              <span className="text-sm font-medium">No tenants found</span>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Organization</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">NIP</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">City</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Package</TableHead>
                  <TableHead className="text-right px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="font-bold text-sm text-slate-700">{tenant.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold font-mono tracking-tight">
                        {tenant.nip}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-600">{tenant.email}</TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-500">{tenant.city ?? '—'}</TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="relative inline-flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_STYLES[tenant.status]?.dot ?? 'bg-slate-400'}`} />
                        <select
                          value={tenant.status}
                          disabled={changeStatus.isPending}
                          onChange={(e) => changeStatus.mutate({ id: tenant.id, status: e.target.value })}
                          className={`text-[10px] font-bold uppercase tracking-wider bg-transparent border-none outline-none cursor-pointer appearance-none pr-3 disabled:cursor-not-allowed disabled:opacity-50 ${STATUS_STYLES[tenant.status]?.text ?? 'text-slate-500'}`}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                          <option value="SUSPENDED">Suspended</option>
                        </select>
                        {changeStatus.isPending
                          ? <Loader2 className="h-3 w-3 animate-spin text-slate-400 shrink-0" />
                          : <span className={`text-[8px] shrink-0 ${STATUS_STYLES[tenant.status]?.text ?? 'text-slate-400'}`}>▾</span>}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {tenant.currentPackage ? (
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest border-slate-200 bg-white text-slate-500">
                          {tenant.currentPackage.name}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">No package</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6 py-4">
                      <div className="flex justify-end gap-1">

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => setEditTarget(tenant)}
                          title="Edit tenant"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => setDeleteTarget(tenant)}
                          title="Delete tenant"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span className="text-xs font-medium">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-slate-200"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-slate-200"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Create Modal ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">New Tenant</DialogTitle>
            <DialogDescription className="text-slate-500">
              Register a new organization on the platform.
            </DialogDescription>
          </DialogHeader>
          <TenantForm
            submitLabel="Create Tenant"
            isPending={createTenant.isPending}
            onSubmit={(values) => createTenant.mutate(cleanPayload(values))}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">Edit Tenant</DialogTitle>
            <DialogDescription className="text-slate-500">
              Update details for <strong>{editTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <TenantForm
              defaultValues={editTarget}
              submitLabel="Save Changes"
              isPending={updateTenant.isPending}
              onSubmit={(values) =>
                updateTenant.mutate({ id: editTarget.id, data: cleanPayload(values) })
              }
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Delete Tenant
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-700">{deleteTarget?.name}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              className="border-slate-200 text-slate-600"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={deleteTenant.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={() => deleteTenant.mutate(deleteTarget.id)}
            >
              {deleteTenant.isPending
                ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Deleting…</>
                : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
