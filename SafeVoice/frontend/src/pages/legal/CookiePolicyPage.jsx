import { useTranslation } from "react-i18next";
import { AppTable } from "../../components/ui";
import { LegalPage, LegalSection } from "../../components/compliance/LegalPage";

export default function CookiePolicyPage({ navigate }) {
  const { t } = useTranslation();
  const p = (k) => t(`compliance.cookies.${k}`);

  // The complete list of storage SafeVoice uses — all strictly necessary.
  const rows = [
    { name: "idToken", purpose: p("necessaryBody"), type: "httpOnly cookie", retention: "Session" },
    { name: "safevoice_lang", purpose: t("nav.language"), type: "localStorage", retention: "1 year" },
  ];

  return (
    <LegalPage title={p("title")} navigate={navigate}>
      <p className="text-sm text-slate-600">{p("intro")}</p>
      <LegalSection title={p("necessaryTitle")}><p>{p("necessaryBody")}</p></LegalSection>
      <LegalSection title={p("consentTitle")}><p>{p("consentBody")}</p></LegalSection>
      <AppTable headers={[p("tableName"), p("tablePurpose"), p("tableType"), p("tableRetention")]}>
        {rows.map((r) => (
          <tr key={r.name} className="border-b border-slate-200">
            <td className="px-4 py-3 text-xs font-mono font-bold text-slate-800">{r.name}</td>
            <td className="px-4 py-3 text-xs text-slate-600">{r.purpose}</td>
            <td className="px-4 py-3 text-xs text-slate-600">{r.type}</td>
            <td className="px-4 py-3 text-xs text-slate-600">{r.retention}</td>
          </tr>
        ))}
      </AppTable>
    </LegalPage>
  );
}
