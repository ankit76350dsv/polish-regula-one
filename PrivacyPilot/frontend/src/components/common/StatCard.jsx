// KPI tile for the dashboard. `tone` colours the value when it signals state:
// ok (green), warn (amber), risk (red) — neutral by default.
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONES = {
  neutral: 'text-foreground',
  ok: 'text-(--status-ok)',
  warn: 'text-(--status-warn)',
  risk: 'text-(--status-risk)',
  gold: 'text-primary',
};

export default function StatCard({ label, value, hint, tone = 'neutral', icon: Icon }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', TONES[tone])}>{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && <Icon className="size-5 shrink-0 text-primary/70" aria-hidden />}
      </CardContent>
    </Card>
  );
}
