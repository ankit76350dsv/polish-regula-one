// Compliance dashboard — every number comes from the real dashboard API
// (GET /api/privacypilot/dashboard). The server does the counting and the legal-clock
// maths (72h breach window, DSAR due dates) once, authoritatively; this page only paints.
// No hardcoded "compliance scores" or grades: factual counts and deadlines only.
import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { BookOpenCheck, ShieldAlert, Siren, Inbox } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { LoadingState, ErrorState } from '../../components/common/States';
import { fetchDashboard } from '../../store/slices/dashboardSlice';
import { useT } from '../../i18n';
import { useOrgBase } from '../../lib/paths';
import { ART6_BASES, DEPARTMENTS, labelOf } from '../../lib/gdpr';

// Single-series charts: identity is carried by row/column labels, so one brand
// hue is correct (categorical palette rules don't apply to a lone series).
const GOLD = '#c5a059';
const GRID = '#2a2a2c';
const LABEL = '#9a9aa0';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-2 font-medium tabular-nums text-foreground">{payload[0].value}</span>
    </div>
  );
}

// Turn one structured attention item from the server into the line of text to show.
// Kept on the client so it can be Polish or English; the server only sends the facts
// (type, label, daysLeft).
function attentionText(item, t) {
  switch (item.type) {
    case 'BREACH_72H': return `${item.label} — ${t('breach.clock')}`;
    case 'DSAR_URGENT': return `DSAR ${item.label}: ${item.daysLeft} ${t('common.daysLeft')}`;
    case 'DPIA_REQUIRED': return `${item.label} — ${t('dpia.verdict.required')}`;
    case 'PRIOR_CONSULTATION': return `${item.label} — Art. 36`;
    case 'VENDOR_DPA_MISSING': return `${item.label} — ${t('vendors.dpa.missing')}`;
    default: return item.label;
  }
}

export default function DashboardPage() {
  const base = useOrgBase();
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const { data, status, error } = useSelector((s) => s.dashboard);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchDashboard());
  }, [status, dispatch]);

  // Map the server's category CODES to translated chart labels.
  const byDepartment = useMemo(() => (data?.byDepartment ?? []).map((g) => ({
    name: labelOf(DEPARTMENTS, g.key, lang), count: g.count,
  })), [data, lang]);
  const byBasis = useMemo(() => (data?.byBasis ?? []).map((g) => ({
    name: labelOf(ART6_BASES, g.key, lang), count: g.count,
  })), [data, lang]);

  if (status === 'loading' || status === 'idle' || !data) return <LoadingState rows={6} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={() => dispatch(fetchDashboard())} />;

  const c = data.counts;
  const attention = data.attention ?? [];
  const recentAudit = data.recentAudit ?? [];

  return (
    <div>
      <PageHeader title={t('dash.title')} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BookOpenCheck} label={t('dash.ropaCount')} value={c.ropaActive}
          hint={t('dash.ropaHint')} tone="neutral" />
        <StatCard icon={ShieldAlert} label={t('dash.dpiaOpen')} value={c.dpiaInProgress}
          hint={`${t('dash.dpiaRequired')}: ${c.dpiaRequired}`}
          tone={c.dpiaRequired > 0 ? 'warn' : 'neutral'} />
        <StatCard icon={Siren} label={t('dash.breachOpen')} value={c.breachesOpen}
          hint={`${c.breachesWithin72h} ${t('dash.breach72h')}`}
          tone={c.breachesWithin72h > 0 ? 'risk' : 'neutral'} />
        <StatCard icon={Inbox} label={t('dash.dsarOpen')} value={c.dsarsOpen}
          hint={`${c.dsarsUrgent} ${t('dash.dsarUrgent')}`}
          tone={c.dsarsUrgent > 0 ? 'warn' : 'neutral'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('dash.byDepartment')}</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDepartment} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: LABEL, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: LABEL, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(197,160,89,0.08)' }} />
                <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{t('dash.byBasis')}</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBasis} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: LABEL, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fill: LABEL, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(197,160,89,0.08)' }} />
                <Bar dataKey="count" fill={GOLD} radius={[0, 4, 4, 0]} maxBarSize={20}>
                  <LabelList dataKey="count" position="right" fill={LABEL} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('dash.attention')}</CardTitle></CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dash.noAttention')}</p>
            ) : (
              <ul className="grid gap-1.5">
                {attention.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <Link to={`${base}${item.to}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                      <span aria-hidden className={
                        item.tone === 'RISK'
                          ? 'size-1.5 rounded-full bg-(--status-risk)'
                          : 'size-1.5 rounded-full bg-(--status-warn)'
                      } />
                      <span className="text-foreground">{attentionText(item, t)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{t('dash.recentAudit')}</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {recentAudit.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-2 text-xs">
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {new Date(entry.at).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span className="text-foreground">
                    <span className="text-primary">{entry.actorName}</span> · {entry.action} · {entry.entityLabel}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
