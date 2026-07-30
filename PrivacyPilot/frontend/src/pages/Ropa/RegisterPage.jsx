// ROPA register — controller (Art. 30(1)) and processor (Art. 30(2)) tabs.
//
// The CSV export is a real download of every Art. 30 field, built in lib/registerCsv.js so
// the document format is testable on its own. It is written FOR THE READER (a DPO, a lawyer,
// an auditor, UODO): translated labels rather than codes, article references in the headings,
// local date format, and the delimiter that language's Excel expects.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Plus, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { StatusBadge, DpiaVerdictBadge } from '../../components/common/StatusBadge';
import { Input } from '../../components/common/Field';
import { Select } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchActivities } from '../../store/slices/activitiesSlice';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { recordExport } from '../../store/slices/exportsSlice';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { useOrgBase } from '../../lib/paths';
import { activityCompleteness } from '../../lib/completeness';
import { buildRegisterCsv, registerCsvFilename } from '../../lib/registerCsv';
import { ART6_BASES, DEPARTMENTS, labelOf } from '../../lib/gdpr';

function download(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function RegisterPage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const base = useOrgBase();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('activities', fetchActivities);
  const settings = useSelector((s) => s.settings);

  useEffect(() => {
    if (settings.status === 'idle') dispatch(fetchSettings());
  }, [settings.status, dispatch]);

  const [tab, setTab] = useState('controller');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [basis, setBasis] = useState('all');

  const filtered = useMemo(() =>
    items.filter((a) =>
      a.role === tab &&
      a.status !== 'archived' &&
      (department === 'all' || a.department === department) &&
      (basis === 'all' || a.lawfulBasis === basis) &&
      (!query || a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.purpose?.toLowerCase().includes(query.toLowerCase()))),
    [items, tab, query, department, basis]);

  // Export the register — but RECORD it first. The register is the single biggest pile of
  // personal data in the app, so taking a copy must leave an EXPORT line in the audit trail
  // (GDPR Art. 5(2)). If the recording fails we do NOT hand over the file: no evidence,
  // no copy. The filter summary tells a later auditor which slice of the register left.
  const exportCsv = async () => {
    if (!settings.data) return;
    const action = await dispatch(recordExport({
      target: tab === 'processor' ? 'register_processor' : 'register_controller',
      format: 'csv',
      itemCount: filtered.length,
      filterSummary: [
        `search=${query || 'none'}`,
        `department=${department}`,
        `basis=${basis}`,
      ].join('; '),
    }));
    if (action.error) {
      toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('export.failed'));
      return;
    }
    download(
      registerCsvFilename(tab, lang),
      buildRegisterCsv({
        settings: settings.data,
        activities: filtered,
        lang,
        tab,
        // The translator is passed in so the file's status / DPIA / yes-no wording comes from
        // the SAME dictionary the screen uses and the two can never drift apart.
        t,
        exportedAt: new Date().toISOString(),
      }),
    );
  };

  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      {/* The subtitle used to be a hardcoded Polish string, so in Polish the page printed
          its own title twice in a row, and in English it printed an untranslated Polish
          line. It is now translated like every other page's, and says something the title
          does not: what this register is FOR. */}
      <PageHeader title={t('ropa.title')} subtitle={t('ropa.subtitle')}>
        {can(user, ACTIONS.EXPORT_DATA) && (
          <Button variant="outline" onClick={exportCsv} disabled={!settings.data}>
            <Download /> {t('ropa.exportCsv')}
          </Button>
        )}
        {can(user, ACTIONS.CREATE_ACTIVITY) && (
          <Button onClick={() => navigate(`${base}/register/new`)}>
            <Plus /> {t('ropa.newActivity')}
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="controller">{t('ropa.controllerTab')}</TabsTrigger>
            <TabsTrigger value="processor">{t('ropa.processorTab')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex flex-wrap gap-2">
          <Input
            placeholder={t('common.search')} value={query}
            onChange={(e) => setQuery(e.target.value)} className="w-48"
            aria-label={t('common.search')}
          />
          <Select value={department} onChange={(e) => setDepartment(e.target.value)}
            aria-label={t('common.department')} className="w-40">
            <option value="all">{t('common.all')}</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d[lang]}</option>)}
          </Select>
          <Select value={basis} onChange={(e) => setBasis(e.target.value)}
            aria-label={t('ropa.lawfulBasis')} className="w-48">
            <option value="all">{t('common.all')}</option>
            {ART6_BASES.map((b) => <option key={b.id} value={b.id}>{b[lang]}</option>)}
          </Select>
          {/* How many rows the filters are showing — the same line, in the same style, as
              the audit trail screen, so the two list pages read alike. It is also the
              number the CSV export will contain. */}
          <span className="self-center text-xs text-muted-foreground" aria-live="polite">
            {t('ropa.matchCount').replace('{count}', filtered.length)}
          </span>
        </div>
      </div>

      {status === 'loading' || status === 'idle' ? (
        <LoadingState rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          // Without an explicit title this fell back to the generic "Nothing here yet",
          // and the hint then said "No processing activities recorded yet" as well — the
          // same fact three times over. Title states the fact; hint gives the obligation.
          title={t('ropa.emptyTitle')}
          hint={t('ropa.empty')}
          action={can(user, ACTIONS.CREATE_ACTIVITY) && (
            <Button size="sm" onClick={() => navigate(`${base}/register/new`)}>
              <Plus /> {t('ropa.newActivity')}
            </Button>
          )}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ropa.name')}</TableHead>
                <TableHead>{t('common.department')}</TableHead>
                <TableHead>{t('ropa.lawfulBasis')}</TableHead>
                <TableHead>{t('ropa.retention')}</TableHead>
                <TableHead>{t('ropa.dpia')}</TableHead>
                <TableHead className="text-right">{t('ropa.completeness')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const pct = activityCompleteness(a);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link to={`${base}/register/${a.id}`} className="font-medium text-foreground hover:text-primary">
                        {a.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{labelOf(DEPARTMENTS, a.department, lang)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.role === 'processor'
                        ? '—'
                        : a.lawfulBasis ? labelOf(ART6_BASES, a.lawfulBasis, lang) : '—'}
                    </TableCell>
                    <TableCell className="max-w-44 truncate text-muted-foreground">{a.retentionPeriod || '—'}</TableCell>
                    <TableCell><DpiaVerdictBadge verdict={a.dpiaVerdict} /></TableCell>
                    <TableCell className="text-right">
                      <span className={
                        pct === 100 ? 'tabular-nums text-(--status-ok)'
                        : pct >= 70 ? 'tabular-nums text-foreground'
                        : 'tabular-nums text-(--status-warn)'
                      }>
                        {pct}%
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
