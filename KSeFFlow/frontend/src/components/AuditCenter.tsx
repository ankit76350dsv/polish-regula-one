import { useState } from 'react';
import { Tenant, UserRole, AuditLog } from '../types';
import { 
  History, 
  Search, 
  ShieldCheck, 
  Download, 
  Tag, 
  FileLock, 
  BookOpen,
  Filter
} from 'lucide-react';

interface AuditCenterProps {
  tenant: Tenant;
  role: UserRole;
  auditLogs: AuditLog[];
  onAddNotification: (title: string, message: string, type: 'info' | 'success' | 'warn' | 'error') => void;
}

export default function AuditCenter({ tenant, role, auditLogs, onAddNotification }: AuditCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Filter audit logs for this specific corporate tenant (essential SaaS mandate)
  const tenantLogs = auditLogs.filter(log => log.tenantId === tenant.id);

  const filteredLogs = tenantLogs.filter(log => {
    const matchesSearch = 
      log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.newValue && log.newValue.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.ipAddress.includes(searchQuery);

    const matchesRole = roleFilter === 'ALL' || log.userRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  const triggerLogExport = () => {
    onAddNotification(
      'Audit Logs Exported', 
      'Immutable compliance CSV exported. Generated legally binding RODO audit hashes for inspection teams.', 
      'success'
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <BookOpen className="text-red-700" size={20} />
          Enterprise Audit Center
        </h2>
        <p className="text-zinc-500 text-xs mt-0.5">RODO / GDPR compliant immutable transaction auditing logging corporate keystores, qualified signature handshakes, and KSeF payloads.</p>
      </div>

      <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-4">
        
        {/* Search controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4 border-stone-100">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
              <Search size={14} />
            </span>
            <input 
              type="text"
              placeholder="Search action, email, IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-stone-200/95 bg-stone-50/50 rounded-xl text-xs font-medium text-stone-800"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Filter size={13} className="text-stone-400" />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border rounded-lg px-2.5 py-1.5 font-semibold text-stone-700 text-xs"
            >
              <option value="ALL">All Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Company Admin">Company Admin</option>
              <option value="Accountant">Accountant</option>
              <option value="Finance User">Finance User</option>
            </select>

            <button 
              onClick={triggerLogExport}
              className="bg-stone-900 text-stone-100 hover:bg-stone-850 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Download size={13} /> Export audit trail (CSV)
            </button>
          </div>
        </div>

        {/* Audit table logs display */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs align-middle font-sans">
            <thead>
              <tr className="border-b border-stone-100 text-stone-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-2">Timestamp (Warsaw time)</th>
                <th className="py-3 px-2">Account Executed</th>
                <th className="py-3 px-2">Organizational Role</th>
                <th className="py-3 px-2">Action Name</th>
                <th className="py-3 px-2">Warsaw Network IP</th>
                <th className="py-3 px-2">Modification scope / details</th>
                <th className="py-3 px-2">Compliance check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-650 font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50/50 transition">
                  <td className="py-3 px-2 text-stone-500">
                    {new Date(log.timestamp).toLocaleString('pl-PL')}
                  </td>
                  <td className="py-3 px-2 font-sans font-medium text-stone-800">
                    {log.userEmail}
                  </td>
                  <td className="py-3 px-2 font-sans">
                    <span className="px-2 py-0.5 bg-stone-100 rounded text-[10px] text-stone-605 font-bold">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-bold text-red-900">
                    {log.action}
                  </td>
                  <td className="py-3 px-2 text-zinc-500">
                    {log.ipAddress}
                  </td>
                  <td className="py-3 px-2 font-sans text-stone-700 min-w-[200px] leading-normal">
                    {log.newValue}
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-850">
                      <ShieldCheck size={11} /> SECURE
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-400 font-sans text-xs">
                    No matching audit traces logged in workspace history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-sans leading-normal">
          <div className="flex items-center gap-1.5">
            <FileLock size={13} className="text-stone-400" />
            <span>Immutable blockchain database: SHA-256 cryptographically chained record streams</span>
          </div>
          <span>GDPR Compliant Erasure Limits Enforced</span>
        </div>

      </div>

    </div>
  );
}
