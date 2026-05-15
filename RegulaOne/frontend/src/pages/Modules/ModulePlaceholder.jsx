import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function ModulePlaceholder() {
  const location = useLocation();
  const moduleName = location.pathname.split('/').pop();

  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-6 max-w-7xl mx-auto">
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-200/50">
        <ShieldAlert className="h-16 w-16 text-red-500 animate-pulse" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight capitalize">Module: {moduleName}</h3>
        <p className="text-slate-500 max-w-md text-center font-medium">
          The <span className="text-red-600 font-bold uppercase tracking-wider">{moduleName}</span> integration is currently being provisioned for your organization node.
          Compliance features will be accessible once the sync is complete.
        </p>
      </div>
      <div className="flex gap-3">
        <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"></div>
      </div>
    </div>
  );
}
