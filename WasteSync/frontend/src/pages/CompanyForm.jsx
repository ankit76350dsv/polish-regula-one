import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchCompany, saveCompany, clearSubmitError } from "../store/slices/companySlice";
import { PageHeader, Card, Button, AlertBanner, Loader } from "../components/common";

// One small labelled input with an error message slot. Reusing this keeps every
// field in the form looking the same.
function Field({ label, error, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error.message}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

// Create-or-edit form for a company. If there is an :id in the URL we are
// editing; otherwise we are creating a new company.
export default function CompanyForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { selected, submitting, submitError } = useSelector((state) => state.companies);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      bdoRegistrationNumber: "",
      nip: "",
      regon: "",
      contactEmail: "",
      contactPhone: "",
      address: { street: "", city: "", postalCode: "", country: "Poland" },
    },
  });

  // When editing, load the company and fill the form with its current values.
  useEffect(() => {
    dispatch(clearSubmitError());
    if (isEdit) dispatch(fetchCompany(id));
  }, [dispatch, id, isEdit]);

  useEffect(() => {
    if (isEdit && selected && selected._id === id) {
      reset({
        name: selected.name || "",
        bdoRegistrationNumber: selected.bdoRegistrationNumber || "",
        nip: selected.nip || "",
        regon: selected.regon || "",
        contactEmail: selected.contactEmail || "",
        contactPhone: selected.contactPhone || "",
        address: {
          street: selected.address?.street || "",
          city: selected.address?.city || "",
          postalCode: selected.address?.postalCode || "",
          country: selected.address?.country || "Poland",
        },
      });
    }
  }, [isEdit, selected, id, reset]);

  // Send the form to the backend, then go back to the list on success.
  const onSubmit = async (data) => {
    const result = await dispatch(saveCompany({ id: isEdit ? id : null, data }));
    if (saveCompany.fulfilled.match(result)) {
      navigate("/companies");
    }
  };

  if (isEdit && !selected) {
    return <Loader label="Loading company…" />;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={isEdit ? "Edit company" : "Add company"}
        subtitle="The BDO registration number is mandatory and is printed on every report."
      />

      {submitError && (
        <div className="mb-4">
          <AlertBanner level="error">{submitError}</AlertBanner>
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Field label="Company name *" error={errors.name}>
            <input
              className={inputClass}
              {...register("name", { required: "Company name is required" })}
            />
          </Field>

          <Field
            label="BDO registration number *"
            error={errors.bdoRegistrationNumber}
            hint="Exactly 9 digits, e.g. 000123456"
          >
            <input
              className={inputClass}
              {...register("bdoRegistrationNumber", {
                required: "BDO number is required",
                pattern: {
                  value: /^\s*\d{3}\s?\d{3}\s?\d{3}\s*$/,
                  message: "BDO number must be exactly 9 digits",
                },
              })}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="NIP" error={errors.nip} hint="10 digits (optional)">
              <input
                className={inputClass}
                {...register("nip", {
                  pattern: { value: /^$|^\d{10}$/, message: "NIP must be 10 digits" },
                })}
              />
            </Field>
            <Field label="REGON" error={errors.regon} hint="9 or 14 digits (optional)">
              <input
                className={inputClass}
                {...register("regon", {
                  pattern: { value: /^$|^(\d{9}|\d{14})$/, message: "REGON must be 9 or 14 digits" },
                })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact email" error={errors.contactEmail}>
              <input
                className={inputClass}
                {...register("contactEmail", {
                  pattern: { value: /^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: "Invalid email" },
                })}
              />
            </Field>
            <Field label="Contact phone" error={errors.contactPhone}>
              <input className={inputClass} {...register("contactPhone")} />
            </Field>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="text-sm font-medium text-slate-700 mb-3">Registered address (EEA)</div>
            <div className="space-y-4">
              <Field label="Street" error={errors.address?.street}>
                <input className={inputClass} {...register("address.street")} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                  label="Postal code"
                  error={errors.address?.postalCode}
                  hint="NN-NNN"
                >
                  <input
                    className={inputClass}
                    {...register("address.postalCode", {
                      pattern: { value: /^$|^\d{2}-\d{3}$/, message: "Use NN-NNN" },
                    })}
                  />
                </Field>
                <Field label="City" error={errors.address?.city}>
                  <input className={inputClass} {...register("address.city")} />
                </Field>
                <Field label="Country" error={errors.address?.country}>
                  <input className={inputClass} {...register("address.country")} />
                </Field>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create company"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/companies")}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
