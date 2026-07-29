// DPIA Center — all assessments with their Art. 35 lifecycle state.
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchDpias } from '../../store/slices/dpiasSlice';
import { fetchActivities } from '../../store/slices/activitiesSlice';
import { useT } from '../../i18n';
import { useOrgBase } from '../../lib/paths';
import { DPIA_CRITERIA } from '../../lib/dpiaCriteria';
import { labelOf } from '../../lib/gdpr';

export default function DpiaListPage() {
  const base = useOrgBase();
  const { t, lang } = useT();
  const { items, status, error, refetch } = useSliceData('dpias', fetchDpias);
  const { items: activities } = useSliceData('activities', fetchActivities);

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('dpia.title')} subtitle={t('dpia.subtitle')} />

      {items.length === 0 ? (
        <EmptyState hint={t('dpia.empty')} />
      ) : (
        <div className="grid gap-3">
          {items.map((d) => {
            const activity = activities.find((a) => a.id === d.activityId);
            const signed = d.approvals.filter((a) => a.approvedAt).length;
            return (
              <Card key={d.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <Link to={`${base}/dpia/${d.id}`} className="font-medium text-foreground hover:text-primary">
                      {d.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {activity ? `${activity.name} · ` : ''}
                      {d.criteriaMatched.map((c) => labelOf(DPIA_CRITERIA, c, lang)).join(' · ')}
                    </p>
                  </div>
                  {d.priorConsultation && (
                    <Badge variant="outline" className="border-(--status-risk)/50 text-(--status-risk)">Art. 36</Badge>
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {signed}/{d.approvals.length} ✓
                  </span>
                  <StatusBadge status={d.status} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
