import { Search } from "lucide-react";
import { AppButton, AppTable } from "../../components/ui";
import { reports, severityClasses, statusClasses } from "../staticData";

export default function CaseManagementPage({ navigate }) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Case register</h1>
          <p className="text-xs text-slate-500 mt-1">
            Static register of report cases, preserving the previous staff workflow.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 justify-between shadow-xs">
        <div className="relative w-full md:max-w-xs">
          <label htmlFor="case-search" className="sr-only">Search cases</label>
          <input
            id="case-search"
            type="text"
            defaultValue="SV-2026"
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {["All cases", "Critical", "Unassigned", "Feedback due"].map((label) => (
            <button
              key={label}
              type="button"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AppTable headers={["Case", "Category", "Status", "Severity", "Investigator", "Feedback due", ""]}>
        {reports.map((report) => (
          <tr key={report.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
            <td className="px-4 py-3 text-xs">
              <div className="font-bold text-slate-900">{report.id}</div>
              <div className="text-[10px] text-slate-500 font-mono">{report.trackingCode}</div>
            </td>
            <td className="px-4 py-3 text-xs text-slate-700">{report.category}</td>
            <td className="px-4 py-3 text-xs">
              <span className={`inline-flex rounded border px-2 py-1 font-semibold ${statusClasses[report.status]}`}>
                {report.status}
              </span>
            </td>
            <td className="px-4 py-3 text-xs">
              <span className={`inline-flex rounded border px-2 py-1 font-semibold ${severityClasses[report.severity]}`}>
                {report.severity}
              </span>
            </td>
            <td className="px-4 py-3 text-xs text-slate-700">{report.assignedInvestigator}</td>
            <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{report.feedbackDue}</td>
            <td className="px-4 py-3 text-right">
              <AppButton type="button" size="sm" variant="outline" onClick={() => navigate(`/cases/${report.id}`)}>
                Open
              </AppButton>
            </td>
          </tr>
        ))}
      </AppTable>
    </div>
  );
}
