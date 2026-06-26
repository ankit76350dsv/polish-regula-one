import { FileText, Lock, Send, ShieldCheck } from "lucide-react";
import { AppButton, AppTable, SecureCard, TimelineWidget } from "../../components/ui";
import { messages, reports, severityClasses, statusClasses, users } from "../staticData";

export default function CaseDetailsPage({ caseId }) {
  const report = reports.find((item) => item.id === caseId) ?? reports[0];
  const reportMessages = messages.filter((message) => message.caseId === report.id);

  return (
    <div className="space-y-6 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">{report.id}</h1>
            <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusClasses[report.status]}`}>
              {report.status}
            </span>
            <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${severityClasses[report.severity]}`}>
              {report.severity}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {report.category} submitted via {report.intakeChannel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AppButton type="button" variant="outline" icon={<FileText className="w-4 h-4" />}>
            Export summary
          </AppButton>
          <AppButton type="button" variant="secure" icon={<ShieldCheck className="w-4 h-4" />}>
            Mark reviewed
          </AppButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SecureCard isEncrypted title="Case narrative" subtitle="Reporter-provided facts">
            <p className="text-sm text-slate-700 leading-relaxed">{report.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5 text-xs">
              {[
                ["Incident date", report.incidentDate],
                ["Department", report.department],
                ["Disclosure mode", report.disclosureMode],
                ["Lawful basis", report.lawfulBasis],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-500">{label}</div>
                  <div className="mt-1 text-slate-800">{value}</div>
                </div>
              ))}
            </div>
          </SecureCard>

          <SecureCard title="Evidence references" subtitle="Original filenames hidden in the UI">
            {report.attachments.length > 0 ? (
              <AppTable headers={["Reference", "Size", "Storage note"]}>
                {report.attachments.map((file) => (
                  <tr key={file.id} className="border-b border-slate-200">
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{file.displayName}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{file.sizeLabel}</td>
                    <td className="px-4 py-3 text-xs text-emerald-700">Metadata stripped</td>
                  </tr>
                ))}
              </AppTable>
            ) : (
              <p className="text-xs text-slate-500">No evidence attached.</p>
            )}
          </SecureCard>

          <SecureCard title="Timeline" subtitle="Static case activity">
            <TimelineWidget events={report.timeline} />
          </SecureCard>
        </div>

        <div className="space-y-6">
          <SecureCard title="Case controls" subtitle="Inactive controls for layout only">
            <div className="space-y-4">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Status
                <select defaultValue={report.status} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
                  {["Received", "Acknowledged", "Triage", "Investigating", "Awaiting Reporter", "Remediation", "Closed"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Severity
                <select defaultValue={report.severity} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
                  {["Low", "Medium", "High", "Critical"].map((severity) => (
                    <option key={severity}>{severity}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Investigator
                <select defaultValue={report.assignedInvestigator} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
                  {users.map((user) => (
                    <option key={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </SecureCard>

          <SecureCard title="Retention" subtitle={report.retention.state}>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>Delete after</span>
                <span className="font-mono">{report.retention.deleteAfter}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>Irrelevant data due</span>
                <span className="font-mono">{report.retention.irrelevantPersonalDataDeletionDue}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span>Retention years</span>
                <span className="font-mono">{report.retention.retentionYears}</span>
              </div>
            </div>
          </SecureCard>

          <SecureCard title="Risk flags">
            <div className="flex flex-wrap gap-2">
              {report.riskFlags.map((flag) => (
                <span key={flag} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                  {flag}
                </span>
              ))}
            </div>
          </SecureCard>
        </div>
      </div>

      <SecureCard isEncrypted title="Reporter communication" subtitle="Static staff-side message composer">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            {reportMessages.map((message) => (
              <div key={message.id} className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800">{message.sender}</span>
                  <span className="font-mono text-[10px] text-slate-500">{message.timestamp}</span>
                </div>
                <p className="mt-2 text-slate-700">{message.text}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <input
              defaultValue="Request a follow-up detail without asking the reporter to identify themselves."
              className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            <AppButton type="button" variant="primary" icon={<Send className="w-4 h-4" />}>
              Send
            </AppButton>
          </div>
          <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            This composer is visual only. Messaging behavior will be implemented later.
          </div>
        </div>
      </SecureCard>
    </div>
  );
}
