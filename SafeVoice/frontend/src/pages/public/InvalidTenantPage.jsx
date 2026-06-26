import { Building2, LinkIcon, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppButton, SecureCard } from "../../components/ui";

// ── Invalid / missing tenant ──────────────────────────────────────────────────
// SIMPLE EXPLANATION:
// A whistleblower report always belongs to ONE company. The company travels in the
// URL as /company/{tenantId}/report. If someone opens the bare /report path with no
// company id, we do NOT show the form and we never call the submit API — there is no
// organisation to file the report against. Instead we explain that they need their
// own organisation's secure reporting link (each company has a different one).
export default function InvalidTenantPage({ navigate }) {
  const { t } = useTranslation();

  return (
    <div className="max-w-xl mx-auto py-16">
      <SecureCard title={t("access.invalidTenantTitle")}>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="flex items-center gap-3 text-amber-600">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>

          <p>{t("access.invalidTenantBody")}</p>

          {/* What a valid intake link looks like, so it is obvious what is missing. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
              {t("access.invalidTenantExampleLabel")}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700">
              /company/<span className="text-cyan-700">{"{your-organisation-id}"}</span>/report
            </p>
          </div>

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Building2 className="mt-0.5 w-4 h-4 shrink-0" aria-hidden="true" />
            {t("access.invalidTenantHint")}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <AppButton type="button" variant="primary" onClick={() => navigate("/track")}>
              {t("access.invalidTenantTrackCta")}
            </AppButton>
            <AppButton type="button" variant="outline" onClick={() => navigate("/")}>
              {t("access.goHome")}
            </AppButton>
          </div>
        </div>
      </SecureCard>
    </div>
  );
}
