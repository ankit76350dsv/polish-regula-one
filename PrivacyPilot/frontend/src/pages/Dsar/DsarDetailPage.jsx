// DSAR workspace — identity verification (proportionate, human-confirmed),
// collection tasks, and the Art. 12(3) extension with a mandatory reason.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { CalendarPlus, CheckCircle2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, ErrorState } from '../../components/common/States';
import { StatusBadge, DeadlineBadge } from '../../components/common/StatusBadge';
import { FormField, Input, Textarea } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchDsars, updateDsar, extendDsar, completeDsar } from '../../store/slices/dsarsSlice';
import { dsarDaysLeft } from '../../services/dsarService';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { DSAR_TYPES, labelOf, byId } from '../../lib/gdpr';
import { AiDraftDialog, useAiEnabled } from '../../components/common/AiAssist';
import { aiDraftDsarReply } from '../../store/slices/aiSlice';

export default function DsarDetailPage() {
  const { id } = useParams();
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('dsars', fetchDsars);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendReason, setExtendReason] = useState('');
  const [identityMethod, setIdentityMethod] = useState('');
  const aiEnabled = useAiEnabled();
  const [aiOpen, setAiOpen] = useState(false);

  if (status === 'loading' || status === 'idle') return <LoadingState rows={5} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  const dsar = items.find((r) => r.id === id);
  if (!dsar) return <ErrorState error="NOT_FOUND" />;

  const canManage = can(user.role, ACTIONS.MANAGE_DSAR);
  const days = dsarDaysLeft(dsar);
  const open = dsar.status !== 'completed';
  const allTasksDone = dsar.tasks.length > 0 && dsar.tasks.every((task) => task.done);

  const patch = async (p) => {
    const action = await dispatch(updateDsar({ id: dsar.id, patch: p }));
    if (action.error) toast.error(t('common.notAuthorized'));
  };

  const toggleTask = (taskId) =>
    patch({ tasks: dsar.tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task) });

  const verifyIdentity = () =>
    patch({ identityVerified: true, identityMethod });

  const extend = async () => {
    const action = await dispatch(extendDsar({ id: dsar.id, reason: extendReason }));
    if (action.error) toast.error(t('common.notAuthorized'));
    else { toast.success(t('dsar.extended')); setExtendOpen(false); }
  };

  const complete = async () => {
    const action = await dispatch(completeDsar(dsar.id));
    if (action.error) toast.error(t('common.notAuthorized'));
    else toast.success(t('status.completed'));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${labelOf(DSAR_TYPES, dsar.type, lang)} — ${dsar.requesterName}`}
        subtitle={`${byId(DSAR_TYPES, dsar.type)?.ref} · ${dsar.requesterEmail} · ${dsar.relation}`}
      >
        {open && <DeadlineBadge daysLeft={days} overdueLabel={t('common.overdue')} daysLabel={t('common.daysLeft')} />}
        <StatusBadge status={dsar.status} />
      </PageHeader>

      <div className="grid gap-4">
        {/* Deadline card */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('common.deadline')} — Art. 12(3)</p>
              <p className="font-display text-xl text-foreground">
                {new Date(dsar.dueAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
              </p>
              {dsar.extended && (
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  Art. 12(3) +2m — {dsar.extensionReason}
                </p>
              )}
            </div>
            {canManage && open && (
              <div className="ml-auto flex flex-wrap gap-2">
                {aiEnabled && (
                  <Button variant="outline" className="border-primary/40 text-primary" onClick={() => setAiOpen(true)}>
                    <Sparkles /> {t('ai.draftReply')}
                  </Button>
                )}
                {!dsar.extended && (
                  <Button variant="outline" onClick={() => setExtendOpen(true)}>
                    <CalendarPlus /> {t('dsar.extend')}
                  </Button>
                )}
                <Button onClick={complete} disabled={!dsar.identityVerified || !allTasksDone}>
                  <CheckCircle2 /> {t('dsar.complete')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Identity verification — proportionate, never automatic */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('dsar.identity')}</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-xs text-muted-foreground">{t('dsar.identityHint')}</p>
            {dsar.identityVerified ? (
              <p className="text-sm text-(--status-ok)">✓ {dsar.identityMethod}</p>
            ) : canManage && open ? (
              <div className="grid gap-2">
                <FormField label={lang === 'pl' ? 'Sposób weryfikacji' : 'Verification method'} required>
                  {(fid) => <Input id={fid} value={identityMethod} onChange={(e) => setIdentityMethod(e.target.value)}
                    placeholder={lang === 'pl' ? 'np. odpowiedź z adresu e-mail w aktach' : 'e.g. reply from the e-mail address on file'} />}
                </FormField>
                <Button size="sm" className="justify-self-start" onClick={verifyIdentity} disabled={!identityMethod.trim()}>
                  {t('common.save')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-(--status-warn)">{t('status.pending')}</p>
            )}
          </CardContent>
        </Card>

        {/* Collection tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{lang === 'pl' ? 'Zadania zbierania danych' : 'Collection tasks'}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {dsar.tasks.map((task) => (
              <label key={task.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                <input type="checkbox" className="accent-[#c5a059]" checked={task.done}
                  disabled={!canManage || !open} onChange={() => toggleTask(task.id)} />
                <span className={task.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{task.text}</span>
              </label>
            ))}
            {dsar.tasks.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            {dsar.notes && <p className="mt-2 text-xs text-muted-foreground">{dsar.notes}</p>}
          </CardContent>
        </Card>
      </div>

      <AiDraftDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        title={t('ai.draftReply')}
        filename={`DSAR_reply_draft_${dsar.id}.md`}
        generate={async () => {
          const action = await dispatch(aiDraftDsarReply({ dsar, lang }));
          if (action.error) throw new Error(action.error.message);
          return action.payload;
        }}
      />

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dsar.extend')}</DialogTitle>
            <DialogDescription>{t('dsar.extended')}</DialogDescription>
          </DialogHeader>
          <FormField label={lang === 'pl' ? 'Uzasadnienie (złożoność / liczba wniosków)' : 'Justification (complexity / number of requests)'} required>
            {(fid) => <Textarea id={fid} value={extendReason} onChange={(e) => setExtendReason(e.target.value)} />}
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={extend} disabled={!extendReason.trim()}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
