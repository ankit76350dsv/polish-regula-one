/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { ComplianceIcon } from '../../components/common/icons';

export const TasksCenterView: React.FC = () => {
  const { tasks, notifications, currentLanguage, toggleTask, showToast } = useApp();
  const [activeTaskTab, setActiveTaskTab] = useState<'pending' | 'done' | 'overdue'>('pending');

  const filteredTasks = tasks.filter(t => {
    if (activeTaskTab === 'pending') return t.status === 'pending';
    if (activeTaskTab === 'done') return t.status === 'done';
    return t.status === 'overdue';
  });

  const handleTaskClick = (taskId: string) => {
    toggleTask(taskId);
    showToast('Compliance milestone updated', 'success');
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {currentLanguage === 'pl' ? 'Centrum Zadań Zgodności' : 'Compliance Task Management'}
        </h1>
        <p className="text-xs text-slate-500">
          {currentLanguage === 'pl' 
            ? 'Koordynacja zadań, rocznic przeglądu RCP, odnowień umów DPA i szkoleń.' 
            : 'Track statutory milestones, DPA renewal anniversaries, and mandatory employee trainings.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tasks side list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex gap-1 justify-between items-center">
            
            <div className="flex gap-1">
              {[
                { id: 'pending', pl: 'Oczekujące', en: 'Pending' },
                { id: 'overdue', pl: 'Zaległe', en: 'Overdue' },
                { id: 'done', pl: 'Zakończone', en: 'Completed' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer transition-all ${
                    activeTaskTab === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  {currentLanguage === 'pl' ? tab.pl : tab.en}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-slate-400 font-mono uppercase">
              Count: {filteredTasks.length}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden shadow-xs">
            {filteredTasks.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400 italic">No tasks mapped under this filter.</p>
            ) : (
              filteredTasks.map((t) => (
                <label
                  key={t.id}
                  className="p-4 flex items-start gap-3.5 hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={() => handleTaskClick(t.id)}
                    className="mt-1 text-blue-600 focus:ring-0"
                  />
                  <div className="text-xs flex-1">
                    <p className={`font-bold ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{t.title}</p>
                    <p className="text-slate-500 mt-0.5 leading-normal">{t.description}</p>
                    
                    <div className="flex items-center gap-3 mt-2 font-mono text-[9px] text-slate-400">
                      <span>Owner ID: {t.ownerId}</span>
                      <span>•</span>
                      <span className={t.status === 'overdue' ? 'text-red-500 font-bold' : ''}>Due: {t.dueDate}</span>
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Notifications list sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{currentLanguage === 'pl' ? 'Ostrzeżenia i Powiadomienia' : 'Notifications & Live Alerts'}</h3>
            
            <div className="space-y-3.5 text-xs">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="p-3 bg-slate-50 border border-slate-150 rounded space-y-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-900">{n.title}</span>
                    <span className={`text-[8px] uppercase font-bold px-1 rounded ${
                      n.type === 'error' ? 'bg-red-50 text-red-700' : n.type === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                    }`}>{n.type}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">{n.message}</p>
                  <span className="text-[9px] text-slate-400 font-mono block pt-1">{n.timestamp ? n.timestamp.split('T')[0] : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  function setActiveTab(tabId: 'pending' | 'done' | 'overdue') {
    setActiveTaskTab(tabId);
  }
};
