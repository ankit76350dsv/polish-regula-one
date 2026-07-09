// DSAR queue — Arts. 15–22 with real deadlines (1 month, +2 on extension).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { StatusBadge, DeadlineBadge } from '../../components/common/StatusBadge';
import { FormField, Input, Select, Textarea } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchDsars, createDsar } from '../../store/slices/dsarsSlice';
import { dsarDaysLeft } from '../../services/dsarService';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { DSAR_TYPES, labelOf, byId } from '../../lib/gdpr';

const EMPTY_FORM = { type: 'access', requesterName: '', requesterEmail: '', relation: '', notes: '', receivedAt: '' };

export default function DsarPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('dsars', fetchDsars);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const submit = async () => {
    // A request may be logged after it was received — let the user set the true
    // receipt date so the Art. 12(3) one-month deadline is calculated correctly.
    // Empty → the service defaults to now.
    const payload = { ...form };
    if (form.receivedAt) payload.receivedAt = new Date(form.receivedAt).toISOString();
    else delete payload.receivedAt;
    const action = await dispatch(createDsar(payload));
    if (action.error) toast.error(t('common.notAuthorized'));
    else { toast.success(t('common.save')); setOpen(false); setForm(EMPTY_FORM); }
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('dsar.title')} subtitle={t('dsar.subtitle')}>
        {can(user.role, ACTIONS.MANAGE_DSAR) && (
          <Button onClick={() => setOpen(true)}><Plus /> {t('dsar.new')}</Button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dsar.requester')}</TableHead>
                <TableHead>{t('dsar.type')}</TableHead>
                <TableHead>{t('dsar.received')}</TableHead>
                <TableHead>{t('common.deadline')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => {
                const days = dsarDaysLeft(r);
                const typeMeta = byId(DSAR_TYPES, r.type);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/dsar/${r.id}`} className="font-medium text-foreground hover:text-primary">
                        {r.requesterName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.relation}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {labelOf(DSAR_TYPES, r.type, lang)} <span className="text-xs">({typeMeta?.ref})</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.receivedAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                    </TableCell>
                    <TableCell>
                      {r.status === 'completed' ? (
                        <span className="text-xs text-(--status-ok)">✓</span>
                      ) : (
                        <DeadlineBadge daysLeft={days} overdueLabel={t('common.overdue')} daysLabel={t('common.daysLeft')} />
                      )}
                      {r.extended && <p className="mt-0.5 text-[10px] text-muted-foreground">Art. 12(3) +2m</p>}
                    </TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('dsar.new')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <FormField label={t('dsar.type')}>
              {(fid) => (
                <Select id={fid} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {DSAR_TYPES.map((d) => <option key={d.id} value={d.id}>{d[lang]} ({d.ref})</option>)}
                </Select>
              )}
            </FormField>
            <FormField label={t('dsar.requester')} required>
              {(fid) => <Input id={fid} value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} />}
            </FormField>
            <FormField label="E-mail">
              {(fid) => <Input id={fid} type="email" value={form.requesterEmail} onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })} />}
            </FormField>
            <FormField label={lang === 'pl' ? 'Relacja (np. były pracownik, klient)' : 'Relation (e.g. former employee, customer)'}>
              {(fid) => <Input id={fid} value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />}
            </FormField>
            <FormField label={t('dsar.receivedAt')}
              hint={lang === 'pl' ? 'Domyślnie dziś. Termin 1 miesiąca liczy się od tej daty.' : 'Defaults to today. The 1-month deadline runs from this date.'}>
              {(fid) => <Input id={fid} type="date" value={form.receivedAt}
                onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} />}
            </FormField>
            <FormField label={lang === 'pl' ? 'Notatki' : 'Notes'}>
              {(fid) => <Textarea id={fid} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={submit} disabled={!form.requesterName.trim()}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
