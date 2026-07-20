// DPIA workspace — implements the Art. 35(7)(a)–(d) minimum contents:
// (a) systematic description, (b) necessity & proportionality,
// (c) risk assessment, (d) mitigation measures — plus DPO advice (35(2)),
// Art. 36 prior-consultation flag, and a role-enforced approval gate
// (the service only lets you sign the slot matching your own role).
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { PenLine, Plus, Trash2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, ErrorState } from '../../components/common/States';
import { StatusBadge } from '../../components/common/StatusBadge';
import { FormField, Input, Select, Textarea } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchDpias, updateDpia, signDpia } from '../../store/slices/dpiasSlice';
import { fetchActivities } from '../../store/slices/activitiesSlice';
import { useT } from '../../i18n';
import { can, hasRole, ROLES, ACTIONS, ROLE_LABELS } from '../../lib/permissions';
import { DPIA_CRITERIA } from '../../lib/dpiaCriteria';
import { labelOf } from '../../lib/gdpr';
import { AiBadge, AiDisclaimer, useAiEnabled } from '../../components/common/AiAssist';
import { aiDraftDpiaSection, aiSuggestRisks } from '../../store/slices/aiSlice';

/**
 * Editable long-text section with an explicit save action.
 * `onAiDraft` (optional): async fn returning draft text — the AI fills the
 * EDITOR, never the record; the human reviews and presses Save.
 */
function EditableSection({ title, value, canEdit, onSave, placeholder, onAiDraft }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [aiUsed, setAiUsed] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  useEffect(() => setDraft(value ?? ''), [value]);

  const aiDraft = async () => {
    setAiLoading(true);
    try {
      const text = await onAiDraft();
      setDraft(text ?? '');
      setEditing(true);
      setAiUsed(true);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {title} {editing && aiUsed && <AiBadge />}
        </CardTitle>
        <div className="flex items-center gap-1">
          {canEdit && onAiDraft && !editing && (
            <Button variant="ghost" size="sm" className="text-primary" onClick={aiDraft} disabled={aiLoading}>
              <Sparkles /> {aiLoading ? t('ai.generating') : t('ai.draftSection')}
            </Button>
          )}
          {canEdit && !editing && (
            <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')} onClick={() => setEditing(true)}>
              <PenLine />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="grid gap-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
            {aiUsed && <AiDisclaimer />}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onSave(draft); setEditing(false); setAiUsed(false); }}>{t('common.save')}</Button>
              <Button size="sm" variant="outline" onClick={() => { setDraft(value ?? ''); setEditing(false); setAiUsed(false); }}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {value || <span className="text-muted-foreground">—</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const riskTone = (score) =>
  score >= 15 ? 'text-(--status-risk)' : score >= 8 ? 'text-(--status-warn)' : 'text-(--status-ok)';

export default function DpiaDetailPage() {
  const { id } = useParams();
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('dpias', fetchDpias);
  const { items: activities } = useSliceData('activities', fetchActivities);
  const [riskDraft, setRiskDraft] = useState(null); // null = closed
  const aiEnabled = useAiEnabled();
  const aiStatus = useSelector((s) => s.ai.status);

  if (status === 'loading' || status === 'idle') return <LoadingState rows={6} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  const dpia = items.find((d) => d.id === id);
  if (!dpia) return <ErrorState error="NOT_FOUND" />;

  const activity = activities.find((a) => a.id === dpia.activityId);
  const canEdit = can(user, ACTIONS.MANAGE_DPIA) && dpia.status !== 'approved';
  // Only the DPO fills in the "DPO advice" — check the actual PrivacyPilot code.
  const isDpo = hasRole(user, ROLES.PRIVACYPILOT_DPO);

  const save = async (patch) => {
    const action = await dispatch(updateDpia({ id: dpia.id, patch }));
    if (action.error) toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('common.error'));
  };

  const addRisk = () => {
    const risk = {
      ...riskDraft,
      id: `r${Date.now()}`,
      likelihood: Number(riskDraft.likelihood),
      severity: Number(riskDraft.severity),
      residualLikelihood: Number(riskDraft.residualLikelihood),
      residualSeverity: Number(riskDraft.residualSeverity),
    };
    save({ risks: [...dpia.risks, risk] });
    setRiskDraft(null);
  };

  const removeRisk = (rid) => save({ risks: dpia.risks.filter((r) => r.id !== rid) });

  // AI helpers — unwrap the thunk so callers get plain text / arrays.
  const aiSection = (section) => async () => {
    const action = await dispatch(aiDraftDpiaSection({ dpia, activity, section }));
    if (action.error) throw new Error(action.error.message);
    return action.payload;
  };

  const aiRisks = async () => {
    const action = await dispatch(aiSuggestRisks(dpia));
    if (action.error) {
      toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('common.error'));
      return;
    }
    // Suggestions land as normal editable/deletable entries — the human curates.
    await save({ risks: [...dpia.risks, ...action.payload] });
    toast.success(t('ai.risksAdded'));
  };

  const sign = async () => {
    const action = await dispatch(signDpia(dpia.id));
    if (action.error) {
      toast.error(
        action.error.message === 'NO_APPROVAL_SLOT'
          ? (lang === 'pl' ? 'Brak slotu podpisu dla Twojej roli.' : 'No approval slot for your role.')
          : t('common.notAuthorized'),
      );
    } else {
      toast.success(t('dpia.sign'));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={dpia.title}
        subtitle={activity && (
          <Link to={`/register/${activity.id}`} className="text-primary underline-offset-2 hover:underline">
            {activity.name}
          </Link>
        )}
      >
        <StatusBadge status={dpia.status} />
      </PageHeader>

      {/* Screening criteria carried over from the wizard */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {dpia.criteriaMatched.map((c) => (
          <Badge key={c} variant="outline" className="border-(--status-warn)/40 text-(--status-warn)">
            {labelOf(DPIA_CRITERIA, c, lang)}
          </Badge>
        ))}
      </div>

      {dpia.priorConsultation && (
        <div className="mb-4 rounded-lg border border-(--status-risk)/40 bg-(--status-risk)/5 p-3 text-sm text-(--status-risk)">
          {t('dpia.priorConsultation')}
        </div>
      )}

      <div className="grid gap-4">
        <EditableSection title={t('dpia.description')} value={dpia.description}
          canEdit={canEdit} onSave={(v) => save({ description: v })}
          onAiDraft={aiEnabled ? aiSection('description') : undefined} />
        <EditableSection title={t('dpia.necessity')} value={dpia.necessity}
          canEdit={canEdit} onSave={(v) => save({ necessity: v })}
          onAiDraft={aiEnabled ? aiSection('necessity') : undefined} />

        {/* Art. 35(7)(c) — risk assessment */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">{t('dpia.riskMatrix')}</CardTitle>
            <div className="flex items-center gap-1">
              {canEdit && aiEnabled && (
                <Button variant="ghost" size="sm" className="text-primary" onClick={aiRisks}
                  disabled={aiStatus === 'loading'}>
                  <Sparkles /> {aiStatus === 'loading' ? t('ai.generating') : t('ai.suggestRisks')}
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setRiskDraft({
                  description: '', likelihood: 3, severity: 3, mitigation: '', residualLikelihood: 2, residualSeverity: 2,
                })}>
                  <Plus /> {lang === 'pl' ? 'Dodaj ryzyko' : 'Add risk'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dpia.risks.map((r) => {
              const score = r.likelihood * r.severity;
              const residual = r.residualLikelihood * r.residualSeverity;
              return (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{r.description}</p>
                    {canEdit && (
                      <Button variant="ghost" size="icon-xs" aria-label={t('common.delete')} onClick={() => removeRisk(r.id)}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.mitigation}</p>
                  <div className="mt-2 flex gap-4 text-xs tabular-nums">
                    <span>
                      {lang === 'pl' ? 'Ryzyko' : 'Risk'}:{' '}
                      <span className={riskTone(score)}>{r.likelihood}×{r.severity} = {score}</span>
                    </span>
                    <span>
                      {lang === 'pl' ? 'Rezydualne' : 'Residual'}:{' '}
                      <span className={riskTone(residual)}>{r.residualLikelihood}×{r.residualSeverity} = {residual}</span>
                    </span>
                  </div>
                </div>
              );
            })}
            {dpia.risks.length === 0 && <p className="text-sm text-muted-foreground">—</p>}

            {riskDraft && (
              <div className="grid gap-3 rounded-lg border border-primary/40 p-3">
                <FormField label={lang === 'pl' ? 'Opis ryzyka' : 'Risk description'} required>
                  {(fid) => <Input id={fid} value={riskDraft.description}
                    onChange={(e) => setRiskDraft({ ...riskDraft, description: e.target.value })} />}
                </FormField>
                <FormField label={lang === 'pl' ? 'Środki zaradcze' : 'Mitigation'}>
                  {(fid) => <Input id={fid} value={riskDraft.mitigation}
                    onChange={(e) => setRiskDraft({ ...riskDraft, mitigation: e.target.value })} />}
                </FormField>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['likelihood', lang === 'pl' ? 'Prawdopod.' : 'Likelihood'],
                    ['severity', lang === 'pl' ? 'Waga' : 'Severity'],
                    ['residualLikelihood', lang === 'pl' ? 'Rezyd. prawd.' : 'Res. likelihood'],
                    ['residualSeverity', lang === 'pl' ? 'Rezyd. waga' : 'Res. severity'],
                  ].map(([key, label]) => (
                    <FormField key={key} label={`${label} (1–5)`}>
                      {(fid) => (
                        <Select id={fid} value={riskDraft[key]}
                          onChange={(e) => setRiskDraft({ ...riskDraft, [key]: e.target.value })}>
                          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                        </Select>
                      )}
                    </FormField>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addRisk} disabled={!riskDraft.description.trim()}>{t('common.save')}</Button>
                  <Button size="sm" variant="outline" onClick={() => setRiskDraft(null)}>{t('common.cancel')}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <EditableSection title={t('dpia.measures')} value={dpia.measures.join('\n')}
          canEdit={canEdit}
          onSave={(v) => save({ measures: v.split('\n').map((s) => s.trim()).filter(Boolean) })}
          placeholder={lang === 'pl' ? 'Jeden środek na linię' : 'One measure per line'}
          onAiDraft={aiEnabled ? aiSection('measures') : undefined} />

        <EditableSection title={t('dpia.dpoAdvice')} value={dpia.dpoAdvice}
          canEdit={isDpo && dpia.status !== 'approved'} onSave={(v) => save({ dpoAdvice: v })} />

        {/* Approval gate — role-enforced in the service layer. */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('dpia.sign')}</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {dpia.approvals.map((a) => (
              <div key={a.role} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                <span className="w-44 text-xs text-muted-foreground">{ROLE_LABELS[a.role]?.[lang] ?? a.role}</span>
                {a.approvedAt ? (
                  <span className="text-(--status-ok)">
                    ✓ {a.name} · {new Date(a.approvedAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                  </span>
                ) : hasRole(user, a.role) && can(user, ACTIONS.SIGN_DPIA) ? (
                  <Button size="sm" onClick={sign}>{t('dpia.sign')}</Button>
                ) : (
                  <span className="text-muted-foreground">{t('status.pending')}</span>
                )}
              </div>
            ))}
            {canEdit && (
              <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="accent-[#c5a059]" checked={dpia.priorConsultation}
                  onChange={(e) => save({ priorConsultation: e.target.checked })} />
                Art. 36 — {lang === 'pl' ? 'wymagane uprzednie konsultacje z UODO' : 'prior consultation with UODO required'}
              </label>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
