import { useTranslation } from "react-i18next";
import { LegalPage } from "../../components/compliance/LegalPage";

// Plain-language, step-by-step explanation of report handling — the "easily
// accessible information" the EU Directive (Art. 7/9) expects reporters to have.
export default function HowItWorksPage({ navigate }) {
  const { t } = useTranslation();
  const p = (k) => t(`compliance.howItWorks.${k}`);
  const steps = ["step1", "step2", "step3", "step4", "step5"];

  return (
    <LegalPage title={p("title")} navigate={navigate}>
      <p className="text-sm text-slate-600">{p("intro")}</p>
      <ol className="space-y-4 list-none">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-4">
            <span className="shrink-0 w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs font-bold font-mono">
              {i + 1}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{p(`${s}Title`)}</h2>
              <p className="text-sm text-slate-600 mt-0.5">{p(`${s}Body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </LegalPage>
  );
}
