// Breach register — ALL breaches documented (Art. 33(5)), with a live 72h
// notification clock on the ones that must go to UODO.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Plus, Siren } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import PageHeader from '../../components/common/PageHeader';
import ExportMenu from '../../components/common/ExportMenu';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { StatusBadge } from '../../components/common/StatusBadge';
import { FormField, Input, Select, Textarea } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { useNow, formatCountdown } from '../../hooks/useNow';
import { fetchBreaches, createBreach } from '../../store/slices/breachesSlice';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { buildBreachCsv, registerFilename } from '../../lib/registersCsv';
import { useT } from '../../i18n';
import { useOrgBase } from '../../lib/paths';
import { can, ACTIONS } from '../../lib/permissions';
import { UODO_WINDOW_MS } from '../../services/breachService';
import { cn } from '@/lib/utils';
import { DATA_CATEGORIES } from '../../lib/gdpr';
import { failureMessage } from '../../lib/apiErrors';

const EMPTY_FORM = {
  title: '', description: '', subjectsCount: 0, recordsCount: 0, riskLevel: 'medium',
  uodoNotificationRequired: true, subjectsNotificationRequired: false,
  riskRationale: '', dataCategories: [],
};

const toggleId = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/**
 * The reporting state of one breach, at a glance.
 *
 * Every state used to be shorthand only a specialist could read: a bare "Art. 33(5)", and
 * "UODO ✓" / "⏱" built from glyph characters that render in the text font and sit off the
 * baseline. Each state now says what it means, in words, with a proper icon.
 */
export function BreachClockBadge({ breach, now }) {
  const { t } = useT();
  if (!breach.uodoNotificationRequired) {
    return (
      <Badge variant="outline" className="text-muted-foreground">{t('breach.notNotifiable')}</Badge>
    );
  }
  if (breach.uodoNotifiedAt) {
    return (
      <Badge variant="outline" className="gap-1 border-(--status-ok)/50 text-(--status-ok)">
        <CheckCircle2 className="size-3" aria-hidden /> {t('breach.uodoNotified')}
      </Badge>
    );
  }
  const remaining = new Date(breach.discoveredAt).getTime() + UODO_WINDOW_MS - now;
  if (remaining <= 0) {
    return (
      <Badge variant="outline" className="border-(--status-risk)/50 text-(--status-risk)">
        {t('breach.expired')}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(
      'gap-1 font-mono',
      remaining < 12 * 3600 * 1000
        ? 'border-(--status-risk)/50 text-(--status-risk)'
        : 'border-(--status-warn)/50 text-(--status-warn)',
    )}>
      <Clock className="size-3" aria-hidden /> {formatCountdown(remaining)}
    </Badge>
  );
}

export default function BreachesPage() {
  const base = useOrgBase();
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('breaches', fetchBreaches);
  // Company + DPO details for the exported register's identity block.
  const settings = useSelector((s) => s.settings);
  useEffect(() => {
    if (settings.status === 'idle') dispatch(fetchSettings());
  }, [settings.status, dispatch]);
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const closeDialog = () => { setOpen(false); setForm(EMPTY_FORM); setErrors({}); };

  // Update fields and clear each one's error as soon as the user starts fixing it.
  const setField = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const submit = async () => {
    // Name what is missing, next to the field. The Save button used to be silently
    // disabled on three separate conditions with no clue which one was unmet.
    const found = {};
    if (!form.title.trim()) found.title = t('breach.titleRequired');
    if (!form.description.trim()) found.description = t('breach.descriptionRequired');
    if (!form.riskRationale.trim()) found.riskRationale = t('breach.rationaleRequired');
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    const action = await dispatch(createBreach({
      ...form,
      subjectsCount: Number(form.subjectsCount) || 0,
      recordsCount: Number(form.recordsCount) || 0,
      discoveredAt: new Date().toISOString(),
    }));
    if (action.error) toast.error(failureMessage(action.error, t));
    else { toast.success(t('common.save')); closeDialog(); }
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('breach.title')} subtitle={t('breach.subtitle')}>
        {/* Art. 33(5) obliges the controller to document EVERY breach and to make that
            documentation available to the supervisory authority on request — so being able to
            hand over the whole register, including the "notified within 72 h?" answer for each
            entry, is a legal requirement rather than a convenience. */}
        <ExportMenu
          target="register_breaches"
          label={t('breach.exportCsv')}
          itemCount={items.length}
          disabled={!settings.data || items.length === 0}
          build={() => ({
            filename: registerFilename('breaches', lang),
            content: buildBreachCsv({ settings: settings.data, breaches: items, lang, t }),
          })}
        />
        {can(user, ACTIONS.MANAGE_BREACHES) && (
          <Button onClick={() => setOpen(true)}><Plus /> {t('breach.report')}</Button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          title={t('breach.emptyTitle')}
          hint={t('breach.empty')}
          action={can(user, ACTIONS.MANAGE_BREACHES) && (
            <Button size="sm" onClick={() => setOpen(true)}><Plus /> {t('breach.report')}</Button>
          )}
        />
      ) : (
        <div className="grid gap-3">
          {items.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Siren className={b.status === 'open' ? 'size-4 shrink-0 text-(--status-risk)' : 'size-4 shrink-0 text-muted-foreground'} aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link to={`${base}/breaches/${b.id}`} className="font-medium text-foreground hover:text-primary">
                    {b.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('breach.discovered')}: {new Date(b.discoveredAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                    {' · '}{t('breach.subjectsCount').replace('{count}', b.subjectsCount)}
                  </p>
                </div>
                <BreachClockBadge breach={b} now={now} />
                <StatusBadge status={b.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('breach.report')}</DialogTitle>
            <DialogDescription>{t('breach.clockNote')}</DialogDescription>
          </DialogHeader>
          {/* Two-column form: short fields pair up; wide fields (textareas, chips)
              span both columns. Collapses to one column on small screens. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t('breach.breachTitle')} required error={errors.title}>
              {(fid) => <Input id={fid} value={form.title} onChange={(e) => setField({ title: e.target.value })} />}
            </FormField>
            {/* The three risk labels are the shared ones, so they read the same here, on a
                processor record and anywhere else a risk rating appears. */}
            <FormField label={t('risk.level')}>
              {(fid) => (
                <Select id={fid} value={form.riskLevel} onChange={(e) => setField({ riskLevel: e.target.value })}>
                  <option value="low">{t('risk.low')}</option>
                  <option value="medium">{t('risk.medium')}</option>
                  <option value="high">{t('risk.high')}</option>
                </Select>
              )}
            </FormField>
            <div className="sm:col-span-2">
              <FormField label={t('breach.description')} required error={errors.description}>
                {(fid) => <Textarea id={fid} value={form.description} onChange={(e) => setField({ description: e.target.value })} />}
              </FormField>
            </div>
            <FormField label={t('breach.subjects')}>
              {(fid) => <Input id={fid} type="number" min="0" value={form.subjectsCount}
                onChange={(e) => setField({ subjectsCount: e.target.value })} />}
            </FormField>
            <FormField label={t('breach.recordsCount')}>
              {(fid) => <Input id={fid} type="number" min="0" value={form.recordsCount}
                onChange={(e) => setField({ recordsCount: e.target.value })} />}
            </FormField>
            <div className="sm:col-span-2">
              <FormField label={t('breach.dataCategories')}>
                <div className="flex flex-wrap gap-1.5">
                  {DATA_CATEGORIES.map((c) => {
                    const active = form.dataCategories.includes(c.id);
                    return (
                      <button key={c.id} type="button" aria-pressed={active}
                        onClick={() => setField({ dataCategories: toggleId(form.dataCategories, c.id) })}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          active ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}>
                        {c[lang]}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            </div>
            {/* accent-primary, not a raw hex — the brand gold lives in one token. */}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary" checked={form.uodoNotificationRequired}
                onChange={(e) => setField({ uodoNotificationRequired: e.target.checked })} />
              {t('breach.notifyUodo')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary" checked={form.subjectsNotificationRequired}
                onChange={(e) => setField({ subjectsNotificationRequired: e.target.checked })} />
              {t('breach.notifySubjects')}
            </label>
            <div className="sm:col-span-2">
              <FormField label={t('breach.riskRationale')} required
                error={errors.riskRationale} hint={t('breach.rationaleHint')}>
                {(fid) => <Textarea id={fid} value={form.riskRationale} onChange={(e) => setField({ riskRationale: e.target.value })} />}
              </FormField>
            </div>
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
