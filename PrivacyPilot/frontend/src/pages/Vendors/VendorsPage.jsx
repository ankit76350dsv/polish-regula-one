// Processors & DPAs (Art. 28) — inventory with DPA status; a missing DPA is a
// visible red finding, not a decoration.
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { FormField, Input, Select } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchVendors, createVendor, updateVendor } from '../../store/slices/vendorsSlice';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { cn } from '@/lib/utils';

const DPA_STYLES = {
  signed: 'border-(--status-ok)/50 text-(--status-ok)',
  in_negotiation: 'border-(--status-warn)/50 text-(--status-warn)',
  missing: 'border-(--status-risk)/50 text-(--status-risk)',
};

const EMPTY_FORM = { name: '', country: 'Poland', region: '', dpaStatus: 'missing', riskLevel: 'medium', subprocessors: [] };

export default function VendorsPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('vendors', fetchVendors);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const canManage = can(user.role, ACTIONS.MANAGE_VENDORS);

  const submit = async () => {
    const action = await dispatch(createVendor({
      ...form,
      lastReviewAt: new Date().toISOString(),
    }));
    if (action.error) toast.error(t('common.notAuthorized'));
    else { toast.success(t('common.save')); setOpen(false); setForm(EMPTY_FORM); }
  };

  const setDpa = async (id, dpaStatus) => {
    const action = await dispatch(updateVendor({ id, patch: { dpaStatus } }));
    if (action.error) toast.error(t('common.notAuthorized'));
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('vendors.title')} subtitle={t('vendors.subtitle')}>
        {canManage && (
          <Button onClick={() => setOpen(true)}><Plus /> {t('vendors.add')}</Button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === 'pl' ? 'Podmiot' : 'Processor'}</TableHead>
                <TableHead>{t('vendors.country')}</TableHead>
                <TableHead>{t('common.region')}</TableHead>
                <TableHead>{t('vendors.dpaStatus')}</TableHead>
                <TableHead>{t('vendors.subprocessors')}</TableHead>
                <TableHead>{lang === 'pl' ? 'Ostatni przegląd' : 'Last review'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium text-foreground">{v.name}</TableCell>
                  <TableCell className="text-muted-foreground">{v.country}</TableCell>
                  <TableCell className="text-muted-foreground">{v.region}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select value={v.dpaStatus} onChange={(e) => setDpa(v.id, e.target.value)}
                        aria-label={t('vendors.dpaStatus')} className={cn('w-44 text-xs', v.dpaStatus === 'missing' && 'border-(--status-risk)/60')}>
                        <option value="signed">{t('vendors.dpa.signed')}</option>
                        <option value="in_negotiation">{t('vendors.dpa.in_negotiation')}</option>
                        <option value="missing">{t('vendors.dpa.missing')}</option>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={DPA_STYLES[v.dpaStatus]}>
                        {t(`vendors.dpa.${v.dpaStatus}`)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {v.subprocessors?.join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.lastReviewAt ? new Date(v.lastReviewAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('vendors.add')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <FormField label={lang === 'pl' ? 'Nazwa podmiotu' : 'Processor name'} required>
              {(fid) => <Input id={fid} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('vendors.country')}>
                {(fid) => <Input id={fid} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />}
              </FormField>
              <FormField label="Region / hosting">
                {(fid) => <Input id={fid} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />}
              </FormField>
            </div>
            <FormField label={t('vendors.dpaStatus')}>
              {(fid) => (
                <Select id={fid} value={form.dpaStatus} onChange={(e) => setForm({ ...form, dpaStatus: e.target.value })}>
                  <option value="signed">{t('vendors.dpa.signed')}</option>
                  <option value="in_negotiation">{t('vendors.dpa.in_negotiation')}</option>
                  <option value="missing">{t('vendors.dpa.missing')}</option>
                </Select>
              )}
            </FormField>
            <FormField label={t('vendors.subprocessors')} hint={lang === 'pl' ? 'Rozdziel przecinkami.' : 'Separate with commas.'}>
              {(fid) => (
                <Input id={fid} value={form.subprocessors.join(', ')}
                  onChange={(e) => setForm({ ...form, subprocessors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              )}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={submit} disabled={!form.name.trim()}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
