import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppButton, SecureCard } from "../../components/ui";

export default function AccessDeniedPage({ navigate }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-xl mx-auto py-16">
      <SecureCard title={t("access.deniedTitle")}>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="flex items-center gap-3 text-amber-600">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>
          <p>{t("access.deniedBody")}</p>
          <AppButton type="button" variant="primary" onClick={() => navigate("/dashboard")}>
            {t("access.goToDashboard")}
          </AppButton>
        </div>
      </SecureCard>
    </div>
  );
}
