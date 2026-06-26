import { AlertOctagon, Clock, FileText, Inbox, ShieldCheck } from "lucide-react";
import { AppButton, SecureCard } from "../components/ui";
import { reports } from "./staticData";

const dashboardCards = [
  { label: "Open reports", value: "3", icon: AlertOctagon, tone: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  { label: "Unread replies", value: "2", icon: Inbox, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { label: "SLA monitored", value: "100%", icon: Clock, tone: "text-amber-700 bg-amber-50 border-amber-200" },
  { label: "Audit sealed", value: "3", icon: ShieldCheck, tone: "text-violet-700 bg-violet-50 border-violet-200" },
];

export default function AdminDashboardPage({ navigate }) {
  return (
    <div className="space-y-8 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Case operations</h1>
          <p className="text-xs text-slate-500 mt-1">
            Static dashboard layout for the SafeVoice staff workspace.
          </p>
        </div>
        <AppButton type="button" variant="primary" icon={<FileText className="w-4 h-4" />} onClick={() => navigate("/cases")}>
          Open case register
        </AppButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {dashboardCards.map((card) => {
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
        <SecureCard title="Priority queue" subtitle="Cases needing attention" className="lg:col-span-2">
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => navigate(`/cases/${report.id}`)}
                className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-white p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{report.id}</div>
                    <div className="text-xs text-slate-500 mt-1">{report.category}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded border border-cyan-200 bg-cyan-50 px-2 py-1 text-cyan-700">
                      {report.status}
                    </span>
                    <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                      {report.severity}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-3 line-clamp-2">{report.description}</p>
              </button>
            ))}
          </div>
        </SecureCard>

        <SecureCard title="Compliance posture" subtitle="UI-only indicators">
          <div className="space-y-3 text-xs text-slate-700">
            {[
              ["Anonymous intake", "Active"],
              ["Reporter telemetry", "Not shown"],
              ["Evidence metadata", "Sanitized"],
              ["Retention policy", "Visible"],
              ["Audit trail", "Tamper-evident"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span>{label}</span>
                <span className="font-semibold text-emerald-700">{value}</span>
              </div>
            ))}
          </div>
        </SecureCard>
      </div>
    </div>
  );
}
