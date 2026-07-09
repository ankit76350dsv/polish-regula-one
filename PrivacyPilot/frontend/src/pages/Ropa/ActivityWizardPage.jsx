// Activity wizard — 9 validated steps mirroring Art. 30(1)/(2).
// Fixes carried from the validation report:
//  - all SIX Art. 6 bases selectable;
//  - Art. 9(2) condition is a mandatory picker when special categories are chosen;
//  - recipients (Art. 30(1)(d)) are separate from processors (Art. 28);
//  - DPIA screening runs the 12 UODO criteria, pre-suggested from entered data;
//  - each step validates before you can move past it.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import PageHeader from '../../components/common/PageHeader';
import { FormField, Input, Select, Textarea } from '../../components/common/Field';
import { DpiaVerdictBadge } from '../../components/common/StatusBadge';
import { AiBadge, AiDisclaimer, useAiEnabled } from '../../components/common/AiAssist';
import { aiDraftActivity } from '../../store/slices/aiSlice';
import { useT } from '../../i18n';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchActivities, createActivity, updateActivity } from '../../store/slices/activitiesSlice';
import { fetchVendors } from '../../store/slices/vendorsSlice';
import { fetchTransfers } from '../../store/slices/transfersSlice';
import {
  ART6_BASES, ART9_CONDITIONS, DATA_CATEGORIES, DATA_SUBJECT_CATEGORIES,
  RECIPIENT_CATEGORIES, TOMS, DEPARTMENTS, SPECIAL_CATEGORY_IDS, labelOf,
} from '../../lib/gdpr';
import { DPIA_CRITERIA, evaluateDpia, suggestCriteria } from '../../lib/dpiaCriteria';

const STEP_KEYS = [
  'wizard.step.basics', 'wizard.step.purpose', 'wizard.step.data',
  'wizard.step.recipients', 'wizard.step.transfers', 'wizard.step.retention',
  'wizard.step.toms', 'wizard.step.dpia', 'wizard.step.review',
];

// Derived from the single source of truth so the Art. 9(2) picker triggers for
// every special category, not a stale hardcoded subset.
const SPECIAL_IDS = SPECIAL_CATEGORY_IDS;

const EMPTY = {
  name: '', role: 'controller', department: 'hr', ownerName: '', status: 'draft',
  controllersServed: '',
  purpose: '', lawfulBasis: '', legitimateInterestDetail: '',
  dataSubjects: [], dataCategories: [], art9Condition: '', art10: false, dataSources: [],
  recipients: [], vendorIds: [],
  transfer: false, transferIds: [],
  retentionPeriod: '', retentionBasis: '',
  toms: [],
  dpiaCriteria: [],
  provisionStatement: '',
};

/** Toggle helper for chip/checkbox arrays. */
const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/**
 * AI copilot box (step 1 only): describe the processing in plain language,
 * get a pre-filled DRAFT of the whole form. Human still walks every step —
 * validation, the Art. 9(2) picker and the DPIA screening all stay in force.
 */
function AiCopilot({ onDraft }) {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const aiEnabled = useAiEnabled();
  const aiStatus = useSelector((s) => s.ai.status);
  const [text, setText] = useState('');
  const [rationale, setRationale] = useState(null);

  if (!aiEnabled) return null;

  const generate = async () => {
    const action = await dispatch(aiDraftActivity(text));
    if (action.error) {
      toast.error(action.error.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('common.error'));
      return;
    }
    onDraft(action.payload);
    setRationale(lang === 'pl' ? action.payload.rationalePl : action.payload.rationaleEn);
    toast.success(t('ai.applied'));
  };

  return (
    <div className="grid gap-2 rounded-lg border border-primary/30 bg-accent/50 p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <span className="text-sm font-medium text-foreground">{t('ai.name')}</span>
        <AiBadge />
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`${t('ai.describe')} ${t('ai.describeExample')}`}
        aria-label={t('ai.describe')}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" className="border-primary/40 text-primary"
          onClick={generate} disabled={text.trim().length < 10 || aiStatus === 'loading'}>
          <Sparkles /> {aiStatus === 'loading' ? t('ai.generating') : t('ai.generate')}
        </Button>
      </div>
      {rationale && (
        <div className="rounded-md border border-border p-2">
          <p className="text-[11px] font-medium text-muted-foreground">{t('ai.rationale')}:</p>
          <ul className="mt-1 grid list-disc gap-0.5 pl-4 text-[11px] text-muted-foreground">
            {rationale.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      <AiDisclaimer />
    </div>
  );
}

/** Multi-select chip group with keyboard-operable buttons (not fake divs). */
function ChipGroup({ options, selected, onToggle, lang, flagKey }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <button
            key={opt.id} type="button" aria-pressed={active}
            onClick={() => onToggle(opt.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              active
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {opt[lang]}
            {flagKey && opt[flagKey] && <span className="ml-1 text-(--status-warn)">• Art. 9</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function ActivityWizardPage() {
  const { t, lang } = useT();
  const { id } = useParams(); // present in edit mode
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items: activities } = useSliceData('activities', fetchActivities);
  const { items: vendors } = useSliceData('vendors', fetchVendors);
  const { items: transfers } = useSliceData('transfers', fetchTransfers);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY, ownerName: user.name });
  const [errors, setErrors] = useState({});
  const [maxVisited, setMaxVisited] = useState(0);
  const [saving, setSaving] = useState(false);

  // Edit mode: hydrate the form once the activity is loaded.
  useEffect(() => {
    if (!id) return;
    const existing = activities.find((a) => a.id === id);
    if (existing) setForm({ ...EMPTY, ...existing });
  }, [id, activities]);

  const isController = form.role !== 'processor';
  const hasSpecial = form.dataCategories.some((c) => SPECIAL_IDS.includes(c));
  const verdict = useMemo(() => evaluateDpia(form.dpiaCriteria), [form.dpiaCriteria]);
  const suggested = useMemo(() => suggestCriteria(form), [form.dataSubjects, form.dataCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function validateStep(i) {
    const e = {};
    if (i === 0) {
      if (!form.name.trim()) e.name = t('common.requiredField');
      if (form.role === 'processor' && !form.controllersServed.trim()) e.controllersServed = t('common.requiredField');
    }
    if (i === 1) {
      if (form.purpose.trim().length < 20) e.purpose = `${t('common.requiredField')} (min. 20)`;
      if (isController && !form.lawfulBasis) e.lawfulBasis = t('common.requiredField');
      if (form.lawfulBasis === 'legitimate_interest' && !form.legitimateInterestDetail.trim()) {
        e.legitimateInterestDetail = t('common.requiredField');
      }
    }
    if (i === 2) {
      if (form.dataSubjects.length === 0) e.dataSubjects = t('common.requiredField');
      if (form.dataCategories.length === 0) e.dataCategories = t('common.requiredField');
      if (hasSpecial && !form.art9Condition) e.art9Condition = t('common.requiredField');
    }
    if (i === 5) {
      if (!form.retentionPeriod.trim()) e.retentionPeriod = t('common.requiredField');
    }
    if (i === 6) {
      if (form.toms.length === 0) e.toms = t('common.requiredField');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const goNext = () => {
    if (!validateStep(step)) return;
    const next = Math.min(step + 1, STEP_KEYS.length - 1);
    setStep(next);
    setMaxVisited((m) => Math.max(m, next));
  };
  const goTo = (i) => {
    // Backwards always allowed; forward only through validated steps.
    if (i <= step || (i <= maxVisited && validateStep(step))) setStep(i);
  };

  const submit = async () => {
    // Final pass over every validated step, in case fields were edited later.
    for (const i of [0, 1, 2, 5, 6]) {
      if (!validateStep(i)) { setStep(i); return; }
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        art10: form.dataCategories.includes('criminal'),
      };
      const action = id
        ? await dispatch(updateActivity({ id, patch: payload }))
        : await dispatch(createActivity(payload));
      const saved = action.payload;
      if (action.error) throw new Error(action.error.message);
      toast.success(t('common.save'));
      navigate(`/register/${saved.id}`);
    } catch (err) {
      toast.error(err.message === 'FORBIDDEN' ? t('common.notAuthorized') : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('wizard.title')} subtitle={id ? form.name : null} />

      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-1.5" aria-label={t('wizard.title')}>
        {STEP_KEYS.map((key, i) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === step ? 'step' : undefined}
              disabled={i > maxVisited}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-40',
                i === step ? 'border-primary bg-primary/15 text-primary'
                : i < step ? 'border-(--status-ok)/40 text-(--status-ok)'
                : 'border-border text-muted-foreground',
              )}
            >
              {i < step ? <Check className="size-3" /> : <span className="tabular-nums">{i + 1}</span>}
              {t(key)}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="grid gap-5 p-5">
          {step === 0 && (
            <>
              {!id && (
                <AiCopilot
                  onDraft={(draft) => {
                    // Apply only form fields; rationale stays in the panel.
                    const { rationaleEn, rationalePl, ...fields } = draft;
                    set(fields);
                  }}
                />
              )}
              <FormField label={t('ropa.name')} required error={errors.name}>
                {(fid) => <Input id={fid} value={form.name} onChange={(e) => set({ name: e.target.value })} />}
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('common.department')}>
                  {(fid) => (
                    <Select id={fid} value={form.department} onChange={(e) => set({ department: e.target.value })}>
                      {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d[lang]}</option>)}
                    </Select>
                  )}
                </FormField>
                <FormField
                  label="Rola / Role (Art. 30)"
                  hint={lang === 'pl'
                    ? 'Administrator prowadzi rejestr z art. 30 ust. 1; podmiot przetwarzający — z art. 30 ust. 2.'
                    : 'Controllers keep the Art. 30(1) record; processors the Art. 30(2) record of categories.'}
                >
                  {(fid) => (
                    <Select id={fid} value={form.role} onChange={(e) => set({ role: e.target.value })}>
                      <option value="controller">{lang === 'pl' ? 'Administrator (ADO)' : 'Controller'}</option>
                      <option value="joint_controller">{lang === 'pl' ? 'Współadministrator' : 'Joint controller'}</option>
                      <option value="processor">{lang === 'pl' ? 'Podmiot przetwarzający' : 'Processor'}</option>
                    </Select>
                  )}
                </FormField>
              </div>
              {form.role === 'processor' && (
                <FormField
                  label={lang === 'pl' ? 'Administratorzy, na rzecz których przetwarzasz (art. 30 ust. 2 lit. a)' : 'Controllers you process for (Art. 30(2)(a))'}
                  required error={errors.controllersServed}
                >
                  {(fid) => (
                    <Textarea id={fid} value={form.controllersServed}
                      onChange={(e) => set({ controllersServed: e.target.value })} />
                  )}
                </FormField>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <FormField label={`${t('ropa.purpose')} (Art. 30(1)(b))`} required error={errors.purpose}>
                {(fid) => <Textarea id={fid} value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} />}
              </FormField>
              {isController && (
                <FormField label={`${t('ropa.lawfulBasis')} (Art. 6(1))`} required error={errors.lawfulBasis}>
                  <div className="grid gap-1.5" role="radiogroup">
                    {ART6_BASES.map((b) => (
                      <label key={b.id} className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                        form.lawfulBasis === b.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                      )}>
                        <input type="radio" name="basis" className="accent-[#c5a059]"
                          checked={form.lawfulBasis === b.id}
                          onChange={() => set({ lawfulBasis: b.id })} />
                        <span className="text-foreground">{b[lang]}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{b.ref}</span>
                      </label>
                    ))}
                  </div>
                </FormField>
              )}
              {form.lawfulBasis === 'legitimate_interest' && (
                <FormField
                  label={lang === 'pl' ? 'Opis prawnie uzasadnionego interesu' : 'Description of the legitimate interest'}
                  required error={errors.legitimateInterestDetail}
                  hint={lang === 'pl' ? 'Wymagane w klauzuli informacyjnej — art. 13(1)(d).' : 'Required in the privacy notice — Art. 13(1)(d).'}
                >
                  {(fid) => (
                    <Textarea id={fid} value={form.legitimateInterestDetail}
                      onChange={(e) => set({ legitimateInterestDetail: e.target.value })} />
                  )}
                </FormField>
              )}
              <FormField
                label={lang === 'pl' ? 'Czy podanie danych jest wymogiem? (art. 13(2)(e))' : 'Is providing data required? (Art. 13(2)(e))'}
                hint={lang === 'pl' ? 'Np. wymóg ustawowy / umowny i konsekwencje niepodania.' : 'E.g. statutory/contractual requirement and consequences of not providing.'}
              >
                {(fid) => (
                  <Textarea id={fid} value={form.provisionStatement}
                    onChange={(e) => set({ provisionStatement: e.target.value })} />
                )}
              </FormField>
            </>
          )}

          {step === 2 && (
            <>
              <FormField label={`${lang === 'pl' ? 'Kategorie osób' : 'Categories of data subjects'} (Art. 30(1)(c))`} required error={errors.dataSubjects}>
                <ChipGroup options={DATA_SUBJECT_CATEGORIES} selected={form.dataSubjects}
                  onToggle={(v) => set({ dataSubjects: toggle(form.dataSubjects, v) })} lang={lang} />
              </FormField>
              <FormField label={`${lang === 'pl' ? 'Kategorie danych' : 'Categories of personal data'} (Art. 30(1)(c))`} required error={errors.dataCategories}>
                <ChipGroup options={DATA_CATEGORIES} selected={form.dataCategories}
                  onToggle={(v) => set({ dataCategories: toggle(form.dataCategories, v) })} lang={lang} flagKey="special" />
              </FormField>
              {hasSpecial && (
                <FormField
                  label={lang === 'pl' ? 'Warunek przetwarzania danych szczególnych — art. 9(2)' : 'Special-category condition — Art. 9(2)'}
                  required error={errors.art9Condition}
                >
                  {(fid) => (
                    <Select id={fid} value={form.art9Condition} onChange={(e) => set({ art9Condition: e.target.value })}>
                      <option value="">—</option>
                      {ART9_CONDITIONS.map((c) => (
                        <option key={c.id} value={c.id}>{c.ref} — {c[lang]}</option>
                      ))}
                    </Select>
                  )}
                </FormField>
              )}
              <FormField
                label={lang === 'pl' ? 'Źródła danych (art. 14)' : 'Data sources (Art. 14)'}
                hint={lang === 'pl' ? 'Rozdziel średnikiem.' : 'Separate with semicolons.'}
              >
                {(fid) => (
                  <Input id={fid} value={form.dataSources.join('; ')}
                    onChange={(e) => set({ dataSources: e.target.value.split(';').map((s) => s.trim()).filter(Boolean) })} />
                )}
              </FormField>
            </>
          )}

          {step === 3 && (
            <>
              <FormField
                label={`${lang === 'pl' ? 'Kategorie odbiorców' : 'Categories of recipients'} (Art. 30(1)(d))`}
                hint={lang === 'pl'
                  ? 'Odbiorcy to nie to samo co podmioty przetwarzające — te wybierz poniżej.'
                  : 'Recipients are not the same as processors — pick processors separately below.'}
              >
                <ChipGroup options={RECIPIENT_CATEGORIES} selected={form.recipients}
                  onToggle={(v) => set({ recipients: toggle(form.recipients, v) })} lang={lang} />
              </FormField>
              <FormField label={`${lang === 'pl' ? 'Podmioty przetwarzające (art. 28)' : 'Processors (Art. 28)'}`}>
                <div className="grid gap-1.5">
                  {vendors.map((v) => (
                    <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
                      <input type="checkbox" className="accent-[#c5a059]"
                        checked={form.vendorIds.includes(v.id)}
                        onChange={() => set({ vendorIds: toggle(form.vendorIds, v.id) })} />
                      <span className="text-foreground">{v.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{v.country}</span>
                      {v.dpaStatus !== 'signed' && (
                        <span className="text-xs text-(--status-warn)">{t(`vendors.dpa.${v.dpaStatus}`)}</span>
                      )}
                    </label>
                  ))}
                </div>
              </FormField>
            </>
          )}

          {step === 4 && (
            <>
              <FormField label={`${t('transfers.title')} (Art. 30(1)(e))`}>
                <div className="flex gap-2">
                  {[false, true].map((val) => (
                    <button key={String(val)} type="button" aria-pressed={form.transfer === val}
                      onClick={() => set({ transfer: val, transferIds: val ? form.transferIds : [] })}
                      className={cn(
                        'rounded-lg border px-4 py-2 text-sm',
                        form.transfer === val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                      )}>
                      {val ? t('common.yes') : `${t('common.no')} (EEA only)`}
                    </button>
                  ))}
                </div>
              </FormField>
              {form.transfer && (
                <FormField
                  label={lang === 'pl' ? 'Powiązane transfery' : 'Linked transfers'}
                  hint={lang === 'pl'
                    ? 'Brakujący transfer dodasz w module Transfery międzynarodowe po zapisaniu.'
                    : 'Add missing transfers in the International Transfers module after saving.'}
                >
                  <div className="grid gap-1.5">
                    {transfers.map((tr) => (
                      <label key={tr.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
                        <input type="checkbox" className="accent-[#c5a059]"
                          checked={form.transferIds.includes(tr.id)}
                          onChange={() => set({ transferIds: toggle(form.transferIds, tr.id) })} />
                        <span className="text-foreground">{tr.recipient}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{tr.destinationCountry}</span>
                      </label>
                    ))}
                    {transfers.length === 0 && (
                      <p className="text-xs text-muted-foreground">{t('common.emptyTitle')}</p>
                    )}
                  </div>
                </FormField>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <FormField label={`${t('ropa.retention')} (Art. 30(1)(f))`} required error={errors.retentionPeriod}
                hint={lang === 'pl' ? 'Np. „10 lat od ustania zatrudnienia" albo „do wycofania zgody".' : 'E.g. "10 years after employment ends" or "until consent is withdrawn".'}>
                {(fid) => <Input id={fid} value={form.retentionPeriod} onChange={(e) => set({ retentionPeriod: e.target.value })} />}
              </FormField>
              <FormField label={lang === 'pl' ? 'Podstawa okresu retencji' : 'Legal basis for the retention period'}>
                {(fid) => <Input id={fid} value={form.retentionBasis} onChange={(e) => set({ retentionBasis: e.target.value })} />}
              </FormField>
            </>
          )}

          {step === 6 && (
            <FormField label={`${lang === 'pl' ? 'Środki techniczne i organizacyjne' : 'Technical and organisational measures'} (Art. 32 / 30(1)(g))`}
              required error={errors.toms}>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {TOMS.map((tm) => (
                  <label key={tm.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent">
                    <input type="checkbox" className="accent-[#c5a059]"
                      checked={form.toms.includes(tm.id)}
                      onChange={() => set({ toms: toggle(form.toms, tm.id) })} />
                    <span className="text-foreground">{tm[lang]}</span>
                  </label>
                ))}
              </div>
            </FormField>
          )}

          {step === 7 && (
            <>
              <div className="rounded-lg border border-primary/30 bg-accent p-3 text-xs text-accent-foreground">
                {lang === 'pl'
                  ? 'Analiza wstępna wg wykazu Prezesa UODO (M.P. 2019 poz. 666). Kryteria sugerowane na podstawie wprowadzonych danych — możesz je zmienić.'
                  : 'Screening against the UODO list (M.P. 2019 poz. 666). Criteria are pre-suggested from your answers — adjust as needed.'}
              </div>
              <div className="grid gap-1.5">
                {DPIA_CRITERIA.map((c) => (
                  <label key={c.id} className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                    form.dpiaCriteria.includes(c.id) ? 'border-(--status-warn)/50 bg-(--status-warn)/5' : 'border-border hover:bg-accent',
                  )}>
                    <input type="checkbox" className="mt-0.5 accent-[#c5a059]"
                      checked={form.dpiaCriteria.includes(c.id)}
                      onChange={() => set({ dpiaCriteria: toggle(form.dpiaCriteria, c.id) })} />
                    <span>
                      <span className="font-medium text-foreground">{c[lang]}</span>
                      {suggested.includes(c.id) && !form.dpiaCriteria.includes(c.id) && (
                        <span className="ml-1.5 text-primary">({lang === 'pl' ? 'sugerowane' : 'suggested'})</span>
                      )}
                      <br />
                      <span className="text-muted-foreground">{lang === 'pl' ? c.examplePl : c.exampleEn}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <DpiaVerdictBadge verdict={verdict.verdict} />
                <p className="text-xs text-muted-foreground">{verdict[lang]}</p>
              </div>
            </>
          )}

          {step === 8 && (
            <div className="grid gap-2 text-sm">
              {[
                [t('ropa.name'), form.name],
                ['Rola / Role', form.role],
                [t('common.department'), labelOf(DEPARTMENTS, form.department, lang)],
                [t('ropa.purpose'), form.purpose],
                [t('ropa.lawfulBasis'), form.lawfulBasis ? labelOf(ART6_BASES, form.lawfulBasis, lang) : '—'],
                ['Art. 9(2)', form.art9Condition ? `Art. 9(2)(${form.art9Condition})` : '—'],
                [lang === 'pl' ? 'Osoby' : 'Subjects', form.dataSubjects.map((s) => labelOf(DATA_SUBJECT_CATEGORIES, s, lang)).join(', ')],
                [lang === 'pl' ? 'Dane' : 'Data', form.dataCategories.map((c) => labelOf(DATA_CATEGORIES, c, lang)).join(', ')],
                [lang === 'pl' ? 'Odbiorcy' : 'Recipients', form.recipients.map((r) => labelOf(RECIPIENT_CATEGORIES, r, lang)).join(', ') || '—'],
                [t('ropa.retention'), form.retentionPeriod],
                ['TOMs', form.toms.map((tm) => labelOf(TOMS, tm, lang)).join(', ')],
                [t('ropa.dpia'), t(`dpia.verdict.${verdict.verdict}`)],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[10rem_1fr] gap-3 border-b border-border/50 pb-2">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-foreground">{value || '—'}</span>
                </div>
              ))}
              <FormField label={t('common.status')}>
                {(fid) => (
                  <Select id={fid} value={form.status} onChange={(e) => set({ status: e.target.value })} className="max-w-48">
                    <option value="draft">{t('status.draft')}</option>
                    <option value="in_review">{t('status.in_review')}</option>
                  </Select>
                )}
              </FormField>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}>
          <ChevronLeft /> {t('common.back')}
        </Button>
        {step < STEP_KEYS.length - 1 ? (
          <Button onClick={goNext}>
            {t('common.next')} <ChevronRight />
          </Button>
        ) : (
          <Button onClick={submit} disabled={saving}>
            {saving ? t('common.loading') : t('wizard.submit')}
          </Button>
        )}
      </div>
    </div>
  );
}
