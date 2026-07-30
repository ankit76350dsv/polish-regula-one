// Processors & DPAs (Art. 28) — the list of suppliers that handle personal data on the
// company's behalf, each with the state of its Data Processing Agreement. A missing DPA
// shows in red because it is a real finding, not decoration.
//
// Archiving (never hard delete) is Admin-only and is refused while an activity or a
// transfer still points at the processor, so no Art. 28 link is ever left dangling.
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Archive, Plus, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { FormField, Input, Select } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchVendors, createVendor, updateVendor, archiveVendor } from '../../store/slices/vendorsSlice';
import { useT } from '../../i18n';
import { can, hasRole, ACTIONS, ROLES } from '../../lib/permissions';
import { cn } from '@/lib/utils';

const DPA_STYLES = {
  signed: 'border-(--status-ok)/50 text-(--status-ok)',
  in_negotiation: 'border-(--status-warn)/50 text-(--status-warn)',
  missing: 'border-(--status-risk)/50 text-(--status-risk)',
};

// A blank form. The country is pre-filled for the home market (and in the reader's own
// language — it used to be the English literal "Poland" even in the Polish interface).
const emptyForm = (lang) => ({
  name: '', country: lang === 'pl' ? 'Polska' : 'Poland', region: '',
  dpaStatus: 'missing', riskLevel: 'medium', subprocessors: [],
});

/**
 * Turn a failed request into something a person can act on.
 *
 * Every failure on this page used to say "Your role does not permit this action" — so a
 * network glitch or a server error told the user they lacked permission, sending them to
 * their administrator for a problem that had nothing to do with access.
 */
const failureMessage = (error, t) => {
  if (error?.message === 'FORBIDDEN') return t('common.notAuthorized');
  if (error?.message === 'CONFLICT') return t('vendors.inUse');
  return t('common.saveFailed');
};

export default function VendorsPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('vendors', fetchVendors);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(lang));
  const [formError, setFormError] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = create mode
  const [confirmId, setConfirmId] = useState(null);  // processor awaiting archive confirmation
  const canManage = can(user, ACTIONS.MANAGE_VENDORS);
  // Archiving is destructive, so the backend restricts it to Admins — mirror that here.
  const canDelete = canManage && (hasRole(user, ROLES.PRIVACYPILOT_ADMIN) || user?.role === 'ROLE_SUPER_ADMIN');

  const openCreate = () => {
    setForm(emptyForm(lang));
    setFormError(null);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (v) => {
    setForm({
      name: v.name ?? '', country: v.country ?? '', region: v.region ?? '',
      dpaStatus: v.dpaStatus ?? 'missing', riskLevel: v.riskLevel ?? 'medium',
      subprocessors: v.subprocessors ?? [],
    });
    setEditingId(v.id);
    setFormError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormError(null);
    setForm(emptyForm(lang));
  };

  const submit = async () => {
    // Check first and say what is wrong, next to the field. The Save button used to be
    // silently disabled, which leaves the user guessing what is missing.
    if (!form.name.trim()) {
      setFormError(t('vendors.nameRequired'));
      return;
    }
    setFormError(null);
    // Saving the form counts as reviewing the processor, so the "last reviewed" date is
    // stamped on create AND on edit — otherwise that column showed the date the record was
    // added and never changed again, which is worse than showing nothing.
    const patch = { ...form, lastReviewAt: new Date().toISOString() };
    const action = editingId
      ? await dispatch(updateVendor({ id: editingId, patch }))
      : await dispatch(createVendor(patch));
    if (action.error) toast.error(failureMessage(action.error, t));
    else { toast.success(t('common.save')); closeDialog(); }
  };

  const setDpa = async (id, dpaStatus) => {
    const action = await dispatch(updateVendor({ id, patch: { dpaStatus } }));
    if (action.error) toast.error(failureMessage(action.error, t));
  };

  const remove = async () => {
    const id = confirmId;
    setConfirmId(null);
    if (!id) return;
    const action = await dispatch(archiveVendor(id));
    if (action.error) toast.error(failureMessage(action.error, t));
    else toast.success(t('vendors.archived'));
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('vendors.title')} subtitle={t('vendors.subtitle')}>
        {canManage && (
          <Button onClick={openCreate}><Plus /> {t('vendors.add')}</Button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          title={t('vendors.emptyTitle')}
          hint={t('vendors.empty')}
          action={canManage && (
            <Button size="sm" onClick={openCreate}><Plus /> {t('vendors.add')}</Button>
          )}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('vendors.processor')}</TableHead>
                <TableHead>{t('vendors.country')}</TableHead>
                <TableHead>{t('vendors.hosting')}</TableHead>
                <TableHead>{t('vendors.dpaStatus')}</TableHead>
                <TableHead>{t('vendors.subprocessors')}</TableHead>
                <TableHead>{t('vendors.lastReview')}</TableHead>
                {canManage && <TableHead className="w-20 text-right">{t('common.actions')}</TableHead>}
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
                        aria-label={t('vendors.dpaStatus')}
                        className={cn('w-44', v.dpaStatus === 'missing' && 'border-(--status-risk)/60')}>
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
                  {/* Truncated for layout, but the full list is in the tooltip — these are
                      Art. 28(2)/(4) sub-processors, so they must stay retrievable. */}
                  <TableCell
                    className="max-w-48 truncate text-muted-foreground"
                    title={v.subprocessors?.join(', ') || undefined}
                  >
                    {v.subprocessors?.join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.lastReviewAt ? new Date(v.lastReviewAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB') : '—'}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')} onClick={() => openEdit(v)}>
                          <Pencil />
                        </Button>
                        {/* Archive, not delete — the record is kept for the retention
                            rules. Same wording and icon as archiving an activity. */}
                        {canDelete && (
                          <Button variant="ghost" size="icon-sm" aria-label={t('status.archived')}
                            onClick={() => setConfirmId(v.id)}>
                            <Archive />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t('vendors.edit') : t('vendors.add')}</DialogTitle>
          </DialogHeader>
          {/* One column on a phone, two where there is room — the two short fields used to
              sit in a fixed 2-up grid that squeezed them on narrow screens. */}
          <div className="grid gap-3">
            <FormField label={t('vendors.name')} required error={formError}>
              {(fid) => (
                <Input id={fid} value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (formError) setFormError(null); // clear as soon as they start fixing it
                  }} />
              )}
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t('vendors.country')}>
                {(fid) => <Input id={fid} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />}
              </FormField>
              <FormField label={t('vendors.hosting')}>
                {(fid) => <Input id={fid} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />}
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t('vendors.dpaStatus')}>
                {(fid) => (
                  <Select id={fid} value={form.dpaStatus} onChange={(e) => setForm({ ...form, dpaStatus: e.target.value })}>
                    <option value="signed">{t('vendors.dpa.signed')}</option>
                    <option value="in_negotiation">{t('vendors.dpa.in_negotiation')}</option>
                    <option value="missing">{t('vendors.dpa.missing')}</option>
                  </Select>
                )}
              </FormField>
              {/* The risk rating was already stored on every processor but was never shown
                  or editable, so it silently stayed "Medium" forever. */}
              <FormField label={t('risk.level')}>
                {(fid) => (
                  <Select id={fid} value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}>
                    <option value="low">{t('risk.low')}</option>
                    <option value="medium">{t('risk.medium')}</option>
                    <option value="high">{t('risk.high')}</option>
                  </Select>
                )}
              </FormField>
            </div>
            <FormField label={t('vendors.subprocessors')} hint={t('vendors.subprocessorsHint')}>
              {(fid) => (
                <Input id={fid} value={form.subprocessors.join(', ')}
                  onChange={(e) => setForm({ ...form, subprocessors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              )}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            {/* Deliberately NOT disabled — pressing Save on an incomplete form now explains
                what is missing instead of leaving the user with a dead button. */}
            <Button onClick={submit}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmId)}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title={t('vendors.archiveTitle')}
        description={t('vendors.archiveBody')}
        confirmLabel={t('status.archived')}
        onConfirm={remove}
      />
    </div>
  );
}
