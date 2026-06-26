import { ChevronRight, Search } from "lucide-react";
import { AppTable } from "../../components/ui";
import { auditLogs } from "../staticData";

export default function SecurityAuditTrailLogsPage() {
  return (
    <div className="space-y-6 leading-relaxed max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Security audit trail</h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable audit log layout with static rows.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 justify-between shadow-xs">
        <div className="relative w-full md:max-w-xs">
          <label htmlFor="audit-search" className="sr-only">Search audit logs</label>
          <input
            id="audit-search"
            type="text"
            defaultValue="access"
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" aria-hidden="true" />
          <span className="font-mono text-[10px] text-slate-700">WORM-style audit copy</span>
        </div>
      </div>

      <AppTable headers={["Timestamp", "Actor", "Action", "Subject", "Outcome", "Metadata", "Seal"]}>
        {auditLogs.map((log) => (
          <tr key={log.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
            <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
            <td className="px-4 py-3 text-xs text-slate-800">
              <div className="font-bold">{log.actorRole}</div>
              <div className="text-[10px] text-slate-500 font-mono">{log.actorRef}</div>
            </td>
            <td className="px-4 py-3 text-xs text-slate-700">{log.actionType}</td>
            <td className="px-4 py-3 text-xs font-mono text-slate-500">{log.subjectId}</td>
            <td className="px-4 py-3 text-xs text-emerald-700 font-semibold">{log.outcome}</td>
            <td className="px-4 py-3 text-xs text-slate-500 max-w-sm">
              {log.metadataNotice}
              {log.oldValue && log.newValue && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                  <span>{log.oldValue}</span>
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <span className="text-cyan-700">{log.newValue}</span>
                </div>
              )}
            </td>
            <td className="px-4 py-3 text-xs font-mono text-slate-400">{log.hashChain}</td>
          </tr>
        ))}
      </AppTable>
    </div>
  );
}
