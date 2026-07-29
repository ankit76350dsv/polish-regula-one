// Breach workspace — live 72h clock, remediation checklist, risk rationale,
// the "notified UODO" action that timestamps the submission, a ready-to-submit
// UODO report (Art. 33(3)) you can export, and the UODO case reference.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { CheckCircle2, Sparkles, Plus, Users, FileText, Copy, Download, Printer, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, ErrorState } from '../../components/common/States';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Input } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { useNow, formatCountdown } from '../../hooks/useNow';
import {
  fetchBreaches, updateBreach, markBreachNotified, markBreachSubjectsNotified,
} from '../../store/slices/breachesSlice';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { recordExport } from '../../store/slices/exportsSlice';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { UODO_WINDOW_MS } from '../../services/breachService';
import { DATA_CATEGORIES, labelOf } from '../../lib/gdpr';
import { buildBreachReport } from '../../lib/breachReport';
import { BreachClockBadge } from './BreachesPage';
import { AiDraftDialog, useAiEnabled } from '../../components/common/AiAssist';
import { aiDraftBreachNotification } from '../../store/slices/aiSlice';

// A reminder fires once the 72h window is inside this much time (or already gone).
const REMIND_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours

// ── Export helpers (browser downloads / print) ───────────────────────────────
function escapeHtml(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
// A .doc that Microsoft Word opens: HTML wrapped and served as msword.
function downloadWord(filename, title, content) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>`
    + `<body><pre style="font-family: Georgia, serif; white-space: pre-wrap; font-size: 12pt;">${escapeHtml(content)}</pre></body></html>`;
  downloadBlob(filename, html, 'application/msword');
}
function printDoc(title, content) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><title>${escapeHtml(title)}</title>`
    + `<pre style="font-family: Georgia, serif; white-space: pre-wrap; max-width: 46rem; margin: 2rem auto;">${escapeHtml(content)}</pre>`);
  win.document.close();
  win.print();
}

export default function BreachDetailPage() {
  const { id } = useParams();
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('breaches', fetchBreaches);
  const settings = useSelector((s) => s.settings);
  const now = useNow(1000);
  const aiEnabled = useAiEnabled();
  const [aiOpen, setAiOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [reference, setReference] = useState('');
  const remindedFor = useRef(null); // breach id we've already reminded about

  const breach = items.find((b) => b.id === id);

  // Load the company/DPO settings the report needs.
  useEffect(() => {
    if (settings.status === 'idle') dispatch(fetchSettings());
  }, [settings.status, dispatch]);

  // Keep the reference input in step with the loaded breach.
  useEffect(() => {
    if (breach) setReference(breach.uodoReference ?? '');
  }, [breach?.id, breach?.uodoReference]);

  // Near-deadline reminder: once per breach, when the UODO clock is nearly up (or
  // already elapsed) and UODO has not been notified. (Email/push reminders would come
  // from the RegulaOne notification service — this is the in-app nudge.)
  useEffect(() => {
    if (!breach || remindedFor.current === breach.id) return;
    if (!breach.uodoNotificationRequired || breach.uodoNotifiedAt) return;
    const remainingMs = new Date(breach.discoveredAt).getTime() + UODO_WINDOW_MS - Date.now();
    if (remainingMs <= REMIND_THRESHOLD_MS) {
      remindedFor.current = breach.id;
      const msg = remainingMs <= 0
        ? (lang === 'pl' ? 'Minęło 72 h — zgłoś naruszenie do UODO i podaj przyczynę opóźnienia.' : '72h window elapsed — notify UODO now and state the reason for delay.')
        : (lang === 'pl' ? `Zostało mniej niż ${Math.ceil(remainingMs / 3600000)} h na zgłoszenie do UODO.` : `Less than ${Math.ceil(remainingMs / 3600000)}h left to notify UODO.`);
      toast.warning(msg, { duration: 8000 });
    }
  }, [breach?.id, breach?.uodoNotificationRequired, breach?.uodoNotifiedAt, breach?.discoveredAt, lang]);

  if (status === 'loading' || status === 'idle') return <LoadingState rows={5} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;
  if (!breach) return <ErrorState error="NOT_FOUND" />;

  const canManage = can(user, ACTIONS.MANAGE_BREACHES);
  const remaining = new Date(breach.discoveredAt).getTime() + UODO_WINDOW_MS - now;

  // A breach may only be CLOSED once every legal obligation is discharged: all
  // remediation done AND (if required) UODO notified AND (if required) the data
  // subjects communicated with.
  const uodoDone = !breach.uodoNotificationRequired || Boolean(breach.uodoNotifiedAt);
  const subjectsDone = !breach.subjectsNotificationRequired || Boolean(breach.subjectsNotifiedAt);

  // The ready-to-submit report, freshly built from the breach + current settings.
  const report = buildBreachReport({ breach, settings: settings.data, lang });
  const reportFilename = `UODO_breach_report_${breach.id}`;

  const applyRemediation = async (remediation) => {
    const patch = { remediation };
    if (remediation.length > 0 && remediation.every((r) => r.done) && uodoDone && subjectsDone) {
      patch.status = 'closed';
    } else if (breach.status === 'closed') {
      patch.status = 'open'; // reopened if an obligation becomes outstanding again
    }
    const action = await dispatch(updateBreach({ id: breach.id, patch }));
    if (action.error) toast.error(t('common.notAuthorized'));
  };

  const toggleTask = (taskId) =>
    applyRemediation(breach.remediation.map((r) =>
      r.id === taskId ? { ...r, done: !r.done } : r));

  const addRemediation = async () => {
    if (!newTask.trim()) return;
    await applyRemediation([
      ...breach.remediation,
      { id: `rem-${breach.remediation.length}-${new Date(breach.updatedAt).getTime()}-${newTask.length}`, text: newTask.trim(), done: false },
    ]);
    setNewTask('');
  };

  const notifyUodo = async () => {
    const action = await dispatch(markBreachNotified(breach.id));
    if (action.error) toast.error(t('common.notAuthorized'));
    else toast.success('UODO ✓');
  };

  const notifySubjects = async () => {
    const action = await dispatch(markBreachSubjectsNotified(breach.id));
    if (action.error) toast.error(t('common.notAuthorized'));
    else toast.success(t('breach.subjectsNotified'));
  };

  const saveReference = async () => {
    const value = reference.trim();
    if (value === (breach.uodoReference ?? '')) return;
    const action = await dispatch(updateBreach({ id: breach.id, patch: { uodoReference: value } }));
    if (action.error) toast.error(t('common.notAuthorized'));
    else toast.success(t('common.save'));
  };

  /**
   * Record that the UODO report is leaving the app, and only then hand it over.
   *
   * Copying counts as an export here — pasting into the official form on biznes.gov.pl is
   * in fact the MAIN way this document leaves — so every route (copy, Markdown, Word,
   * print) is recorded (GDPR Art. 5(2)). Returns true when the caller may proceed.
   */
  const recordReportExport = async (format) => {
    const action = await dispatch(recordExport({
      target: 'breach_report',
      format,
      entityId: breach.id,
    }));
    if (action.error) {
      toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('export.failed'));
      return false;
    }
    return true;
  };

  const copyReport = async () => {
    if (!(await recordReportExport('clipboard'))) return;
    try {
      await navigator.clipboard.writeText(report);
      toast.success(t('ai.copied'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={breach.title}>
        <BreachClockBadge breach={breach} now={now} />
        <StatusBadge status={breach.status} />
        {/* The ready-to-submit UODO report is available at any time (before or after
            notifying) — for submission and for the file. */}
        <Button variant="outline" onClick={() => setReportOpen(true)}>
          <FileText /> {lang === 'pl' ? 'Raport UODO' : 'UODO report'}
        </Button>
      </PageHeader>

      <div className="grid gap-4">
        {breach.uodoNotificationRequired && !breach.uodoNotifiedAt && (
          <Card className={remaining <= 0 ? 'border-(--status-risk)/60' : 'border-(--status-warn)/50'}>
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('breach.clock')}</p>
                <p className={`font-mono text-3xl tabular-nums ${remaining <= 0 ? 'text-(--status-risk)' : 'text-(--status-warn)'}`}>
                  {remaining <= 0 ? t('breach.expired') : formatCountdown(remaining)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === 'pl'
                    ? 'Art. 33(1) — zgłoszenie do Prezesa UODO bez zbędnej zwłoki, w miarę możliwości nie później niż 72 h. Zgloszenia: uodo.gov.pl.'
                    : 'Art. 33(1) — notify UODO without undue delay and, where feasible, within 72 hours. Submissions: uodo.gov.pl.'}
                </p>
              </div>
              {canManage && (
                <div className="ml-auto flex flex-wrap gap-2">
                  {aiEnabled && (
                    <Button variant="outline" className="border-primary/40 text-primary" onClick={() => setAiOpen(true)}>
                      <Sparkles /> {t('ai.draftNotification')}
                    </Button>
                  )}
                  <Button onClick={notifyUodo}>
                    <CheckCircle2 /> {lang === 'pl' ? 'Zgłoszono do UODO' : 'Mark notified to UODO'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Art. 34 — communication to the affected data subjects, tracked and
            timestamped exactly like the UODO notification. */}
        {breach.subjectsNotificationRequired && !breach.subjectsNotifiedAt && (
          <Card className="border-(--status-warn)/50">
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <Users className="size-5 shrink-0 text-(--status-warn)" aria-hidden />
              <p className="min-w-0 flex-1 text-sm text-(--status-warn)">{t('breach.subjectsPending')}</p>
              {canManage && (
                <Button className="ml-auto" onClick={notifySubjects}>
                  <CheckCircle2 /> {t('breach.markSubjectsNotified')}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Art. 33(3)</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="whitespace-pre-wrap text-foreground">{breach.description}</p>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
              <span>{t('breach.discovered')}: {new Date(breach.discoveredAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}</span>
              <span>{lang === 'pl' ? 'Liczba osób' : 'Subjects affected'}: {breach.subjectsCount}</span>
              {breach.recordsCount != null && (
                <span>{t('breach.recordsCount')}: {breach.recordsCount}</span>
              )}
              {breach.dataCategories?.length > 0 && (
                <span>{t('breach.dataCategories')}: {breach.dataCategories.map((c) => labelOf(DATA_CATEGORIES, c, lang)).join(', ')}</span>
              )}
              <span>{lang === 'pl' ? 'Poziom ryzyka' : 'Risk level'}: {breach.riskLevel}</span>
              <span>
                {t('breach.notifySubjects')}: {breach.subjectsNotificationRequired ? t('common.yes') : t('common.no')} (Art. 34)
              </span>
              {breach.uodoNotifiedAt && (
                <span className="text-(--status-ok)">
                  UODO ✓ {new Date(breach.uodoNotifiedAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                </span>
              )}
              {breach.subjectsNotifiedAt && (
                <span className="text-(--status-ok)">
                  {t('breach.subjectsNotified')} ✓ {new Date(breach.subjectsNotifiedAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* UODO reference / case number — recorded AFTER submitting on uodo.gov.pl,
            so the register carries the regulator's own file number (Art. 33(5)). */}
        {breach.uodoNotificationRequired && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{lang === 'pl' ? 'Sygnatura / numer sprawy UODO' : 'UODO reference / case number'}</CardTitle>
            </CardHeader>
            <CardContent>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <Input value={reference} onChange={(e) => setReference(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveReference(); }}
                    placeholder={lang === 'pl' ? 'np. DKN.5131.2026.XYZ' : 'e.g. DKN.5131.2026.XYZ'}
                    aria-label={lang === 'pl' ? 'Numer sprawy UODO' : 'UODO case number'} className="max-w-xs" />
                  <Button variant="outline" size="sm" onClick={saveReference}
                    disabled={reference.trim() === (breach.uodoReference ?? '')}>
                    <Save /> {t('common.save')}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-foreground">{breach.uodoReference || '—'}</p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {lang === 'pl'
                  ? 'Wpisz numer nadany przez UODO po wysłaniu zgłoszenia na uodo.gov.pl.'
                  : 'Enter the case number UODO gives you after you submit the report on uodo.gov.pl.'}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('breach.riskRationale')} — Art. 33(5)</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{breach.riskRationale}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{lang === 'pl' ? 'Działania naprawcze' : 'Remediation'} — Art. 33(3)(d)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {breach.remediation.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                <input type="checkbox" className="accent-[#c5a059]" checked={r.done}
                  disabled={!canManage} onChange={() => toggleTask(r.id)} />
                <span className={r.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{r.text}</span>
              </label>
            ))}
            {breach.remediation.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            {canManage && (
              <div className="mt-1 flex gap-2">
                <Input value={newTask} onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addRemediation(); }}
                  placeholder={t('breach.addRemediation')} aria-label={t('breach.addRemediation')} />
                <Button variant="outline" size="sm" onClick={addRemediation} disabled={!newTask.trim()}>
                  <Plus /> {t('common.add')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ready-to-submit UODO report (Art. 33(3)) — deterministic, filled from the
          breach + company/DPO settings. Copy it into UODO's online form, or keep the
          download for the file. */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{lang === 'pl' ? 'Raport zgłoszenia do UODO — art. 33(3)' : 'UODO breach report — Art. 33(3)'}</DialogTitle>
            <DialogDescription>
              {lang === 'pl'
                ? 'Gotowy do wysłania. Skopiuj do formularza na uodo.gov.pl lub pobierz do akt.'
                : 'Ready to submit. Copy it into the form on uodo.gov.pl, or download it for your file.'}
            </DialogDescription>
          </DialogHeader>
          {!settings.data && (
            <p className="text-xs text-(--status-warn)">
              {lang === 'pl'
                ? 'Uwaga: dane administratora/IOD nie są jeszcze uzupełnione w Ustawieniach — pola te pokażą się jako [uzupełnij w Ustawieniach].'
                : 'Note: controller/DPO details are not set in Settings yet — those fields show as [set in Settings].'}
            </p>
          )}
          <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-sans text-xs leading-relaxed text-foreground">
            {report}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyReport}><Copy /> {t('ai.copy')}</Button>
            <Button variant="outline" size="sm" onClick={async () => {
              if (await recordReportExport('markdown')) {
                downloadBlob(`${reportFilename}.md`, report, 'text/markdown;charset=utf-8');
              }
            }}>
              <Download /> Markdown
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              if (await recordReportExport('word')) {
                downloadWord(`${reportFilename}.doc`, breach.title, report);
              }
            }}>
              <Download /> Word
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              if (await recordReportExport('print')) printDoc(breach.title, report);
            }}>
              <Printer /> {lang === 'pl' ? 'Drukuj / PDF' : 'Print / PDF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AiDraftDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        title={t('ai.draftNotification')}
        filename={`UODO_notification_draft_${breach.id}.md`}
        generate={async () => {
          const action = await dispatch(aiDraftBreachNotification({ breach, lang }));
          if (action.error) throw new Error(action.error.message);
          return action.payload;
        }}
      />
    </div>
  );
}
