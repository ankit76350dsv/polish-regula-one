import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Clock, FileText, Inbox, ShieldCheck } from "lucide-react";
import { AppButton, EmptyState, ErrorState, PageSpinner, SecureCard, SeverityBadge, StatusBadge } from "../../components/ui";
import { fetchReports, selectReports, selectReportsStatus } from "../../slices/reportsSlice";

export default function AdminDashboardPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const reports = useSelector(selectReports);
  const status = useSelector(selectReportsStatus);

  useEffect(() => {
    if (status === "idle") dispatch(fetchReports());
  }, [status, dispatch]);

  if (status === "loading" && reports.length === 0) return <PageSpinner label={t("common.loading")} />;
  if (status === "failed") return <ErrorState message={t("cases.loadError")} onRetry={() => dispatch(fetchReports())} />;

  const open = reports.filter((r) => r.status !== "Closed");
  const cards = [
    { label: t("dashboard.openReports"), value: String(open.length), icon: AlertOctagon, tone: "text-cyan-700 bg-cyan-50 border-cyan-200" },
    { label: t("dashboard.unreadReplies"), value: "2", icon: Inbox, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: t("dashboard.slaMonitored"), value: "100%", icon: Clock, tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: t("dashboard.auditSealed"), value: String(reports.length), icon: ShieldCheck, tone: "text-violet-700 bg-violet-50 border-violet-200" },
  ];
  const posture = ["intake", "telemetry", "evidence", "retention", "audit"];

  return (
    <div className="space-y-8 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <AppButton type="button" variant="primary" icon={<FileText className="w-4 h-4" />} onClick={() => navigate("/cases")}>
          {t("dashboard.openRegister")}
        </AppButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-lg border p-4 bg-white ${card.tone}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">{card.label}</span>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SecureCard title={t("dashboard.priorityQueue")} subtitle={t("dashboard.priorityQueueSub")} className="lg:col-span-2">
          {open.length === 0 ? (
            <EmptyState title={t("dashboard.emptyQueue")} />
          ) : (
            <div className="space-y-3">
              {open.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => navigate(`/cases/${report.id}`)}
                  className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-white p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{report.caseReference || report.id}</div>
                      <div className="text-xs text-slate-500 mt-1">{t(`categories.${report.category}`, report.category)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={report.status} />
                      <SeverityBadge severity={report.severity} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-3 line-clamp-2">{report.description}</p>
                </button>
              ))}
            </div>
          )}
        </SecureCard>

        <SecureCard title={t("dashboard.postureTitle")} subtitle={t("dashboard.postureSub")}>
          <div className="space-y-3 text-xs text-slate-700">
            {posture.map((k) => (
              <div key={k} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span>{t(`dashboard.posture.${k}`)}</span>
                <span className="font-semibold text-emerald-700">{t(`dashboard.posture.${k}Value`)}</span>
              </div>
            ))}
          </div>
        </SecureCard>
      </div>
    </div>
  );
}
