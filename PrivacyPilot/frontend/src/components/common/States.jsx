// Loading / empty / error states — actually used on every list page
// (both prototypes shipped these as dead code; here they are wired in).
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useT } from '../../i18n';

export function LoadingState({ rows = 4 }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint, action }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
      <p className="font-display text-sm font-medium text-foreground">{title ?? t('common.emptyTitle')}</p>
      {hint && <p className="max-w-md text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 py-10 text-center">
      <p className="text-sm font-medium text-destructive">{t('common.error')}</p>
      {error && <p className="max-w-md text-xs text-muted-foreground">{String(error)}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>{t('common.retry')}</Button>
      )}
    </div>
  );
}
