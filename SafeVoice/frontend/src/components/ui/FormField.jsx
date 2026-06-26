/**
 * Accessible form building blocks used across every SafeVoice form.
 *
 * Each control is paired with a <label>, shows an inline error with role="alert"
 * and wires aria-invalid / aria-describedby so screen readers announce problems
 * (WCAG 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 4.1.3 Status).
 */
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";

const baseInput =
  "block w-full rounded-lg bg-white border text-slate-900 text-sm px-3.5 py-2.5 outline-none transition-colors focus:ring-1 placeholder-slate-400";
const okBorder = "border-slate-300 focus:border-cyan-500 focus:ring-cyan-500";
const errBorder = "border-rose-400 focus:border-rose-500 focus:ring-rose-500";

function Label({ htmlFor, label, required }) {
  const { t } = useTranslation();
  if (!label) return null;
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
      <span>{label}</span>
      <span className="font-mono text-[10px] uppercase text-slate-500">
        {required ? t("common.required") : t("common.optional")}
      </span>
    </label>
  );
}

function FieldError({ id, error }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-[11px] text-rose-600">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  );
}

export function TextInput({ label, required, error, hint, id, className = "", ...props }) {
  const generated = useId();
  const fieldId = id || generated;
  const errId = `${fieldId}-err`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={fieldId} label={label} required={required} />
      <input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={[error ? errId : null, hintId].filter(Boolean).join(" ") || undefined}
        className={`${baseInput} ${error ? errBorder : okBorder}`}
        {...props}
      />
      {hint && !error ? <p id={hintId} className="text-[11px] text-slate-500">{hint}</p> : null}
      <FieldError id={errId} error={error} />
    </div>
  );
}

export function TextArea({ label, required, error, hint, id, rows = 6, className = "", ...props }) {
  const generated = useId();
  const fieldId = id || generated;
  const errId = `${fieldId}-err`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={fieldId} label={label} required={required} />
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={[error ? errId : null, hintId].filter(Boolean).join(" ") || undefined}
        className={`${baseInput} ${error ? errBorder : okBorder}`}
        {...props}
      />
      {hint && !error ? <p id={hintId} className="text-[11px] text-slate-500">{hint}</p> : null}
      <FieldError id={errId} error={error} />
    </div>
  );
}

export function SelectField({ label, required, error, hint, id, children, className = "", ...props }) {
  const generated = useId();
  const fieldId = id || generated;
  const errId = `${fieldId}-err`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={fieldId} label={label} required={required} />
      <select
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={[error ? errId : null, hintId].filter(Boolean).join(" ") || undefined}
        className={`${baseInput} ${error ? errBorder : okBorder}`}
        {...props}
      >
        {children}
      </select>
      {hint && !error ? <p id={hintId} className="text-[11px] text-slate-500">{hint}</p> : null}
      <FieldError id={errId} error={error} />
    </div>
  );
}

export function Checkbox({ label, checked, onChange, error, id, name }) {
  const generated = useId();
  const fieldId = id || generated;
  return (
    <label htmlFor={fieldId} className="flex items-start gap-2.5 cursor-pointer text-sm text-slate-700">
      <input
        id={fieldId}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={Boolean(error)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-2 focus:ring-cyan-500 accent-cyan-600"
      />
      <span className="leading-relaxed">{label}</span>
    </label>
  );
}
