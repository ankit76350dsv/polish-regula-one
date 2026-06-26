import { Check, Copy, Lock, ShieldCheck } from "lucide-react";

export default function ReportSuccessPage() {
  return (
    <div className="max-w-xl mx-auto text-center py-6 leading-relaxed">
      <div className="inline-flex items-center justify-center h-16 w-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full mb-6">
        <ShieldCheck className="w-8 h-8" aria-hidden="true" />
      </div>

      <h1 className="text-xl font-bold text-slate-900 tracking-tight">
        Anonymous report ready for tracking
      </h1>
      <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
        This static page preserves the previous success flow. Code generation and persistence will be added in a later phase.
      </p>

      <div className="space-y-6 mt-8">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500/70" />
          <div className="flex flex-col gap-6 max-w-sm mx-auto">
            <div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono mb-2">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                Tracking code
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200 relative flex items-center justify-between">
                <span className="text-md font-mono text-slate-900 font-bold select-all tracking-wider">
                  SV-W4R9-M2Q7
                </span>
                <button
                  type="button"
                  aria-label="Copy tracking code"
                  className="text-slate-500 hover:text-cyan-600 hover:bg-slate-100 p-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono mb-2">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Access PIN (shown once)
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200 relative flex items-center justify-center">
                <span className="text-md font-mono text-slate-900 font-bold select-all tracking-wider">
                  482913
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-4 text-left leading-normal">
          Save this code and PIN outside the application. The UI does not store or recover reporter identity.
        </div>

        <div className="inline-flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Check className="w-4 h-4" aria-hidden="true" />
          Static success state only
        </div>
      </div>
    </div>
  );
}
