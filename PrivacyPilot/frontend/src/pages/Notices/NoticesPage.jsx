// Privacy Notice Generator — per-audience Art. 13/14 documents compiled from live register
// data. Generation is BLOCKED until the completeness checklist passes, so a notice can never
// claim something the register cannot back up.
//
// The finished document can leave as Word (what a DPO finalises in), as raw Markdown, or via
// the print dialog for a PDF — all three through lib/documentDownload.js, and all three
// recorded in the audit trail first (GDPR Art. 5(2)).
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Check, X, Download, Printer, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import PageHeader from '../../components/common/PageHeader';
import DraftsDisclaimer from '../../components/common/DraftsDisclaimer';
import { Select, FormField } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchNotices, fetchChecklist, generateNotice } from '../../store/slices/noticesSlice';
// The notice TEXT is compiled on the client, so the page makes sure everything it is built
// from — activities, company/DPO settings, transfers and processors — is loaded before
// "Generate" runs. See noticesSlice.generateNotice.
import { fetchActivities } from '../../store/slices/activitiesSlice';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { fetchTransfers } from '../../store/slices/transfersSlice';
import { fetchVendors } from '../../store/slices/vendorsSlice';
import { recordExport } from '../../store/slices/exportsSlice';
import { useT } from '../../i18n';
import { NOTICE_AUDIENCES, NOTICE_REQUIRED_ITEMS, byId, labelOf } from '../../lib/gdpr';
import {
  documentFilename, downloadMarkdown, downloadWord, printDocument,
} from '../../lib/documentDownload';

export default function NoticesPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const { items } = useSliceData('notices', fetchNotices);
  const { checklists, saveStatus } = useSelector((s) => s.notices);
  // Slices whose data the client-side notice builder needs (loaded below).
  const settings = useSelector((s) => s.settings);
  const activities = useSelector((s) => s.activities);
  const transfers = useSelector((s) => s.transfers);
  const vendors = useSelector((s) => s.vendors);

  const [audience, setAudience] = useState('employees');
  const [docLang, setDocLang] = useState('pl');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    dispatch(fetchChecklist(audience));
  }, [audience, dispatch]);

  // Make sure everything the notice text is built from is loaded (once each).
  useEffect(() => {
    if (activities.status === 'idle') dispatch(fetchActivities());
    if (settings.status === 'idle') dispatch(fetchSettings());
    if (transfers.status === 'idle') dispatch(fetchTransfers());
    if (vendors.status === 'idle') dispatch(fetchVendors());
  }, [dispatch, activities.status, settings.status, transfers.status, vendors.status]);

  // Generate needs the company/DPO settings to compile the notice text.
  const settingsReady = Boolean(settings.data);

  const check = checklists[audience];
  const history = useMemo(
    () => items.filter((n) => n.audience === audience).sort((a, b) => b.version - a.version),
    [items, audience],
  );
  const selected = history.find((n) => n.id === selectedId) ?? history[0];

  /**
   * Download or print the selected notice — RECORDED FIRST.
   * A notice is the document people are actually shown, so who took a copy of which
   * version is part of the accountability record (GDPR Art. 5(2)). If the recording
   * fails we do not hand over the document: no evidence, no copy.
   */
  const exportNotice = async (format) => {
    if (!selected?.content) return;
    const action = await dispatch(recordExport({
      target: 'privacy_notice',
      format,
      entityId: selected.id,
    }));
    if (action.error) {
      toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('export.failed'));
      return;
    }
    // A readable name: "Klauzula-informacyjna-Pracownicy-v3.docx-ish" rather than
    // "employees_notice_v3.md" — the audience is spelled out, not its stored code.
    const audienceLabel = labelOf(NOTICE_AUDIENCES, selected.audience, lang);
    const name = (ext) => documentFilename(t('notices.docKind'), audienceLabel, selected.version, ext);

    if (format === 'print') printDocument(selected.title, selected.content);
    else if (format === 'word') downloadWord(name('doc'), selected.title, selected.content);
    else downloadMarkdown(name('md'), selected.content);
  };

  const generate = async () => {
    const action = await dispatch(generateNotice({ audienceId: audience, language: docLang }));
    if (action.error) {
      toast.error(t('notices.blocked'));
    } else {
      toast.success(t('notices.generate'));
      setSelectedId(action.payload.id);
      dispatch(fetchChecklist(audience));
    }
  };

  return (
    <div>
      <PageHeader title={t('notices.title')} subtitle={t('notices.subtitle')} />

      {/* This screen produces a document that real people will be shown, so the
          "have it reviewed first" note belongs here. */}
      <DraftsDisclaimer className="mb-4" />

      {/* Audience picker */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {NOTICE_AUDIENCES.map((aud) => (
          <button key={aud.id} type="button" aria-pressed={audience === aud.id}
            onClick={() => { setAudience(aud.id); setSelectedId(null); }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs',
              audience === aud.id
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}>
            {aud[lang]} <span className="opacity-60">· Art. {aud.art}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {/* Checklist + generate */}
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('notices.checklist')}</CardTitle></CardHeader>
            <CardContent>
              {!check ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : (
                <ul className="grid gap-1.5">
                  {check.checklist.map((item) => {
                    const meta = byId(NOTICE_REQUIRED_ITEMS, item.id);
                    return (
                      <li key={item.id} className="flex items-start gap-2 text-xs">
                        {item.ok
                          ? <Check className="mt-0.5 size-3.5 shrink-0 text-(--status-ok)" aria-label={t('notices.checklistOk')} />
                          : <X className="mt-0.5 size-3.5 shrink-0 text-(--status-risk)" aria-label={t('notices.checklistMissing')} />}
                        <span>
                          {/* Fall back to the article reference, never to the stored id —
                              "provision_requirement" is not something to show a user. */}
                          <span className={item.ok ? 'text-foreground' : 'text-(--status-risk)'}>
                            {meta?.[lang] ?? item.ref ?? item.id}
                          </span>
                          <span className="ml-1 text-muted-foreground">({item.ref})</span>
                          {!item.ok && item.details && (
                            <span className="block text-muted-foreground">{item.details}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3">
              <FormField label={t('notices.language')}>
                {(fid) => (
                  <Select id={fid} value={docLang} onChange={(e) => setDocLang(e.target.value)}>
                    <option value="pl">Polski</option>
                    <option value="en">English</option>
                  </Select>
                )}
              </FormField>
              <Button onClick={generate}
                disabled={!check || check.blocked || !settingsReady || saveStatus === 'saving'}>
                <FileText /> {t('notices.generate')}
              </Button>
              {check?.blocked && (
                <p className="text-xs text-(--status-risk)">{t('notices.blockedShort')}</p>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('notices.versions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1">
                  {history.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => setSelectedId(n.id)}
                        className={cn(
                          'w-full rounded-md px-2 py-1 text-left text-xs hover:bg-accent',
                          selected?.id === n.id && 'bg-accent text-accent-foreground',
                        )}>
                        v{n.version} · {n.language.toUpperCase()} ·{' '}
                        {new Date(n.generatedAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')} · {n.generatedBy}
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">{selected?.title ?? t('notices.preview')}</CardTitle>
            {selected?.content && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportNotice('word')}>
                  <Download /> Word
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportNotice('markdown')}>
                  <Download /> Markdown
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportNotice('print')}>
                  <Printer /> {t('notices.print')}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {selected?.content ? (
              <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {selected.content}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">{t('notices.previewEmpty')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
