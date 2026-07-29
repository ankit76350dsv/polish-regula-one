import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Clock, FileText, Inbox } from "lucide-react";
import { AppButton, EmptyState, ErrorState, PageSpinner, SecureCard, SeverityBadge, StatusBadge } from "../../components/ui";
import {
  fetchAttention,
  fetchDashboardStats,
  selectAttention,
  selectAttentionStatus,
  selectDashboardStats,
} from "../../slices/dashboardSlice";

export default function AdminDashboardPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const stats = useSelector(selectDashboardStats);
  // The list of cases waiting to be picked up (unassigned) — the handler's to-do list.
  const attention = useSelector(selectAttention);
  const attentionStatus = useSelector(selectAttentionStatus);

  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchAttention());
  }, [dispatch]);

  if (attentionStatus === "loading" && attention.length === 0) return <PageSpinner label={t("common.loading")} />;
  if (attentionStatus === "failed") return <ErrorState message={t("cases.loadError")} onRetry={() => dispatch(fetchAttention())} />;

  // Until the numbers load, show an em dash rather than a misleading 0.
  const stat = (value, suffix = "") => (stats ? `${value}${suffix}` : "—");
  // Three at-a-glance numbers a handler acts on: how many cases are open, how many have a
  // reply they have not read, and how many are still being answered on time.
  const cards = [
    { label: t("dashboard.openReports"), value: stat(stats?.openReports), icon: AlertOctagon, tone: "text-cyan-700 bg-cyan-50 border-cyan-200" },
    { label: t("dashboard.unreadReplies"), value: stat(stats?.unreadReplies), icon: Inbox, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: t("dashboard.slaMonitored"), value: stat(stats?.slaCompliancePercent, "%"), icon: Clock, tone: "text-amber-700 bg-amber-50 border-amber-200" },
  ];

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      <SecureCard title={t("dashboard.priorityQueue")} subtitle={t("dashboard.priorityQueueSub")}>
        {attention.length === 0 ? (
          <EmptyState title={t("dashboard.emptyQueue")} />
        ) : (
          <div className="space-y-3">
            {attention.map((report) => (
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
              </button>
            ))}
          </div>
        )}
      </SecureCard>
    </div>
  );
}
