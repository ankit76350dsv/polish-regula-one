// ROPA register — controller (Art. 30(1)) and processor (Art. 30(2)) tabs.
// The CSV export is a REAL download containing every Art. 30 field plus the
// controller/DPO header block (the linkage Frontend A lost entirely).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Plus, Download } from 'lucide-react';

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
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { activityCompleteness } from '../../lib/completeness';
import {
  ART6_BASES, DEPARTMENTS, DATA_CATEGORIES, DATA_SUBJECT_CATEGORIES,
  RECIPIENT_CATEGORIES, TOMS, labelOf,
} from '../../lib/gdpr';

/** Build the full Art. 30 CSV, prefixed with the controller + DPO identity block. */
function buildRegisterCsv({ settings, activities, lang }) {
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [];
  // Art. 30(1)(a): controller + DPO identity on the register itself.
  lines.push(`${esc('Administrator / Controller')},${esc(settings.company.name)}`);
  lines.push(`${esc('Adres / Address')},${esc(settings.company.address)}`);
  lines.push(`${esc('NIP')},${esc(settings.company.nip)},${esc('REGON')},${esc(settings.company.regon)}`);
  lines.push(`${esc('IOD / DPO')},${esc(`${settings.dpo.name}, ${settings.dpo.email}, ${settings.dpo.phone}`)}`);
  lines.push('');
  const headers = [
    'ID', 'Name', 'Role', 'Department', 'Status', 'Purpose', 'Lawful basis (Art. 6)',
    'Art. 9(2) condition', 'Art. 10', 'Data subjects', 'Data categories', 'Recipients',
    'Third-country transfer', 'Retention', 'Retention basis', 'Security measures (Art. 32)',
    'DPIA verdict', 'Updated',
  ];
  lines.push(headers.map(esc).join(','));
  for (const a of activities) {
    lines.push([
      a.id, a.name, a.role, labelOf(DEPARTMENTS, a.department, lang), a.status, a.purpose,
      a.lawfulBasis ? `${labelOf(ART6_BASES, a.lawfulBasis, lang)}` : '',
      a.art9Condition ? `Art. 9(2)(${a.art9Condition})` : '',
      a.art10 ? 'yes' : 'no',
      (a.dataSubjects ?? []).map((s) => labelOf(DATA_SUBJECT_CATEGORIES, s, lang)).join('; '),
      (a.dataCategories ?? []).map((c) => labelOf(DATA_CATEGORIES, c, lang)).join('; '),
      (a.recipients ?? []).map((r) => labelOf(RECIPIENT_CATEGORIES, r, lang)).join('; '),
      a.transfer ? 'yes' : 'no',
      a.retentionPeriod, a.retentionBasis,
      (a.toms ?? []).map((tm) => labelOf(TOMS, tm, lang)).join('; '),
      a.dpiaVerdict, a.updatedAt,
    ].map(esc).join(','));
  }
  return lines.join('\r\n');
}

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

  const exportCsv = () => {
    if (!settings.data) return;
    download(
      `ROPA_${tab}_${new Date().toISOString().slice(0, 10)}.csv`,
      buildRegisterCsv({ settings: settings.data, activities: filtered, lang }),
    );
  };

  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('ropa.title')} subtitle="Rejestr Czynności Przetwarzania — Art. 30 RODO">
        {can(user.role, ACTIONS.EXPORT_DATA) && (
          <Button variant="outline" onClick={exportCsv} disabled={!settings.data}>
            <Download /> {t('ropa.exportCsv')}
          </Button>
        )}
        {can(user.role, ACTIONS.CREATE_ACTIVITY) && (
          <Button onClick={() => navigate('/register/new')}>
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
        </div>
      </div>

      {status === 'loading' || status === 'idle' ? (
        <LoadingState rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          hint={t('ropa.empty')}
          action={can(user.role, ACTIONS.CREATE_ACTIVITY) && (
            <Button size="sm" onClick={() => navigate('/register/new')}>
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
                      <Link to={`/register/${a.id}`} className="font-medium text-foreground hover:text-primary">
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
