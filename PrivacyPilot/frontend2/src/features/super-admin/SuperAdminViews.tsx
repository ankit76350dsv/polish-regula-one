/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

export const SuperAdminViews: React.FC = () => {
  const { currentLanguage, tenants, tickets, platformLogs, showToast } = useApp();
  const [ticketReplyId, setTicketReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Recharts MRR Growth Data
  const revenueGrowthData = [
    { month: 'Jan', MRR: 45000, activeTenants: 40 },
    { month: 'Feb', MRR: 52000, activeTenants: 48 },
    { month: 'Mar', MRR: 64000, activeTenants: 59 },
    { month: 'Apr', MRR: 78000, activeTenants: 72 },
    { month: 'May', MRR: 95000, activeTenants: 86 },
    { month: 'Jun', MRR: 112000, activeTenants: 98 }
  ];

  const handleSendTicketReply = (ticketId: string) => {
    showToast(`Reply dispatched. Customer tenant notified.`, 'success');
    setTicketReplyId(null);
    setReplyText('');
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {currentLanguage === 'pl' ? 'Konsola Super Administratora' : 'Super Admin Control Center'}
        </h1>
        <p className="text-xs text-slate-500">Global SaaS platform metrics, multi-tenant billing logs, and support ticket registers.</p>
      </div>

      {/* Global MRR Charts */}
      <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Growth & Monthly Recurring Revenue (MRR)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <RechartsTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="MRR" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} name="Platform MRR (PLN)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        
        {/* Tenants List & Tickets list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Tenant Registries */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Customer Tenants</h3>
            <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
              {tenants.map((ten) => (
                <div key={ten.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 block">{ten.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {ten.id} — Plan: {ten.plan}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Active</span>
                </div>
              ))}
            </div>
          </div>

          {/* Support Ticket queues */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant Billing & Support Queue</h3>
            <div className="space-y-3">
              {tickets.map((t) => (
                <div key={t.id} className="p-3 bg-slate-50 border border-slate-150 rounded space-y-2.5">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-900">Ticket: {t.title}</span>
                    <span className="text-slate-400 text-[10px] font-mono">{t.id}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal bg-white p-2.5 rounded border border-slate-100">{t.content}</p>
                  
                  {ticketReplyId === t.id ? (
                    <div className="space-y-2 pt-2 border-t">
                      <textarea
                        rows={2}
                        placeholder="Type reply message..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-2 focus:outline-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setTicketReplyId(null)} className="px-3 py-1 bg-slate-200 rounded font-bold">Cancel</button>
                        <button onClick={() => handleSendTicketReply(t.id)} className="px-3 py-1 bg-blue-600 text-white rounded font-bold">Send Reply</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setTicketReplyId(t.id)}
                      className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ComplianceIcon name="FileText" size={12} /> Post Support Reply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Real-time platform syslog */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Core Logs</h3>
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {platformLogs.map((log) => (
                <div key={log.id} className="font-mono text-[10px] text-slate-500 border-b border-slate-50 pb-2">
                  <span className="text-slate-400 block">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <p className="text-slate-700 leading-tight mt-0.5"><strong className="text-blue-600">[{log.actor}]</strong> {log.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
