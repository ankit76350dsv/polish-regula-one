// Breach workspace — live 72h clock, remediation checklist, risk rationale,
// and the "notified UODO" action that timestamps the submission.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { CheckCircle2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, ErrorState } from '../../components/common/States';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useSliceData } from '../../hooks/useSliceData';
import { useNow, formatCountdown } from '../../hooks/useNow';
import { fetchBreaches, updateBreach, markBreachNotified } from '../../store/slices/breachesSlice';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { UODO_WINDOW_MS } from '../../services/breachService';
import { BreachClockBadge } from './BreachesPage';
import { AiDraftDialog, useAiEnabled } from '../../components/common/AiAssist';
import { aiDraftBreachNotification } from '../../store/slices/aiSlice';

export default function BreachDetailPage() {
  const { id } = useParams();
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('breaches', fetchBreaches);
  const now = useNow(1000);
  const aiEnabled = useAiEnabled();
  const [aiOpen, setAiOpen] = useState(false);

  if (status === 'loading' || status === 'idle') return <LoadingState rows={5} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  const breach = items.find((b) => b.id === id);
  if (!breach) return <ErrorState error="NOT_FOUND" />;

  const canManage = can(user.role, ACTIONS.MANAGE_BREACHES);
  const remaining = new Date(breach.discoveredAt).getTime() + UODO_WINDOW_MS - now;

  const toggleTask = async (taskId) => {
    const remediation = breach.remediation.map((r) =>
      r.id === taskId ? { ...r, done: !r.done } : r,
    );
    const patch = { remediation };
    // All remediation done → close the breach record.
    if (remediation.every((r) => r.done)) patch.status = 'closed';
    const action = await dispatch(updateBreach({ id: breach.id, patch }));
    if (action.error) toast.error(t('common.notAuthorized'));
  };

  const notifyUodo = async () => {
    const action = await dispatch(markBreachNotified(breach.id));
    if (action.error) toast.error(t('common.notAuthorized'));
    else toast.success('UODO ✓');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={breach.title}>
        <BreachClockBadge breach={breach} now={now} />
        <StatusBadge status={breach.status} />
      </PageHeader>

      <div className="grid gap-4">
        {breach.uodoNotificationRequired && !breach.uodoNotifiedAt && (
          <Card className={remaining <= 0 ? 'border-(--status-risk)/60' : 'border-(--status-warn)/50'}>
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('breach.clock')}</p>
                <p className={`font-mono text-3xl tabular-nums ${remaining <= 0 ? 'text-(--status-risk)' : 'text-(--status-warn)'}`}>
                  {remaining <= 0 ? t('breach.expired') : formatCountdown(remaining)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === 'pl'
                    ? 'Art. 33(1) — zgłoszenie do Prezesa UODO bez zbędnej zwłoki, w miarę możliwości nie później niż 72 h. Zgloszenia: uodo.gov.pl.'
                    : 'Art. 33(1) — notify UODO without undue delay and, where feasible, within 72 hours. Submissions: uodo.gov.pl.'}
                </p>
              </div>
              {canManage && (
                <div className="ml-auto flex flex-wrap gap-2">
                  {aiEnabled && (
                    <Button variant="outline" className="border-primary/40 text-primary" onClick={() => setAiOpen(true)}>
                      <Sparkles /> {t('ai.draftNotification')}
                    </Button>
                  )}
                  <Button onClick={notifyUodo}>
                    <CheckCircle2 /> {lang === 'pl' ? 'Zgłoszono do UODO' : 'Mark notified to UODO'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Art. 33(3)</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="whitespace-pre-wrap text-foreground">{breach.description}</p>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
              <span>{t('breach.discovered')}: {new Date(breach.discoveredAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}</span>
              <span>{lang === 'pl' ? 'Liczba osób' : 'Subjects affected'}: {breach.subjectsCount}</span>
              <span>{lang === 'pl' ? 'Poziom ryzyka' : 'Risk level'}: {breach.riskLevel}</span>
              <span>
                {t('breach.notifySubjects')}: {breach.subjectsNotificationRequired ? t('common.yes') : t('common.no')} (Art. 34)
              </span>
              {breach.uodoNotifiedAt && (
                <span className="text-(--status-ok)">
                  UODO ✓ {new Date(breach.uodoNotifiedAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('breach.riskRationale')} — Art. 33(5)</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{breach.riskRationale}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{lang === 'pl' ? 'Działania naprawcze' : 'Remediation'} — Art. 33(3)(d)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {breach.remediation.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                <input type="checkbox" className="accent-[#c5a059]" checked={r.done}
                  disabled={!canManage} onChange={() => toggleTask(r.id)} />
                <span className={r.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{r.text}</span>
              </label>
            ))}
            {breach.remediation.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
          </CardContent>
        </Card>
      </div>

      <AiDraftDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        title={t('ai.draftNotification')}
        filename={`UODO_notification_draft_${breach.id}.md`}
        generate={async () => {
          const action = await dispatch(aiDraftBreachNotification({ breach, lang }));
          if (action.error) throw new Error(action.error.message);
          return action.payload;
        }}
      />
    </div>
  );
}
