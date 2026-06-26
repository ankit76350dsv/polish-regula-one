import { useTranslation } from "react-i18next";
import { LegalPage, LegalSection } from "../../components/compliance/LegalPage";

export default function TermsPage({ navigate }) {
  const { t } = useTranslation();
  const p = (k) => t(`compliance.terms.${k}`);
  return (
    <LegalPage title={p("title")} navigate={navigate}>
      <p className="text-sm text-slate-600">{p("intro")}</p>
      <LegalSection title={p("useTitle")}><p>{p("useBody")}</p></LegalSection>
      <LegalSection title={p("protectionTitle")}><p>{p("protectionBody")}</p></LegalSection>
      <LegalSection title={p("scopeTitle")}><p>{p("scopeBody")}</p></LegalSection>
    </LegalPage>
  );
}
