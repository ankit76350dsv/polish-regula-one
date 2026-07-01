import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { AlertCircle, Check, ChevronLeft, ChevronRight, ExternalLink, Lock, Phone, Shield } from "lucide-react";
import { AppButton, AttachmentUploader, Checkbox, SecureCard, SelectField, Spinner, TextArea, TextInput } from "../../components/ui";
import { reportCategories, HR_ONLY_CATEGORIES } from "../../constants/caseFields";
import { submitReport, selectSubmitStatus } from "../../slices/reportsSlice";
import { addToast } from "../../slices/uiSlice";
import { firstError, maxLength, minLength, notFutureDate, required } from "../../utils/validation";

// The anonymous report form, in TWO steps:
//   Step 1 — the facts and any evidence (what happened).
//   Step 2 — the protection choices (how to communicate + the required consents),
//            and ONLY here is the report actually submitted.
// `tenantId` names the organisation, read from the /company/{tenantId}/report URL.
export default function PublicReportPortal({ tenantId, navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const submitStatus = useSelector(selectSubmitStatus);
  const submitting = submitStatus === "loading";

  // Which step the reporter is on (1 = facts, 2 = protection choices).
  const [step, setStep] = useState(1);

  // Controlled form state — empty by default (no misleading pre-filled values).
  const [form, setForm] = useState({
    category: "",
    incidentDate: "",
    area: "",
    facts: "",
    channel: "written",
    requestMeeting: false,
    consentPrivacy: false,
    consentVoluntary: false,
  });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const isHrCategory = HR_ONLY_CATEGORIES.includes(form.category);

  // Drop the empty (null) entries so an errors object only holds real problems.
  const prune = (obj) => {
    Object.keys(obj).forEach((k) => obj[k] == null && delete obj[k]);
    return obj;
  };

  // Validate ONLY the step-1 fields (the facts). Returns an errors object.
  function step1Errors() {
    return prune({
      category: firstError(form.category, [required]),
      incidentDate: firstError(form.incidentDate, [required, notFutureDate]),
      area: firstError(form.area, [required, (v) => maxLength(v, 120)]),
      facts: firstError(form.facts, [required, (v) => minLength(v, 20), (v) => maxLength(v, 5000)]),
    });
  }

  // Validate ONLY the step-2 fields (the consents). Returns an errors object.
  function step2Errors() {
    return prune({
      consent:
        form.consentPrivacy && form.consentVoluntary ? null : { key: "validation.consentRequired" },
    });
  }

  // "Next": check the facts before moving on. If anything is missing we show the
  // errors and stay on step 1 so the reporter can fix them.
  function handleNext() {
    const e = step1Errors();
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setStep(2);
      window.scrollTo?.(0, 0);
    }
  }

  // "Back": return to the facts step (no validation needed to go backwards).
  function handleBack() {
    setStep(1);
    window.scrollTo?.(0, 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Re-check both steps. If a facts field is somehow invalid, jump back to step 1
    // so the reporter sees and fixes it rather than being blocked with no explanation.
    const e1 = step1Errors();
    const e2 = step2Errors();
    setErrors({ ...e1, ...e2 });
    if (Object.keys(e1).length > 0) {
      setStep(1);
      window.scrollTo?.(0, 0);
      return;
    }
    if (Object.keys(e2).length > 0) return;

    try {
      await dispatch(
        submitReport({
          tenantId: tenantId ?? null,
          category: form.category,
          incidentDate: form.incidentDate,
          area: form.area,
          facts: form.facts,
          channel: form.channel,
          requestMeeting: form.requestMeeting,
          // Evidence files. We send the actual bytes (base64 `content`) plus the details
          // the backend needs to validate and store them. `displayName`/`sizeLabel` are the
          // fields today's backend already reads; `fileName`/`mimeType`/`sizeBytes`/`content`
          // are what the upcoming backend file-storage step will consume.
          attachments: files.map((f, i) => ({
            displayName: `Evidence ${i + 1} (${f.extension})`,
            sizeLabel: f.sizeLabel,
            fileName: f.fileName,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            content: f.content,
          })),
        }),
      ).unwrap();
      navigate?.("/report/success");
    } catch (err) {
      // Show the backend's own message when it has one (e.g. the "please wait one
      // minute and submit again" reply when two reports land in the same minute);
      // otherwise fall back to a generic error.
      dispatch(addToast({ type: "error", message: err?.message || t("toast.genericError") }));
    }
  }

  const err = (key) => (errors[key] ? t(errors[key].key, errors[key].params) : undefined);

  // Progress-indicator styling: a step circle/label is highlighted once we have
  // reached it (step 1 stays highlighted while on step 2, as a "done" step).
  const circleCls = (n) =>
    n <= step ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-600";
  const labelCls = (n) => (n <= step ? "text-slate-800" : "text-slate-500");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start leading-relaxed">
      <form className="lg:col-span-2" onSubmit={handleSubmit} noValidate>
        <SecureCard isEncrypted title={t("report.title")} subtitle={t(step === 1 ? "report.subtitleStep1" : "report.subtitleStep2")}>
          {/* Progress indicator — reflects the current step. */}
          <ol className="flex flex-wrap items-center gap-3 mb-6 bg-slate-100 p-3 rounded-lg border border-slate-200 list-none">
            <li className="flex items-center gap-2.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${circleCls(1)}`}>1</span>
              <span className={`text-xs font-semibold ${labelCls(1)}`}>{t("report.stepFacts")}</span>
            </li>
            <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <li className="flex items-center gap-2.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${circleCls(2)}`}>2</span>
              <span className={`text-xs font-semibold ${labelCls(2)}`}>{t("report.stepProtection")}</span>
            </li>
          </ol>

          {tenantId && (
            <p className="mb-6 text-[11px] font-mono text-slate-500">
              {t("report.reportingTo")}: <span className="font-bold text-slate-700">{tenantId}</span>
            </p>
          )}

          <div className="space-y-6">
            {/* ── STEP 1: the facts and evidence ─────────────────────────────── */}
            {step === 1 && (
              <>
                <SelectField
                  label={t("report.category")}
                  required
                  hint={t("report.categoryHint")}
                  value={form.category}
                  onChange={(e) => set("category")(e.target.value)}
                  error={err("category")}
                >
                  <option value="" disabled>
                    {t("common.selectOption")}
                  </option>
                  {reportCategories.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`, c)}
                    </option>
                  ))}
                </SelectField>

                {isHrCategory && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <span className="font-bold block mb-1">{t("report.hrSeparateTitle")}</span>
                      {t("report.hrSeparateBody")}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput
                    label={t("report.incidentDate")}
                    required
                    type="date"
                    value={form.incidentDate}
                    onChange={(e) => set("incidentDate")(e.target.value)}
                    error={err("incidentDate")}
                  />
                  <TextInput
                    label={t("report.area")}
                    required
                    placeholder={t("report.areaPlaceholder")}
                    value={form.area}
                    onChange={(e) => set("area")(e.target.value)}
                    error={err("area")}
                  />
                </div>

                <TextArea
                  label={t("report.facts")}
                  required
                  rows={6}
                  placeholder={t("report.factsPlaceholder")}
                  hint={t("report.factsHint")}
                  value={form.facts}
                  onChange={(e) => set("facts")(e.target.value)}
                  error={err("facts")}
                />

                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase font-mono block mb-2">
                    {t("report.evidence")}
                  </span>
                  <AttachmentUploader files={files} onFilesChanged={setFiles} />
                </div>

                {/* Footer: only "Next" on step 1 (no submit here). */}
                <div className="flex justify-end border-t border-slate-200 pt-4">
                  <AppButton type="button" variant="primary" onClick={handleNext} icon={<ChevronRight className="w-4 h-4" />}>
                    {t("common.next")}
                  </AppButton>
                </div>
              </>
            )}

            {/* ── STEP 2: protection choices + consents (submit lives here) ───── */}
            {step === 2 && (
              <>
                {/* Reporting channel — written + oral, plus the right to a meeting (Art. 9(2)). */}
                <fieldset className="border border-slate-200 rounded-lg p-4">
                  <legend className="text-xs font-bold text-slate-700 uppercase font-mono px-1">
                    {t("report.channelTitle")}
                  </legend>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                      <input type="radio" name="channel" value="written" checked={form.channel === "written"} onChange={() => set("channel")("written")} className="h-4 w-4 accent-cyan-600" />
                      {t("report.channelWritten")}
                    </label>
                    <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                      <input type="radio" name="channel" value="oral" checked={form.channel === "oral"} onChange={() => set("channel")("oral")} className="h-4 w-4 accent-cyan-600" />
                      <Phone className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      {t("report.channelOral")}
                    </label>
                  </div>
                  {form.channel === "oral" && (
                    <p className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5">
                      {t("report.channelOralInfo")}
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <Checkbox
                      label={t("report.requestMeeting")}
                      checked={form.requestMeeting}
                      onChange={set("requestMeeting")}
                    />
                    {form.requestMeeting && (
                      <p className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5">
                        {t("report.requestMeetingInfo")}
                      </p>
                    )}
                  </div>
                </fieldset>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-800 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="font-bold block mb-1">{t("report.anonymousTitle")}</span>
                    {t("report.anonymousBody")}
                  </div>
                </div>

                {/* Consent / acknowledgements (required before submit). */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                    {t("report.consentTitle")}
                  </legend>
                  <Checkbox
                    label={t("report.consentPrivacy", { privacyLink: t("report.consentPrivacyLink") })}
                    checked={form.consentPrivacy}
                    onChange={set("consentPrivacy")}
                  />
                  <button
                    type="button"
                    onClick={() => navigate?.("/privacy")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:underline ml-6 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                  >
                    <ExternalLink className="w-3 h-3" aria-hidden="true" /> {t("footer.privacy")}
                  </button>
                  <Checkbox
                    label={t("report.consentVoluntary")}
                    checked={form.consentVoluntary}
                    onChange={set("consentVoluntary")}
                  />
                  {errors.consent && (
                    <p role="alert" className="flex items-center gap-1.5 text-[11px] text-rose-600">
                      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      {t(errors.consent.key)}
                    </p>
                  )}
                </fieldset>

                {/* Footer: Back to the facts, and the real submit. */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <AppButton type="button" variant="outline" onClick={handleBack} disabled={submitting} icon={<ChevronLeft className="w-4 h-4" />}>
                    {t("common.back")}
                  </AppButton>
                  <AppButton type="submit" variant="secure" disabled={submitting} icon={submitting ? null : <Shield className="w-4 h-4" />}>
                    {submitting ? <Spinner size={16} label={t("report.submitting")} /> : t("report.submit")}
                  </AppButton>
                </div>
              </>
            )}
          </div>
        </SecureCard>
      </form>

      {/* Side column: safeguards + data minimisation transparency. */}
      <div className="space-y-6">
        <SecureCard title={t("report.safeguardsTitle")}>
          <ul className="space-y-3 text-xs text-slate-700">
            {["ack", "noTelemetry", "filenames", "deletion", "external"].map((k) => (
              <li key={k} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t(`report.safeguards.${k}`)}</span>
              </li>
            ))}
          </ul>
        </SecureCard>

        <SecureCard title={t("report.minimizationTitle")} subtitle={t("report.minimizationSubtitle")}>
          <div className="grid gap-2 text-xs text-slate-700">
            {["analytics", "marketing", "device", "browser", "geo", "ip"].map((k) => (
              <div key={k} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>{t(`report.minimization.${k}`)}</span>
                <span className="text-emerald-700 font-mono text-[10px] uppercase">{t("report.notCollected")}</span>
              </div>
            ))}
          </div>
        </SecureCard>
      </div>
    </div>
  );
}
