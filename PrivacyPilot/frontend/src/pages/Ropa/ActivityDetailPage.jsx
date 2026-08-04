// Activity detail — the full Art. 30 record with permission-gated actions
// (edit, approve, archive, start DPIA). Archive replaces hard delete.
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Pencil, Archive, CheckCircle2, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../../components/common/PageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ExportMenu from '../../components/common/ExportMenu';
import { LoadingState, ErrorState } from '../../components/common/States';
import { StatusBadge, DpiaVerdictBadge } from '../../components/common/StatusBadge';
import { useSliceData } from '../../hooks/useSliceData';
import {
  fetchActivities, archiveActivity, approveActivity,
} from '../../store/slices/activitiesSlice';
import { createDpiaForActivity, fetchDpias } from '../../store/slices/dpiasSlice';
import { fetchVendors } from '../../store/slices/vendorsSlice';
import { fetchTransfers } from '../../store/slices/transfersSlice';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { buildActivityRecord } from '../../lib/activityRecord';
import { documentFilename } from '../../lib/documentDownload';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { useOrgBase } from '../../lib/paths';
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

// One label/value line. Stacks on narrow screens — a fixed 11rem label column beside the
// value is unreadable on a phone. Same column width as the wizard's review step so the two
// views of the same record line up.
function Row({ label, children }) {
  return (
    <div className="grid gap-0.5 border-b border-border/40 py-1.5 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{children ?? '—'}</span>
    </div>
  );
}

export default function ActivityDetailPage() {
  const { id } = useParams();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const base = useOrgBase();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('activities', fetchActivities);
  const { items: vendors } = useSliceData('vendors', fetchVendors);
  const { items: transfers } = useSliceData('transfers', fetchTransfers);
  const { items: dpias } = useSliceData('dpias', fetchDpias);
  const [confirmArchive, setConfirmArchive] = useState(false);
  // Company + DPO details for the record sheet's letterhead. Fetched here — above the early
  // returns below — because a hook may never sit behind a condition.
  const settings = useSelector((s) => s.settings);
  useEffect(() => {
    if (settings.status === 'idle') dispatch(fetchSettings());
  }, [settings.status, dispatch]);

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
    navigate(`${base}/dpia/${action.payload.id}`);
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
    else navigate(`${base}/register`);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={activity.name}
        subtitle={`${labelOf(DEPARTMENTS, activity.department, lang)} · ${t('ropa.owner')}: ${activity.ownerName}`}
      >
        {/* This one activity as a standalone record sheet. The register CSV is the right
            thing to hand an inspector who asks for the whole register, but a great deal of
            real work happens one activity at a time — the owning department reviews its own
            entry, the DPO attaches a single record to an approval e-mail. Sending a
            twenty-column spreadsheet so someone can read one row of it does not serve that. */}
        <ExportMenu
          target="activity_record"
          entityId={activity.id}
          formats={['word', 'markdown', 'print']}
          size="sm"
          documentTitle={activity.name}
          disabled={!settings.data}
          build={(format) => ({
            filename: documentFilename(
              t('ropa.docKind'), activity.name, null, format === 'word' ? 'doc' : 'md',
            ),
            content: buildActivityRecord({
              activity, settings: settings.data, vendors, transfers, lang, t,
            }),
          })}
        />
        {can(user, ACTIONS.EDIT_ACTIVITY) && (
          <Button variant="outline" onClick={() => navigate(`${base}/register/${activity.id}/edit`)}>
            <Pencil /> {t('common.edit')}
          </Button>
        )}
        {can(user, ACTIONS.APPROVE_ACTIVITY) && activity.status === 'in_review' && (
          <Button onClick={approve} disabled={dpiaBlocksApproval}
            title={dpiaBlocksApproval ? t('dpia.approvalBlocked') : undefined}>
            <CheckCircle2 /> {t('status.approved')}
          </Button>
        )}
        {can(user, ACTIONS.DELETE_ACTIVITY) && activity.status !== 'archived' && (
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
            <Row label={`${t('ropa.controllersServed')} (Art. 30(2)(a))`}>{activity.controllersServed}</Row>
          )}
          {isController && (
            <>
              <Row label={`${t('ropa.lawfulBasis')} (Art. 6(1))`}>
                {activity.lawfulBasis ? `${labelOf(ART6_BASES, activity.lawfulBasis, lang)} (${byId(ART6_BASES, activity.lawfulBasis)?.ref})` : '—'}
              </Row>
              {activity.legitimateInterestDetail && (
                <Row label={`${t('ropa.legitimateInterest')} (Art. 6(1)(f))`}>
                  {activity.legitimateInterestDetail}
                </Row>
              )}
              {activity.art9Condition && (
                <Row label={`${t('ropa.art9Condition')} (Art. 9(2))`}>
                  {labelOf(ART9_CONDITIONS, activity.art9Condition, lang)}
                  {' '}({byId(ART9_CONDITIONS, activity.art9Condition)?.ref})
                </Row>
              )}
            </>
          )}
        </Section>

        <Section title={`${t('ropa.dataAndSubjects')} — Art. 30(1)(c)`}>
          <Row label={t('ropa.dataSubjects')}>
            {activity.dataSubjects?.map((s) => labelOf(DATA_SUBJECT_CATEGORIES, s, lang)).join(', ')}
          </Row>
          <Row label={t('ropa.dataCategories')}>
            {activity.dataCategories?.map((c) => labelOf(DATA_CATEGORIES, c, lang)).join(', ')}
          </Row>
          {activity.art10 && <Row label={`${t('ropa.art10')} (Art. 10)`}>{t('common.yes')}</Row>}
          <Row label={t('ropa.dataSources')}>{activity.dataSources?.join('; ')}</Row>
        </Section>

        <Section title={t('ropa.recipientsAndProcessors')}>
          <Row label={`${t('ropa.recipients')} (Art. 30(1)(d))`}>
            {activity.recipients?.length
              ? activity.recipients.map((r) => labelOf(RECIPIENT_CATEGORIES, r, lang)).join(', ')
              : t('common.none')}
          </Row>
          <Row label={`${t('ropa.processors')} (Art. 28)`}>
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
              // Previously this reused the "TIA missing" wording, which says something else
              // entirely. The problem here is that no transfer record is linked at all.
              <p className="text-(--status-warn)">
                {t('ropa.transferNoneLinked')}{' '}
                <Link className="underline underline-offset-2" to={`${base}/transfers`}>
                  {t('nav.transfers')}
                </Link>
              </p>
            )
          ) : (
            <p className="text-muted-foreground">{t('ropa.eeaOnly')}</p>
          )}
        </Section>

        <Section title={`${t('ropa.retention')} — Art. 30(1)(f)`}>
          <Row label={t('ropa.retention')}>{activity.retentionPeriod}</Row>
          <Row label={t('ropa.retentionBasis')}>{activity.retentionBasis}</Row>
        </Section>

        <Section title={`${t('ropa.toms')} — Art. 32 / Art. 30(1)(g)`}>
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
              <Link to={`${base}/dpia/${activity.dpiaId}`} className="text-sm text-primary underline-offset-2 hover:underline">
                {t('nav.dpia')} →
              </Link>
            ) : (
              activity.dpiaVerdict !== 'not_indicated' && can(user, ACTIONS.MANAGE_DPIA) && (
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
