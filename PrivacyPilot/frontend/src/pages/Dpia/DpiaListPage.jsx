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

export default function DpiaListPage() {
  const base = useOrgBase();
  const { t } = useT();
  const { items, status, error, refetch } = useSliceData('dpias', fetchDpias);
  const { items: activities } = useSliceData('activities', fetchActivities);

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('dpia.title')} subtitle={t('dpia.subtitle')} />

      {items.length === 0 ? (
        // An explicit title, or EmptyState falls back to the generic "Nothing here yet" and
        // the hint repeats the same fact underneath it.
        <EmptyState title={t('dpia.emptyTitle')} hint={t('dpia.empty')} />
      ) : (
        <div className="grid gap-3">
          {items.map((d) => {
            const activity = activities.find((a) => a.id === d.activityId);
            const signed = d.approvals.filter((a) => a.approvedAt).length;
            return (
              <Card key={d.id}>
                {/* No padding override — the card's own px-4/py-4 keeps every card in the
                    app inset identically. */}
                <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`${base}/dpia/${d.id}`} className="font-medium text-foreground hover:text-primary">
                      {d.title}
                    </Link>
                    {/* The activity is the context a reader needs here. The matched criteria
                        used to be listed in full and then truncated mid-sentence; the COUNT is
                        the part that carries meaning (two or more criteria is what makes an
                        assessment mandatory), and the full list is on the assessment itself. */}
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {activity ? `${activity.name} · ` : ''}
                      {t('dpia.criteriaCount').replace('{count}', d.criteriaMatched.length)}
                    </p>
                  </div>
                  {d.priorConsultation && (
                    // "Art. 36" alone is shorthand only a specialist reads; the title spells
                    // it out for everyone else and for screen readers.
                    <Badge
                      variant="outline"
                      title={t('dpia.art36')}
                      className="border-(--status-risk)/50 text-(--status-risk)"
                    >
                      Art. 36
                    </Badge>
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t('dpia.signedCount')
                      .replace('{signed}', signed)
                      .replace('{total}', d.approvals.length)}
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
