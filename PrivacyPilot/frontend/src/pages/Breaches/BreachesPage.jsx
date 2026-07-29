// Breach register — ALL breaches documented (Art. 33(5)), with a live 72h
// notification clock on the ones that must go to UODO.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Plus, Siren } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { StatusBadge } from '../../components/common/StatusBadge';
import { FormField, Input, Select, Textarea } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { useNow, formatCountdown } from '../../hooks/useNow';
import { fetchBreaches, createBreach } from '../../store/slices/breachesSlice';
import { useT } from '../../i18n';
import { useOrgBase } from '../../lib/paths';
import { can, ACTIONS } from '../../lib/permissions';
import { UODO_WINDOW_MS } from '../../services/breachService';
import { cn } from '@/lib/utils';
import { DATA_CATEGORIES } from '../../lib/gdpr';

const EMPTY_FORM = {
  title: '', description: '', subjectsCount: 0, recordsCount: 0, riskLevel: 'medium',
  uodoNotificationRequired: true, subjectsNotificationRequired: false,
  riskRationale: '', dataCategories: [],
};

const toggleId = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function BreachClockBadge({ breach, now }) {
  const { t } = useT();
  if (!breach.uodoNotificationRequired) {
    return <Badge variant="outline" className="text-muted-foreground">Art. 33(5)</Badge>;
  }
  if (breach.uodoNotifiedAt) {
    return <Badge variant="outline" className="border-(--status-ok)/50 text-(--status-ok)">UODO ✓</Badge>;
  }
  const remaining = new Date(breach.discoveredAt).getTime() + UODO_WINDOW_MS - now;
  if (remaining <= 0) {
    return <Badge variant="outline" className="border-(--status-risk)/50 text-(--status-risk)">{t('breach.expired')}</Badge>;
  }
  return (
    <Badge variant="outline" className={
      remaining < 12 * 3600 * 1000
        ? 'border-(--status-risk)/50 font-mono text-(--status-risk)'
        : 'border-(--status-warn)/50 font-mono text-(--status-warn)'
    }>
      ⏱ {formatCountdown(remaining)}
    </Badge>
  );
}

export default function BreachesPage() {
  const base = useOrgBase();
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('breaches', fetchBreaches);
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const submit = async () => {
    const action = await dispatch(createBreach({
      ...form,
      subjectsCount: Number(form.subjectsCount) || 0,
      recordsCount: Number(form.recordsCount) || 0,
      discoveredAt: new Date().toISOString(),
    }));
    if (action.error) toast.error(t('common.notAuthorized'));
    else { toast.success(t('common.save')); setOpen(false); setForm(EMPTY_FORM); }
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('breach.title')} subtitle={t('breach.subtitle')}>
        {can(user, ACTIONS.MANAGE_BREACHES) && (
          <Button onClick={() => setOpen(true)}><Plus /> {t('breach.report')}</Button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3">
          {items.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Siren className={b.status === 'open' ? 'size-4 shrink-0 text-(--status-risk)' : 'size-4 shrink-0 text-muted-foreground'} aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link to={`${base}/breaches/${b.id}`} className="font-medium text-foreground hover:text-primary">
                    {b.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('breach.discovered')}: {new Date(b.discoveredAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                    {' · '}{b.subjectsCount} {lang === 'pl' ? 'osób' : 'subjects'}
                  </p>
                </div>
                <BreachClockBadge breach={b} now={now} />
                <StatusBadge status={b.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('breach.report')}</DialogTitle>
            <DialogDescription>
              {lang === 'pl'
                ? 'Zegar 72h liczy się od stwierdzenia naruszenia (art. 33(1)).'
                : 'The 72h clock runs from when the breach was discovered (Art. 33(1)).'}
            </DialogDescription>
          </DialogHeader>
          {/* Two-column form: short fields pair up; wide fields (textareas, chips)
              span both columns. Collapses to one column on small screens. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={lang === 'pl' ? 'Tytuł naruszenia' : 'Breach title'} required>
              {(fid) => <Input id={fid} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
            </FormField>
            <FormField label={lang === 'pl' ? 'Poziom ryzyka' : 'Risk level'}>
              {(fid) => (
                <Select id={fid} value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}>
                  <option value="low">{lang === 'pl' ? 'Niskie' : 'Low'}</option>
                  <option value="medium">{lang === 'pl' ? 'Średnie' : 'Medium'}</option>
                  <option value="high">{lang === 'pl' ? 'Wysokie' : 'High'}</option>
                </Select>
              )}
            </FormField>
            <div className="sm:col-span-2">
              <FormField label={lang === 'pl' ? 'Opis (charakter naruszenia — art. 33(3)(a))' : 'Description (nature of the breach — Art. 33(3)(a))'} required>
                {(fid) => <Textarea id={fid} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
              </FormField>
            </div>
            <FormField label={lang === 'pl' ? 'Liczba osób' : 'Subjects affected'}>
              {(fid) => <Input id={fid} type="number" min="0" value={form.subjectsCount}
                onChange={(e) => setForm({ ...form, subjectsCount: e.target.value })} />}
            </FormField>
            <FormField label={t('breach.recordsCount')}>
              {(fid) => <Input id={fid} type="number" min="0" value={form.recordsCount}
                onChange={(e) => setForm({ ...form, recordsCount: e.target.value })} />}
            </FormField>
            <div className="sm:col-span-2">
              <FormField label={t('breach.dataCategories')}>
                <div className="flex flex-wrap gap-1.5">
                  {DATA_CATEGORIES.map((c) => {
                    const active = form.dataCategories.includes(c.id);
                    return (
                      <button key={c.id} type="button" aria-pressed={active}
                        onClick={() => setForm({ ...form, dataCategories: toggleId(form.dataCategories, c.id) })}
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
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#c5a059]" checked={form.uodoNotificationRequired}
                onChange={(e) => setForm({ ...form, uodoNotificationRequired: e.target.checked })} />
              {t('breach.notifyUodo')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#c5a059]" checked={form.subjectsNotificationRequired}
                onChange={(e) => setForm({ ...form, subjectsNotificationRequired: e.target.checked })} />
              {t('breach.notifySubjects')}
            </label>
            <div className="sm:col-span-2">
              <FormField label={t('breach.riskRationale')} required
                hint={lang === 'pl'
                  ? 'Udokumentuj decyzję także gdy NIE zgłaszasz (art. 33(5)).'
                  : 'Document the decision even when NOT notifying (Art. 33(5)).'}>
                {(fid) => <Textarea id={fid} value={form.riskRationale} onChange={(e) => setForm({ ...form, riskRationale: e.target.value })} />}
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={submit} disabled={!form.title.trim() || !form.description.trim() || !form.riskRationale.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
