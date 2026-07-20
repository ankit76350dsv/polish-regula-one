// Compliance dashboard — every number is computed from live register data.
// No hardcoded "compliance scores" or grades: factual counts and deadlines only.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { BookOpenCheck, ShieldAlert, Siren, Inbox } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { LoadingState } from '../../components/common/States';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchActivities } from '../../store/slices/activitiesSlice';
import { fetchDpias } from '../../store/slices/dpiasSlice';
import { fetchBreaches } from '../../store/slices/breachesSlice';
import { fetchDsars } from '../../store/slices/dsarsSlice';
import { fetchVendors } from '../../store/slices/vendorsSlice';
import { fetchAudit } from '../../store/slices/auditSlice';
import { useT } from '../../i18n';
import { useOrgBase } from '../../lib/paths';
import { activityCompleteness } from '../../lib/completeness';
import { breachClock } from '../../services/breachService';
import { dsarDaysLeft } from '../../services/dsarService';
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

export default function DashboardPage() {
  const base = useOrgBase();
  const { t, lang } = useT();
  const activities = useSliceData('activities', fetchActivities);
  const dpias = useSliceData('dpias', fetchDpias);
  const breaches = useSliceData('breaches', fetchBreaches);
  const dsars = useSliceData('dsars', fetchDsars);
  const vendors = useSliceData('vendors', fetchVendors);
  const audit = useSliceData('audit', fetchAudit);

  const loading = [activities, dpias, breaches, dsars].some((s) => s.status === 'loading' || s.status === 'idle');

  const stats = useMemo(() => {
    const active = activities.items.filter((a) => a.status !== 'archived');
    const avgCompleteness = active.length
      ? Math.round(active.reduce((sum, a) => sum + activityCompleteness(a), 0) / active.length)
      : 0;
    const openBreaches = breaches.items.filter((b) => b.status === 'open');
    const in72h = openBreaches.filter((b) => {
      const clock = breachClock(b);
      return clock.applicable && !clock.notified && !clock.expired;
    });
    const openDsars = dsars.items.filter((r) => r.status !== 'completed');
    const urgentDsars = openDsars.filter((r) => dsarDaysLeft(r) <= 7);
    return {
      active,
      avgCompleteness,
      dpiaInProgress: dpias.items.filter((d) => d.status === 'in_progress').length,
      dpiaRequired: active.filter((a) => a.dpiaVerdict === 'required' && !a.dpiaId).length,
      openBreaches,
      in72h,
      openDsars,
      urgentDsars,
    };
  }, [activities.items, dpias.items, breaches.items, dsars.items]);

  const byDepartment = useMemo(() => {
    const counts = {};
    for (const a of stats.active) counts[a.department] = (counts[a.department] ?? 0) + 1;
    return Object.entries(counts).map(([dep, count]) => ({
      name: labelOf(DEPARTMENTS, dep, lang),
      count,
    }));
  }, [stats.active, lang]);

  const byBasis = useMemo(() => {
    const counts = {};
    for (const a of stats.active) {
      if (!a.lawfulBasis) continue;
      counts[a.lawfulBasis] = (counts[a.lawfulBasis] ?? 0) + 1;
    }
    return Object.entries(counts).map(([basis, count]) => ({
      name: labelOf(ART6_BASES, basis, lang),
      count,
    }));
  }, [stats.active, lang]);

  // Items genuinely needing action, each linking to where it's fixed.
  const attention = useMemo(() => {
    const list = [];
    for (const b of stats.in72h) {
      list.push({ to: `/breaches/${b.id}`, tone: 'risk', text: `${b.title} — ${t('breach.clock')}` });
    }
    for (const r of stats.urgentDsars) {
      const d = dsarDaysLeft(r);
      list.push({ to: `/dsar/${r.id}`, tone: d < 0 ? 'risk' : 'warn', text: `DSAR ${r.requesterName}: ${d} ${t('common.daysLeft')}` });
    }
    for (const a of stats.active.filter((x) => x.dpiaVerdict === 'required' && !x.dpiaId)) {
      list.push({ to: `/register/${a.id}`, tone: 'warn', text: `${a.name} — ${t('dpia.verdict.required')}` });
    }
    for (const d of dpias.items.filter((x) => x.priorConsultation && x.status !== 'approved')) {
      list.push({ to: `/dpia/${d.id}`, tone: 'risk', text: `${d.title} — Art. 36` });
    }
    for (const v of vendors.items.filter((x) => x.dpaStatus === 'missing')) {
      list.push({ to: '/vendors', tone: 'warn', text: `${v.name} — ${t('vendors.dpa.missing')}` });
    }
    return list;
  }, [stats, dpias.items, vendors.items, t]);

  if (loading) return <LoadingState rows={6} />;

  return (
    <div>
      <PageHeader title={t('dash.title')} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BookOpenCheck} label={t('dash.ropaCount')} value={stats.active.length}
          hint={`${t('dash.ropaComplete')}: ${stats.avgCompleteness}%`} tone="gold" />
        <StatCard icon={ShieldAlert} label={t('dash.dpiaOpen')} value={stats.dpiaInProgress}
          hint={`${t('dash.dpiaRequired')}: ${stats.dpiaRequired}`}
          tone={stats.dpiaRequired > 0 ? 'warn' : 'neutral'} />
        <StatCard icon={Siren} label={t('dash.breachOpen')} value={stats.openBreaches.length}
          hint={`${stats.in72h.length} ${t('dash.breach72h')}`}
          tone={stats.in72h.length > 0 ? 'risk' : 'neutral'} />
        <StatCard icon={Inbox} label={t('dash.dsarOpen')} value={stats.openDsars.length}
          hint={`${stats.urgentDsars.length} ${t('dash.dsarUrgent')}`}
          tone={stats.urgentDsars.length > 0 ? 'warn' : 'neutral'} />
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
                {attention.map((item, i) => (
                  <li key={i}>
                    <Link to={`${base}${item.to}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                      <span aria-hidden className={
                        item.tone === 'risk'
                          ? 'size-1.5 rounded-full bg-(--status-risk)'
                          : 'size-1.5 rounded-full bg-(--status-warn)'
                      } />
                      <span className="text-foreground">{item.text}</span>
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
              {audit.items.slice(0, 6).map((entry) => (
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
