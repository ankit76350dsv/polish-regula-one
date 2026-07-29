import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { LegalPage, LegalSection } from "../../components/compliance/LegalPage";

// Tells reporters about external authorities (Poland: the RPO). Directive Art. 7(3)
// requires that reporters are informed they can report externally and how.
export default function ExternalReportingPage({ navigate }) {
  const { t } = useTranslation();
  const p = (k) => t(`compliance.external.${k}`);
  return (
    <LegalPage title={p("title")} navigate={navigate}>
      <p className="text-sm text-slate-600">{p("intro")}</p>
      <LegalSection title={p("rpoTitle")}>
        <p>{p("rpoBody")}</p>
        <a
          href="https://bip.brpo.gov.pl/en/content/act-protection-whistleblowers"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 hover:underline"
        >
          brpo.gov.pl <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </LegalSection>
      <LegalSection title={p("euTitle")}><p>{p("euBody")}</p></LegalSection>
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg p-3.5">
        {p("note")}
      </div>
    </LegalPage>
  );
}
