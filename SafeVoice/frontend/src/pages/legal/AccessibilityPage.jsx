import { useTranslation } from "react-i18next";
import { LegalPage, LegalSection } from "../../components/compliance/LegalPage";

export default function AccessibilityPage({ navigate }) {
  const { t } = useTranslation();
  const p = (k) => t(`compliance.accessibility.${k}`);
  return (
    <LegalPage title={p("title")} navigate={navigate}>
      <p className="text-sm text-slate-600">{p("intro")}</p>
      <LegalSection title={p("statusTitle")}><p>{p("statusBody")}</p></LegalSection>
      <LegalSection title={p("feedbackTitle")}><p>{p("feedbackBody")}</p></LegalSection>
    </LegalPage>
  );
}
