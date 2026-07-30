// Audit trail — who/what/when with old→new diff, searchable, CSV export.
//
// The trail is append-only and kept for ten years, so it is read ONE PAGE at a time and the
// SERVER does the filtering, ordering and paging (see auditSlice). That is also what makes
// search correct: it runs across the whole trail rather than over one batch loaded in the
// browser. Entries include actor role and user agent; they are written only by the service
// layer, never from here.
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, ChevronRight, Download, Eye } from 'lucide-react';
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
import {
  fetchAudit, fetchAuditForExport, selectAuditPage, AUDIT_PAGE_SIZE, AUDIT_EXPORT_MAX,
} from '../../store/slices/auditSlice';
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
  const { items, status, error } = useSelector((s) => s.audit);
  const page = useSelector(selectAuditPage);

  // What the user typed / picked. These are purely local UI values; the RESULTS live in
  // Redux. `search` is what the box shows, `query` is the debounced value actually sent —
  // without that split, every keystroke would be a request.
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [pageNumber, setPageNumber] = useState(0);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Wait until the typing stops (300 ms) before searching the server.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Changing a filter must start again from the first page — page 4 of the old result has
  // nothing to do with the new one.
  useEffect(() => {
    setPageNumber(0);
  }, [query, entityType]);

  // The SERVER does the filtering, ordering and paging. One request per page/filter change.
  useEffect(() => {
    dispatch(fetchAudit({ page: pageNumber, size: AUDIT_PAGE_SIZE, q: query, entityType }));
  }, [dispatch, pageNumber, query, entityType]);

  const reload = () =>
    dispatch(fetchAudit({ page: pageNumber, size: AUDIT_PAGE_SIZE, q: query, entityType }));

  // Exporting the trail is RECORDED IN THE TRAIL — and that export line is itself
  // append-only, so a copy of the evidence can never be taken silently. If the recording
  // fails the download is abandoned: no evidence, no copy.
  //
  // The file must hold the WHOLE filtered result, not just the page on screen, so the rows
  // are fetched separately as one large page. The recorded line comes back as a receipt and
  // goes into the file's header block, so the evidence names the entry proving who took it.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const filterSummary = [
        `search=${query || 'none'}`,
        `entityType=${entityType}`,
        `maxRows=${AUDIT_EXPORT_MAX}`,
      ].join('; ');

      const rows = await dispatch(fetchAuditForExport({ q: query, entityType }));
      if (rows.error) {
        toast.error(t('common.error'));
        return;
      }
      const entries = rows.payload?.items ?? [];
      const total = rows.payload?.totalElements ?? entries.length;

      const action = await dispatch(recordExport({
        target: 'audit_trail',
        format: 'csv',
        itemCount: entries.length,
        filterSummary,
      }));
      if (action.error) {
        toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('export.failed'));
        return;
      }
      downloadCsv(
        `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`,
        buildAuditCsv({
          entries,
          receipt: action.payload,
          filterSummary,
          exportedAt: new Date().toISOString(),
        }),
      );
      // Be honest when the export could not hold everything that matched.
      if (total > entries.length) {
        toast.warning(t('audit.exportTruncated')
          .replace('{shown}', entries.length)
          .replace('{total}', total));
      }
    } finally {
      setExporting(false);
    }
  };

  // Only block the whole screen on the FIRST load; later page changes keep the table
  // visible so the pager does not jump around under the cursor.
  if (status === 'idle' || (status === 'loading' && items.length === 0)) {
    return <LoadingState rows={6} />;
  }
  if (status === 'failed') return <ErrorState error={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')}>
        {can(user, ACTIONS.EXPORT_DATA) && (
          <Button variant="outline" onClick={exportCsv} disabled={exporting}>
            <Download /> {t('audit.exportCsv')}
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-56" aria-label={t('common.search')} />
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-40"
          aria-label={t('audit.entity')}>
          <option value="all">{t('common.all')}</option>
          {ENTITY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
        </Select>
        {/* The total says how many entries match across the WHOLE trail, not just this page. */}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {t('audit.matchCount').replace('{count}', page.totalElements)}
        </span>
      </div>

      {items.length === 0 ? (
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
              {items.map((e) => (
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

      {/* Pager. Only shown when there is more than one page — a single page needs no
          controls. The buttons rely on the server's hasNext/hasPrevious rather than doing
          arithmetic here, so they can never offer a page that does not exist. */}
      {page.totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('audit.pagination')}>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t('audit.pageOf')
              .replace('{page}', page.number + 1)
              .replace('{total}', page.totalPages)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageNumber((n) => Math.max(0, n - 1))}
              disabled={!page.hasPrevious || status === 'loading'}
            >
              <ChevronLeft /> {t('audit.previousPage')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageNumber((n) => n + 1)}
              disabled={!page.hasNext || status === 'loading'}
            >
              {t('audit.nextPage')} <ChevronRight />
            </Button>
          </div>
        </nav>
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
