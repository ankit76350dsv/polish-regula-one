import { Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppButton, SecureCard } from "../../components/ui";

// Distinct 404 page so a mistyped URL does not look like an access problem.
export default function NotFoundPage({ navigate }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-xl mx-auto py-16">
      <SecureCard title={t("access.notFoundTitle")}>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="flex items-center gap-3 text-cyan-600">
            <Compass className="w-6 h-6" aria-hidden="true" />
          </div>
          <p>{t("access.notFoundBody")}</p>
          {/* "Go home" works from any world (public or staff); "Track report" is a
              public-safe action. We avoid linking straight to a staff page so a
              mistyped public URL never forces an unnecessary login. */}
          <div className="flex flex-wrap gap-2">
            <AppButton type="button" variant="primary" onClick={() => navigate("/")}>
              {t("access.goHome")}
            </AppButton>
            <AppButton type="button" variant="outline" onClick={() => navigate("/track")}>
              {t("nav.trackReport")}
            </AppButton>
          </div>
        </div>
      </SecureCard>
    </div>
  );
}
