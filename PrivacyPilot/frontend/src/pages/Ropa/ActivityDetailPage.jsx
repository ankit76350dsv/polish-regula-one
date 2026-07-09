// Activity detail — the full Art. 30 record with permission-gated actions
// (edit, approve, archive, start DPIA). Archive replaces hard delete.
import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Pencil, Archive, CheckCircle2, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../../components/common/PageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/common/States';
import { StatusBadge, DpiaVerdictBadge } from '../../components/common/StatusBadge';
import { useSliceData } from '../../hooks/useSliceData';
import {
  fetchActivities, archiveActivity, approveActivity,
} from '../../store/slices/activitiesSlice';
import { createDpiaForActivity, fetchDpias } from '../../store/slices/dpiasSlice';
import { fetchVendors } from '../../store/slices/vendorsSlice';
import { fetchTransfers } from '../../store/slices/transfersSlice';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { activityCompleteness } from '../../lib/completeness';
import {
  ART6_BASES, ART9_CONDITIONS, DATA_CATEGORIES, DATA_SUBJECT_CATEGORIES,
  RECIPIENT_CATEGORIES, TOMS, TRANSFER_MECHANISMS, DEPARTMENTS, labelOf, byId,
} from '../../lib/gdpr';
import { DPIA_CRITERIA } from '../../lib/dpiaCriteria';

function Section({ title, children }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm text-foreground">{children}</CardContent>
    </Card>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{children ?? '—'}</span>
    </div>
  );
}

export default function ActivityDetailPage() {
  const { id } = useParams();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('activities', fetchActivities);
  const { items: vendors } = useSliceData('vendors', fetchVendors);
  const { items: transfers } = useSliceData('transfers', fetchTransfers);
  const { items: dpias } = useSliceData('dpias', fetchDpias);
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (status === 'loading' || status === 'idle') return <LoadingState rows={6} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  const activity = items.find((a) => a.id === id);
  if (!activity) return <ErrorState error="NOT_FOUND" />;

  const isController = activity.role !== 'processor';
  const pct = activityCompleteness(activity);

  // Art. 35(1): a DPIA must be carried out BEFORE processing where it is required.
  // So an activity screened as "DPIA required" cannot be approved until its linked
  // DPIA exists and has been approved. This enforces the order the law requires,
  // instead of letting the register show "approved" but non-compliant activities.
  const linkedDpia = activity.dpiaId ? dpias.find((d) => d.id === activity.dpiaId) : null;
  const dpiaBlocksApproval =
    activity.dpiaVerdict === 'required' && linkedDpia?.status !== 'approved';

  const startDpia = async () => {
    const action = await dispatch(createDpiaForActivity(activity.id));
    if (action.error) {
      toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('common.error'));
      return;
    }
    dispatch(fetchActivities());
    navigate(`/dpia/${action.payload.id}`);
  };

  const approve = async () => {
    // Block approval when a required DPIA is not yet approved (Art. 35(1)).
    if (dpiaBlocksApproval) {
      toast.error(t('dpia.approvalBlocked'));
      return;
    }
    const action = await dispatch(approveActivity(activity.id));
    if (action.error) toast.error(t('common.notAuthorized'));
    else toast.success(t('status.approved'));
  };

  const archive = async () => {
    const action = await dispatch(archiveActivity(activity.id));
    if (action.error) toast.error(t('common.notAuthorized'));
    else navigate('/register');
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={activity.name} subtitle={`${labelOf(DEPARTMENTS, activity.department, lang)} · ${activity.ownerName}`}>
        {can(user.role, ACTIONS.EDIT_ACTIVITY) && (
          <Button variant="outline" onClick={() => navigate(`/register/${activity.id}/edit`)}>
            <Pencil /> {t('common.edit')}
          </Button>
        )}
        {can(user.role, ACTIONS.APPROVE_ACTIVITY) && activity.status === 'in_review' && (
          <Button onClick={approve} disabled={dpiaBlocksApproval}
            title={dpiaBlocksApproval ? t('dpia.approvalBlocked') : undefined}>
            <CheckCircle2 /> {t('status.approved')}
          </Button>
        )}
        {can(user.role, ACTIONS.DELETE_ACTIVITY) && activity.status !== 'archived' && (
          <Button variant="destructive" onClick={() => setConfirmArchive(true)}>
            <Archive /> {t('status.archived')}
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={activity.status} />
        <DpiaVerdictBadge verdict={activity.dpiaVerdict} />
        <span className="text-xs text-muted-foreground">
          {t('ropa.completeness')}: <span className={pct === 100 ? 'text-(--status-ok)' : 'text-(--status-warn)'}>{pct}%</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {t('common.updated')}: {new Date(activity.updatedAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
        </span>
      </div>

      <div className="grid gap-4">
        <Section title={`${t('ropa.purpose')} — Art. 30(1)(b)`}>
          <p>{activity.purpose}</p>
          {activity.role === 'processor' && (
            <Row label="Art. 30(2)(a)">{activity.controllersServed}</Row>
          )}
          {isController && (
            <>
              <Row label={`${t('ropa.lawfulBasis')} (Art. 6)`}>
                {activity.lawfulBasis ? `${labelOf(ART6_BASES, activity.lawfulBasis, lang)} (${byId(ART6_BASES, activity.lawfulBasis)?.ref})` : '—'}
              </Row>
              {activity.legitimateInterestDetail && (
                <Row label="Art. 6(1)(f)">{activity.legitimateInterestDetail}</Row>
              )}
              {activity.art9Condition && (
                <Row label="Art. 9(2)">
                  {byId(ART9_CONDITIONS, activity.art9Condition)?.ref} — {labelOf(ART9_CONDITIONS, activity.art9Condition, lang)}
                </Row>
              )}
              {activity.art10 && <Row label="Art. 10">{t('common.yes')}</Row>}
            </>
          )}
        </Section>

        <Section title={`${lang === 'pl' ? 'Dane i osoby' : 'Data & subjects'} — Art. 30(1)(c)`}>
          <Row label={lang === 'pl' ? 'Kategorie osób' : 'Data subjects'}>
            {activity.dataSubjects?.map((s) => labelOf(DATA_SUBJECT_CATEGORIES, s, lang)).join(', ')}
          </Row>
          <Row label={lang === 'pl' ? 'Kategorie danych' : 'Data categories'}>
            {activity.dataCategories?.map((c) => labelOf(DATA_CATEGORIES, c, lang)).join(', ')}
          </Row>
          <Row label={lang === 'pl' ? 'Źródła' : 'Sources'}>
            {activity.dataSources?.join('; ')}
          </Row>
        </Section>

        <Section title={`${lang === 'pl' ? 'Odbiorcy i podmioty przetwarzające' : 'Recipients & processors'} — Art. 30(1)(d) / Art. 28`}>
          <Row label="Art. 30(1)(d)">
            {activity.recipients?.length
              ? activity.recipients.map((r) => labelOf(RECIPIENT_CATEGORIES, r, lang)).join(', ')
              : t('common.none')}
          </Row>
          <Row label="Art. 28">
            {activity.vendorIds?.length
              ? activity.vendorIds.map((vid) => vendors.find((v) => v.id === vid)?.name ?? vid).join(', ')
              : t('common.none')}
          </Row>
        </Section>

        <Section title={`${t('transfers.title')} — Art. 30(1)(e)`}>
          {activity.transfer ? (
            activity.transferIds?.length ? (
              activity.transferIds.map((tid) => {
                const tr = transfers.find((x) => x.id === tid);
                if (!tr) return null;
                return (
                  <Row key={tid} label={tr.destinationCountry}>
                    {tr.recipient} — {labelOf(TRANSFER_MECHANISMS, tr.mechanism, lang)}
                    {!tr.tiaDocumented && tr.mechanism !== 'adequacy' && (
                      <span className="ml-2 text-xs text-(--status-warn)">{t('transfers.tiaMissing')}</span>
                    )}
                  </Row>
                );
              })
            ) : (
              <p className="text-(--status-warn)">{t('transfers.tiaMissing')} — <Link className="underline" to="/transfers">{t('nav.transfers')}</Link></p>
            )
          ) : (
            <p className="text-muted-foreground">{t('common.no')} — EEA only</p>
          )}
        </Section>

        <Section title={`${t('ropa.retention')} — Art. 30(1)(f)`}>
          <Row label={t('ropa.retention')}>{activity.retentionPeriod}</Row>
          <Row label={lang === 'pl' ? 'Podstawa' : 'Basis'}>{activity.retentionBasis}</Row>
        </Section>

        <Section title={`TOMs — Art. 32 / Art. 30(1)(g)`}>
          <ul className="grid list-disc gap-1 pl-4 sm:grid-cols-2">
            {activity.toms?.map((tm) => <li key={tm}>{labelOf(TOMS, tm, lang)}</li>)}
          </ul>
        </Section>

        <Section title={`${t('dpia.screening')} — Art. 35 / M.P. 2019 poz. 666`}>
          {activity.dpiaCriteria?.length ? (
            <ul className="grid list-disc gap-1 pl-4">
              {activity.dpiaCriteria.map((c) => (
                <li key={c}>{labelOf(DPIA_CRITERIA, c, lang)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t('common.none')}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <DpiaVerdictBadge verdict={activity.dpiaVerdict} />
            {activity.dpiaId ? (
              <Link to={`/dpia/${activity.dpiaId}`} className="text-sm text-primary underline-offset-2 hover:underline">
                {t('nav.dpia')} →
              </Link>
            ) : (
              activity.dpiaVerdict !== 'not_indicated' && can(user.role, ACTIONS.MANAGE_DPIA) && (
                <Button size="sm" variant="outline" onClick={startDpia}>
                  <ShieldAlert /> {t('dpia.newFromActivity')}
                </Button>
              )
            )}
          </div>
          {dpiaBlocksApproval && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-(--status-warn)/40 bg-(--status-warn)/5 p-2 text-xs text-(--status-warn)">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t('dpia.approvalBlocked')}
            </p>
          )}
        </Section>
      </div>

      <ConfirmDialog
        open={confirmArchive} onOpenChange={setConfirmArchive}
        title={t('status.archived')} description={t('common.confirmDelete')}
        confirmLabel={t('status.archived')} onConfirm={archive}
      />
    </div>
  );
}
