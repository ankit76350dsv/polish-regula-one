// Audit trail — who/what/when with old→new diff, searchable, JSON export.
// Entries include actor role and user agent; written only by the service layer.
import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Download, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { Input, Select } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchAudit } from '../../store/slices/auditSlice';
import { recordExport } from '../../store/slices/exportsSlice';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { buildAuditCsv } from '../../lib/auditCsv';

// Includes the two whole-list kinds an EXPORT line can be about, so exports of the
// register and of the trail itself are filterable here like any other entry.
const ENTITY_TYPES = ['activity', 'dpia', 'vendor', 'transfer', 'breach', 'dsar', 'notice',
  'user', 'settings', 'register', 'audit_trail'];

// Download a CSV. The leading BOM is what makes Excel read it as UTF-8 (Polish characters).
function downloadCsv(filename, content) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function DiffPanel({ label, value, tone }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'old' ? 'border-(--status-risk)/40' : 'border-(--status-ok)/40'}`}>
      <p className={`mb-1 text-xs font-medium ${tone === 'old' ? 'text-(--status-risk)' : 'text-(--status-ok)'}`}>{label}</p>
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground">
        {value == null ? '—' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default function AuditTrailPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('audit', fetchAudit);
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() =>
    items.filter((e) =>
      (entityType === 'all' || e.entityType === entityType) &&
      (!query ||
        e.actorName?.toLowerCase().includes(query.toLowerCase()) ||
        e.entityLabel?.toLowerCase().includes(query.toLowerCase()) ||
        e.action?.toLowerCase().includes(query.toLowerCase()))),
    [items, query, entityType]);

  // Exporting the trail is RECORDED IN THE TRAIL — and that export line is itself
  // append-only, so a copy of the evidence can never be taken silently. If the recording
  // fails the download is abandoned: no evidence, no copy.
  //
  // The recorded line comes back as a receipt, which is written into the file's header
  // block — so the exported evidence names the audit entry that proves who exported it.
  const exportCsv = async () => {
    const filterSummary = [`search=${query || 'none'}`, `entityType=${entityType}`].join('; ');
    const action = await dispatch(recordExport({
      target: 'audit_trail',
      format: 'csv',
      itemCount: filtered.length,
      filterSummary,
    }));
    if (action.error) {
      toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('export.failed'));
      return;
    }
    downloadCsv(
      `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`,
      buildAuditCsv({
        entries: filtered,
        receipt: action.payload,
        filterSummary,
        exportedAt: new Date().toISOString(),
      }),
    );
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={6} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')}>
        {can(user, ACTIONS.EXPORT_DATA) && (
          <Button variant="outline" onClick={exportCsv}><Download /> {t('audit.exportCsv')}</Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)}
          className="w-56" aria-label={t('common.search')} />
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-40"
          aria-label={t('audit.entity')}>
          <option value="all">{t('common.all')}</option>
          {ENTITY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === 'pl' ? 'Czas' : 'Time'}</TableHead>
                <TableHead>{t('audit.actor')}</TableHead>
                <TableHead>{t('audit.action')}</TableHead>
                <TableHead>{t('audit.entity')}</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {new Date(e.at).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground">{e.actorName}</span>
                    <p className="text-xs text-muted-foreground">{e.actorRole}</p>
                  </TableCell>
                  <TableCell><span className="font-mono text-xs text-primary">{e.action}</span></TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    <span className="text-xs">{e.entityType}</span> · {e.entityLabel}
                  </TableCell>
                  <TableCell>
                    {(e.oldValue || e.newValue) && (
                      <Button variant="ghost" size="icon-sm" aria-label={t('audit.diff')} onClick={() => setSelected(e)}>
                        <Eye />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.action} — {selected?.entityLabel}</DialogTitle>
            <DialogDescription>
              {selected && `${selected.actorName} (${selected.actorRole}) · ${new Date(selected.at).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <DiffPanel label={t('audit.oldValue')} value={selected?.oldValue} tone="old" />
            <DiffPanel label={t('audit.newValue')} value={selected?.newValue} tone="new" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
