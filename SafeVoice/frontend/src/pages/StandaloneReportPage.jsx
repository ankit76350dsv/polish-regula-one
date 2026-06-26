// The anonymous report page that opens in its OWN browser tab.
//
// Why this exists as a separate page:
// The normal SafeVoice screens live inside the staff shell (sidebar + top
// navbar + signed-in user info). A whistleblower must NOT see any of that.
// So when the address bar is /company/{tenantId}/report, App.jsx renders this
// page instead of the shell. There is:
//   - no navbar / sidebar
//   - no signed-in user, no sign-out button
//   - no SSO session bootstrap at all (App never mounts the shell here)
//
// The only thing this page knows is which company the report is for, taken
// from the URL (tenantId). It never asks the reporter who they are.
import { Lock, Shield } from "lucide-react";
import PublicReportPortal from "./PublicReportPortal.jsx";

export default function StandaloneReportPage({ tenantId }) {
  return (
    // A plain full-height page. It scrolls on its own and shares nothing with
    // the staff layout, so there is no chance of leaking session details.
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {/* A very small brand strip. It carries NO navigation links and NO user
          details — just the SafeVoice name and a reminder that this channel is
          anonymous. This is reassurance for the reporter, not a header menu. */}
      <div className="border-b border-slate-200 bg-white px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-cyan-600">
          <Shield className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="font-bold text-sm tracking-widest text-slate-900 uppercase">
            SafeVoice
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          Anonymous secure channel
        </div>
      </div>

      {/* The form fills the rest of the page. We pass the company id down so a
          later submission step can attach the report to the right tenant. */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20">
          <PublicReportPortal tenantId={tenantId} />
        </div>
      </main>
    </div>
  );
}
