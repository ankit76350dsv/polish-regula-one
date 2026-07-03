// Privacy Notice Generator — per-audience Art. 13/14 documents compiled from
// live register data. Generation is BLOCKED until the completeness checklist
// passes; the missing items are listed with where to fix them.
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Check, X, Download, Printer, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import PageHeader from '../../components/common/PageHeader';
import { Select, FormField } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchNotices, fetchChecklist, generateNotice } from '../../store/slices/noticesSlice';
import { useT } from '../../i18n';
import { NOTICE_AUDIENCES, NOTICE_REQUIRED_ITEMS, byId } from '../../lib/gdpr';

function download(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function printContent(title, markdown) {
  // Simple print view: browser's print-to-PDF is the export path in the mock.
  const win = window.open('', '_blank');
  win.document.write(`<!doctype html><title>${title}</title>
    <pre style="font-family: Georgia, serif; white-space: pre-wrap; max-width: 48rem; margin: 2rem auto;">${
      markdown.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    }</pre>`);
  win.document.close();
  win.print();
}

export default function NoticesPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const { items } = useSliceData('notices', fetchNotices);
  const { checklists, saveStatus } = useSelector((s) => s.notices);

  const [audience, setAudience] = useState('employees');
  const [docLang, setDocLang] = useState('pl');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    dispatch(fetchChecklist(audience));
  }, [audience, dispatch]);

  const check = checklists[audience];
  const history = useMemo(
    () => items.filter((n) => n.audience === audience).sort((a, b) => b.version - a.version),
    [items, audience],
  );
  const selected = history.find((n) => n.id === selectedId) ?? history[0];

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
                          ? <Check className="mt-0.5 size-3.5 shrink-0 text-(--status-ok)" aria-label="OK" />
                          : <X className="mt-0.5 size-3.5 shrink-0 text-(--status-risk)" aria-label="Missing" />}
                        <span>
                          <span className={item.ok ? 'text-foreground' : 'text-(--status-risk)'}>
                            {meta?.[lang] ?? item.id}
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
            <CardContent className="grid gap-3 p-4">
              <FormField label={t('notices.language')}>
                {(fid) => (
                  <Select id={fid} value={docLang} onChange={(e) => setDocLang(e.target.value)}>
                    <option value="pl">Polski</option>
                    <option value="en">English</option>
                  </Select>
                )}
              </FormField>
              <Button onClick={generate} disabled={!check || check.blocked || saveStatus === 'saving'}>
                <FileText /> {t('notices.generate')}
              </Button>
              {check?.blocked && (
                <p className="text-xs text-(--status-risk)">{t('notices.blocked')}</p>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">v{history[0]?.version ?? 1}</CardTitle></CardHeader>
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
            <CardTitle className="text-sm">{selected?.title ?? '—'}</CardTitle>
            {selected?.content && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => download(`${selected.audience}_notice_v${selected.version}.md`, selected.content)}>
                  <Download /> {t('notices.download')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => printContent(selected.title, selected.content)}>
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
              <p className="text-sm text-muted-foreground">{t('common.emptyTitle')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
