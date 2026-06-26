import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Clock, FileText, Lock, Scale } from "lucide-react";
import { AppTable, PageSpinner, SecureCard } from "../../components/ui";
import { fetchSettings, selectComplianceReview, selectSettingsStatus } from "../../slices/settingsSlice";

const TABS = [
  { key: "security", icon: Lock },
  { key: "retention", icon: Clock },
  { key: "legal", icon: Scale },
  { key: "review", icon: FileText },
];

const SECURITY_ITEMS = ["mfa", "session", "revocation", "rateLimit", "telemetry", "monitoring"];
const RETENTION_ITEMS = ["default", "irrelevant", "hold", "destruction"];

export default function ComplianceSettingsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const review = useSelector(selectComplianceReview);
  const status = useSelector(selectSettingsStatus);
  const [tab, setTab] = useState("security");

  useEffect(() => {
    if (status === "idle") dispatch(fetchSettings());
  }, [status, dispatch]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto leading-relaxed">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("settings.title")}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Tab rail */}
        <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-1" role="tablist" aria-orientation="vertical">
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                tab === key ? "bg-slate-50 border border-slate-200 text-cyan-700" : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t(`settings.tab${key.charAt(0).toUpperCase() + key.slice(1)}`)}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-6">
          {tab === "security" && (
            <SecureCard title={t("settings.securityTitle")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {SECURITY_ITEMS.map((k) => (
                  <div key={k} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="font-bold text-slate-800">{t(`settings.security.${k}`)}</div>
                    <div className="text-slate-600 mt-1">{t(`settings.security.${k}Value`)}</div>
                  </div>
                ))}
              </div>
            </SecureCard>
          )}

          {tab === "retention" && (
            <SecureCard title={t("settings.retentionTitle")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
                {RETENTION_ITEMS.map((k) => (
                  <div key={k} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="font-bold text-slate-800">{t(`settings.retention.${k}Title`)}</div>
                    <div className="text-slate-600 mt-1">{t(`settings.retention.${k}Value`)}</div>
                  </div>
                ))}
              </div>
            </SecureCard>
          )}

          {tab === "legal" && (
            <SecureCard title={t("settings.legalTitle")}>
              <div className="space-y-4 text-xs text-slate-700">
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
                    <Scale className="w-4 h-4 text-cyan-700" aria-hidden="true" />
                    {t("settings.legal.basisTitle")}
                  </div>
                  <p className="text-slate-600">{t("settings.legal.basisValue")}</p>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
                    <FileText className="w-4 h-4 text-cyan-700" aria-hidden="true" />
                    {t("settings.legal.respTitle")}
                  </div>
                  <p className="text-slate-600">{t("settings.legal.respValue")}</p>
                </div>
              </div>
            </SecureCard>
          )}

          {tab === "review" && (
            <SecureCard title={t("settings.reviewTitle")}>
              {status === "loading" ? (
                <PageSpinner label={t("common.loading")} />
              ) : (
                <AppTable headers={[t("settings.review.colArea"), t("settings.review.colFeature"), t("settings.review.colDecision"), t("settings.review.colJustification"), t("settings.review.colRisk")]}>
                  {review.map((item) => (
                    <tr key={`${item.area}-${item.decision}`} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs font-bold text-slate-800">{item.area}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.feature}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="bg-cyan-50 border border-cyan-200 rounded px-2 py-1 text-cyan-700 font-mono">{item.decision}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{item.justification}</td>
                      <td className="px-4 py-3 text-xs text-amber-800 font-semibold">{item.risk}</td>
                    </tr>
                  ))}
                </AppTable>
              )}
            </SecureCard>
          )}
        </div>
      </div>
    </div>
  );
}
