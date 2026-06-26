import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { AppButton, SelectField, Spinner, TextArea, TextInput } from "../../components/ui";
import { LegalPage } from "../../components/compliance/LegalPage";
import { resetDataRequest, selectDataRequestStatus, submitDataRequest } from "../../slices/settingsSlice";
import { firstError, email as emailRule, required } from "../../utils/validation";

// GDPR data-subject request form (access / rectify / erase / restrict).
export default function DataRequestPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const status = useSelector(selectDataRequestStatus);
  const submitting = status === "loading";
  const done = status === "succeeded";

  const [form, setForm] = useState({ type: "access", email: "", details: "" });
  const [errors, setErrors] = useState({});

  useEffect(() => () => dispatch(resetDataRequest()), [dispatch]);

  function submit(e) {
    e.preventDefault();
    const next = {};
    next.details = firstError(form.details, [required]);
    next.email = emailRule(form.email); // optional, but must be valid if present
    Object.keys(next).forEach((k) => next[k] == null && delete next[k]);
    setErrors(next);
    if (Object.keys(next).length) return;
    dispatch(submitDataRequest(form));
  }

  const p = (k) => t(`compliance.dataRequest.${k}`);
  const err = (key) => (errors[key] ? t(errors[key].key, errors[key].params) : undefined);

  return (
    <LegalPage title={p("title")} navigate={navigate}>
      <p className="text-sm text-slate-600">{p("subtitle")}</p>

      {done ? (
        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-4 text-sm">
          <Check className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
          {p("success")}
        </div>
      ) : (
        <form className="space-y-4 max-w-lg" onSubmit={submit} noValidate>
          <SelectField label={p("type")} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="access">{p("access")}</option>
            <option value="rectify">{p("rectify")}</option>
            <option value="erase">{p("erase")}</option>
            <option value="restrict">{p("restrict")}</option>
          </SelectField>
          <TextInput
            label={p("email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            error={err("email")}
          />
          <TextArea
            label={p("details")}
            required
            rows={4}
            value={form.details}
            onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
            error={err("details")}
          />
          <p className="text-[11px] text-slate-500">{p("note")}</p>
          <AppButton type="submit" variant="primary" disabled={submitting}>
            {submitting ? <Spinner size={16} /> : p("submit")}
          </AppButton>
        </form>
      )}
    </LegalPage>
  );
}
