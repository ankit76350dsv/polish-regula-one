import { AlertCircle, Check, ChevronRight, Lock, Shield, Upload } from "lucide-react";
import { AppButton, SecureCard } from "../components/ui";
import { reportCategories } from "./staticData";

// tenantId says which company this report is for. It arrives from the URL
// (/company/{tenantId}/report) when the page is opened in its own tab. It is
// optional so the in-app preview still works without it. We never ask the
// reporter who THEY are — only which organisation the report concerns.
export default function PublicReportPortal({ tenantId }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start leading-relaxed">
      <div className="lg:col-span-2">
        <SecureCard
          isEncrypted
          title="Submit an anonymous report"
          subtitle="Step 1 of 2: facts and evidence"
        >
          <ol className="flex flex-wrap items-center gap-3 mb-6 bg-slate-100 p-3 rounded-lg border border-slate-200 list-none">
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold bg-cyan-600 text-white">
                1
              </span>
              <span className="text-xs text-slate-800 font-semibold">Report facts</span>
            </li>
            <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold bg-slate-200 text-slate-600">
                2
              </span>
              <span className="text-xs text-slate-500 font-semibold">Protection choices</span>
            </li>
          </ol>

          {/* Show which company this report will reach, when we know it from the
              URL. This is the only identity on the page — the organisation's,
              never the reporter's. */}
          {tenantId && (
            <p className="mb-6 text-[11px] font-mono text-slate-500">
              Reporting to organisation:{" "}
              <span className="font-bold text-slate-700">{tenantId}</span>
            </p>
          )}

          <div className="space-y-6">
            {/* Carry the company id with the form so a later submission step can
                attach the report to the right tenant. No reporter data is added. */}
            <input type="hidden" name="tenantId" value={tenantId ?? ""} />
            <div>
              <label
                htmlFor="report-category"
                className="text-xs font-bold text-slate-700 uppercase font-mono block mb-1.5"
              >
                Report category
              </label>
              <select
                id="report-category"
                defaultValue="Corruption"
                className="block w-full rounded-lg bg-white border border-slate-300 text-slate-900 px-3.5 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                {reportCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-bold block mb-1">HR grievances stay separate</span>
                  Individual labour disputes are shown as HR handoff items, not anonymous whistleblower cases.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Incident date
                <input
                  type="date"
                  defaultValue="2026-05-10"
                  className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Area involved
                <input
                  type="text"
                  defaultValue="Procurement"
                  className="rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase font-mono">
                Facts and context
              </span>
              <textarea
                rows={6}
                defaultValue="Describe what happened, when it happened, and who or what process was involved. Avoid details that could identify you unless they are necessary for follow-up."
                className="block w-full rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm p-3.5 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-[11px] text-slate-500">
                UI only: no validation or submission is active in this phase.
              </span>
            </label>

            <div>
              <span className="text-xs font-bold text-slate-700 uppercase font-mono block mb-2">
                Evidence
              </span>
              <div className="border-2 border-dashed rounded-lg p-5 text-center border-slate-300 bg-slate-50/70">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-slate-500" aria-hidden="true" />
                  <p className="text-xs font-semibold text-slate-700">
                    Drop PDF, PNG, JPG, XML, or DOCX evidence here
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Static placeholder only. Upload handling comes later.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-800 flex items-start gap-3">
              <Lock className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <span className="font-bold block mb-1">Anonymous by default</span>
                This page keeps the original protection copy and layout, but does not create records yet.
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-4">
              <AppButton type="button" variant="secure" icon={<Shield className="w-4 h-4" />}>
                Submit anonymous report
              </AppButton>
            </div>
          </div>
        </SecureCard>
      </div>

      <div className="space-y-6">
        <SecureCard title="Reporter safeguards" subtitle="Static compliance cues">
          <ul className="space-y-3 text-xs text-slate-700">
            {[
              "7-day acknowledgement and 3-month feedback window.",
              "No reporter telemetry shown to case handlers.",
              "Evidence references hide original filenames.",
              "Irrelevant personal data deletion window is visible.",
              "External reporting remains available.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SecureCard>

        <SecureCard title="Data minimization" subtitle="Not collected in reporter intake">
          <div className="grid gap-2 text-xs text-slate-700">
            {["Analytics", "Marketing pixels", "Device fingerprint", "Browser fingerprint", "Geolocation", "Reporter IP in case view"].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
              >
                <span>{item}</span>
                <span className="text-emerald-700 font-mono text-[10px] uppercase">
                  Not collected
                </span>
              </div>
            ))}
          </div>
        </SecureCard>
      </div>
    </div>
  );
}
