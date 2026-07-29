// Status + verdict badges. Colour AND text together (never colour alone —
// accessibility), tuned for the dark theme via the status tokens.
import { Badge } from '@/components/ui/badge';
import { useT } from '../../i18n';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  draft: 'border-border text-muted-foreground',
  in_review: 'border-(--status-info)/50 text-(--status-info)',
  approved: 'border-(--status-ok)/50 text-(--status-ok)',
  archived: 'border-border text-muted-foreground line-through',
  open: 'border-(--status-warn)/50 text-(--status-warn)',
  in_progress: 'border-(--status-info)/50 text-(--status-info)',
  completed: 'border-(--status-ok)/50 text-(--status-ok)',
  closed: 'border-(--status-ok)/50 text-(--status-ok)',
  refused: 'border-(--status-risk)/50 text-(--status-risk)',
  pending: 'border-border text-muted-foreground',
};

export function StatusBadge({ status }) {
  const { t } = useT();
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_STYLES[status] ?? '')}>
      {t(`status.${status}`)}
    </Badge>
  );
}

const VERDICT_STYLES = {
  required: 'border-(--status-risk)/50 text-(--status-risk)',
  recommended: 'border-(--status-warn)/50 text-(--status-warn)',
  not_indicated: 'border-border text-muted-foreground',
};

export function DpiaVerdictBadge({ verdict }) {
  const { t } = useT();
  if (!verdict) return null;
  return (
    <Badge variant="outline" className={cn('font-medium', VERDICT_STYLES[verdict] ?? '')}>
      {t(`dpia.verdict.${verdict}`)}
    </Badge>
  );
}

/** Deadline chip: red when overdue, amber under 7 days, neutral otherwise. */
export function DeadlineBadge({ daysLeft, overdueLabel, daysLabel }) {
  const cls =
    daysLeft < 0 ? 'border-(--status-risk)/50 text-(--status-risk)'
    : daysLeft <= 7 ? 'border-(--status-warn)/50 text-(--status-warn)'
    : 'border-(--status-ok)/50 text-(--status-ok)';
  return (
    <Badge variant="outline" className={cn('font-medium tabular-nums', cls)}>
      {daysLeft < 0 ? `${overdueLabel} (${Math.abs(daysLeft)}d)` : `${daysLeft} ${daysLabel}`}
    </Badge>
  );
}
