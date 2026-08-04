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
import { downloadCsv } from '../../lib/csv';
import { auditActionLabel, auditChangeRows, auditEntityLabel } from '../../lib/auditLabels';

// Includes the two whole-list kinds an EXPORT line can be about, so exports of the
// register and of the trail itself are filterable here like any other entry.
const ENTITY_TYPES = ['activity', 'dpia', 'vendor', 'transfer', 'breach', 'dsar', 'notice',
  'user', 'settings', 'register', 'audit_trail'];

/**
 * What changed, one row per field: the field's name, then its value before and after.
 *
 * This used to be two blocks of `JSON.stringify` in a monospace font — the raw stored maps,
 * braces and quotes included — leaving the reader to compare them by eye. An auditor's
 * question is "what did this value used to be?", which is a per-field question.
 */
function ChangeList({ entry, lang, t }) {
  const rows = auditChangeRows(entry, lang, t);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('audit.noChanges')}</p>;
  }
  // A create or an export has no "before" at all, so pairing every value with an empty
  // "Before —" column would be noise. Those entries list their values plainly.
  const hasBefore = Boolean(entry.oldValue);
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.field} className="grid gap-1 rounded-lg border p-3 sm:grid-cols-[11rem_1fr]">
          <span className="text-xs text-muted-foreground">{row.label}</span>
          {hasBefore ? (
            <div className="grid gap-1 text-sm sm:grid-cols-2 sm:gap-3">
              <span className="text-(--status-risk)">
                <span className="mr-1.5 text-[11px] text-muted-foreground">{t('audit.before')}</span>
                {row.before ?? '—'}
              </span>
              <span className="text-(--status-ok)">
                <span className="mr-1.5 text-[11px] text-muted-foreground">{t('audit.after')}</span>
                {row.after ?? '—'}
              </span>
            </div>
          ) : (
            <span className="text-sm text-foreground">{row.after ?? '—'}</span>
          )}
        </div>
      ))}
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
  //
  // This screen keeps its own export flow rather than using the shared ExportMenu: it needs
  // the audit RECEIPT to write it into the file itself, and it warns when the export could
  // not hold every matching row. The order is the same — build, record, and only then hand
  // the file over.
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
          // The language and the translator are passed in so the file's headings, action
          // names and changed-field labels are the SAME words the screen shows.
          lang,
          t,
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
          {ENTITY_TYPES.map((et) => (
            <option key={et} value={et}>{auditEntityLabel(et, t)}</option>
          ))}
        </Select>
        {/* The total says how many entries match across the WHOLE trail, not just this page. */}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {t('audit.matchCount').replace('{count}', page.totalElements)}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={t('audit.emptyTitle')}
          hint={query || entityType !== 'all' ? t('audit.empty') : t('audit.emptyNoFilter')}
        />
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
                  <TableCell className="text-primary">{auditActionLabel(e.action, t)}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground"
                    title={`${auditEntityLabel(e.entityType, t)} · ${e.entityLabel ?? ''}`}>
                    <span className="text-xs">{auditEntityLabel(e.entityType, t)}</span>
                    {e.entityLabel ? ` · ${e.entityLabel}` : ''}
                  </TableCell>
                  <TableCell>
                    {(e.oldValue || e.newValue) && (
                      <Button variant="ghost" size="icon-sm" aria-label={t('audit.viewChanges')}
                        title={t('audit.viewChanges')} onClick={() => setSelected(e)}>
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
            <DialogTitle>
              {selected && auditActionLabel(selected.action, t)}
              {selected?.entityLabel ? ` — ${selected.entityLabel}` : ''}
            </DialogTitle>
            <DialogDescription>
              {selected && [
                selected.actorName,
                selected.actorRole,
                new Date(selected.at).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB'),
              ].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>
          {selected && <ChangeList entry={selected} lang={lang} t={t} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
