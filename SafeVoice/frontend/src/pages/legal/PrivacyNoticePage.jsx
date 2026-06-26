import { useTranslation } from "react-i18next";
import { AppButton } from "../../components/ui";
import { LegalPage, LegalSection } from "../../components/compliance/LegalPage";

// GDPR Articles 13–14 privacy notice for the whistleblower channel.
export default function PrivacyNoticePage({ navigate }) {
  const { t } = useTranslation();
  const p = (k) => t(`compliance.privacy.${k}`);
  return (
    <LegalPage title={p("title")} navigate={navigate}>
      <p className="text-sm text-slate-600">{p("intro")}</p>
      <LegalSection title={p("controllerTitle")}><p>{p("controllerBody")}</p></LegalSection>
      <LegalSection title={p("dataTitle")}><p>{p("dataBody")}</p></LegalSection>
      <LegalSection title={p("basisTitle")}><p>{p("basisBody")}</p></LegalSection>
      <LegalSection title={p("retentionTitle")}><p>{p("retentionBody")}</p></LegalSection>
      <LegalSection title={p("rightsTitle")}>
        <p>{p("rightsBody")}</p>
        <AppButton type="button" variant="primary" size="sm" onClick={() => navigate?.("/data-request")}>
          {p("rightsRequest")}
        </AppButton>
      </LegalSection>
      <LegalSection title={p("recipientsTitle")}><p>{p("recipientsBody")}</p></LegalSection>
      <LegalSection title={p("complaintTitle")}><p>{p("complaintBody")}</p></LegalSection>
    </LegalPage>
  );
}
