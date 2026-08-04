// DSAR queue — Arts. 15–22 with real deadlines (1 month, +2 on extension).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { CheckCircle2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import ExportMenu from '../../components/common/ExportMenu';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { StatusBadge, DeadlineBadge } from '../../components/common/StatusBadge';
import { FormField, Input, Select, Textarea } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchDsars, createDsar } from '../../store/slices/dsarsSlice';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { dsarDaysLeft } from '../../services/dsarService';
import { useT } from '../../i18n';
import { useOrgBase } from '../../lib/paths';
import { can, ACTIONS } from '../../lib/permissions';
import { DSAR_TYPES, labelOf, byId } from '../../lib/gdpr';
import { buildDsarCsv, registerFilename } from '../../lib/registersCsv';
import { failureMessage } from '../../lib/apiErrors';

const EMPTY_FORM = { type: 'access', requesterName: '', requesterEmail: '', relation: '', notes: '', receivedAt: '' };

export default function DsarPage() {
  const base = useOrgBase();
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('dsars', fetchDsars);
  // Company + DPO details for the exported register's identity block.
  const settings = useSelector((s) => s.settings);
  useEffect(() => {
    if (settings.status === 'idle') dispatch(fetchSettings());
  }, [settings.status, dispatch]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const closeDialog = () => { setOpen(false); setForm(EMPTY_FORM); setErrors({}); };

  // Update a field and clear its error as soon as the user starts fixing it.
  const setField = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const submit = async () => {
    // A request may be logged after it was received — let the user set the true
    // receipt date so the Art. 12(3) one-month deadline is calculated correctly.
    // Empty → the service defaults to now.
    if (!form.requesterName.trim()) {
      setErrors({ requesterName: t('dsar.nameRequired') });
      return;
    }
    const payload = { ...form };
    if (form.receivedAt) payload.receivedAt = new Date(form.receivedAt).toISOString();
    else delete payload.receivedAt;
    const action = await dispatch(createDsar(payload));
    if (action.error) toast.error(failureMessage(action.error, t));
    else { toast.success(t('common.save')); closeDialog(); }
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('dsar.title')} subtitle={t('dsar.subtitle')}>
        {/* How the company shows it answered people within the Art. 12(3) month. The file
            names the requesters, so it is one of the most sensitive exports in the product —
            which is exactly why every copy of it lands in the audit trail. */}
        <ExportMenu
          target="register_dsar"
          label={t('dsar.exportCsv')}
          itemCount={items.length}
          disabled={!settings.data || items.length === 0}
          build={() => ({
            filename: registerFilename('dsar', lang),
            content: buildDsarCsv({ settings: settings.data, dsars: items, lang, t }),
          })}
        />
        {can(user, ACTIONS.MANAGE_DSAR) && (
          <Button onClick={() => setOpen(true)}><Plus /> {t('dsar.new')}</Button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          title={t('dsar.emptyTitle')}
          hint={t('dsar.empty')}
          action={can(user, ACTIONS.MANAGE_DSAR) && (
            <Button size="sm" onClick={() => setOpen(true)}><Plus /> {t('dsar.new')}</Button>
          )}
        />
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
                      <Link to={`${base}/dsar/${r.id}`} className="font-medium text-foreground hover:text-primary">
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
                      {/* A completed request has no deadline pressure left, so the useful
                          fact is WHEN it was completed — not a bare tick, which the status
                          column already conveys. */}
                      {r.status === 'completed' ? (
                        <span className="flex items-center gap-1.5 text-xs text-(--status-ok)">
                          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                          {r.completedAt
                            ? t('dsar.completedOn').replace('{date}',
                                new Date(r.completedAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB'))
                            : t('status.completed')}
                        </span>
                      ) : (
                        <DeadlineBadge daysLeft={days} overdueLabel={t('common.overdue')} daysLabel={t('common.daysLeft')} />
                      )}
                      {r.extended && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t('dsar.extendedBy2Months')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t('dsar.new')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <FormField label={t('dsar.type')}>
              {(fid) => (
                <Select id={fid} value={form.type} onChange={(e) => setField({ type: e.target.value })}>
                  {DSAR_TYPES.map((d) => <option key={d.id} value={d.id}>{d[lang]} ({d.ref})</option>)}
                </Select>
              )}
            </FormField>
            <FormField label={t('dsar.requester')} required error={errors.requesterName}>
              {(fid) => <Input id={fid} value={form.requesterName} onChange={(e) => setField({ requesterName: e.target.value })} />}
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t('dsar.requesterEmail')}>
                {(fid) => <Input id={fid} type="email" value={form.requesterEmail} onChange={(e) => setField({ requesterEmail: e.target.value })} />}
              </FormField>
              <FormField label={t('dsar.receivedAt')} hint={t('dsar.receivedAtHint')}>
                {(fid) => <Input id={fid} type="date" value={form.receivedAt}
                  onChange={(e) => setField({ receivedAt: e.target.value })} />}
              </FormField>
            </div>
            <FormField label={t('dsar.relation')} hint={t('dsar.relationHint')}>
              {(fid) => <Input id={fid} value={form.relation} onChange={(e) => setField({ relation: e.target.value })} />}
            </FormField>
            <FormField label={t('dsar.notes')}>
              {(fid) => <Textarea id={fid} value={form.notes} onChange={(e) => setField({ notes: e.target.value })} />}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            {/* Deliberately NOT disabled — pressing Save explains what is missing. */}
            <Button onClick={submit}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
