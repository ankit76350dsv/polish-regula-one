import { Clock, FileText, Lock, Scale, UserCheck } from "lucide-react";
import { AppTable, SecureCard } from "../../components/ui";
import { complianceReview } from "../staticData";

const securityItems = [
  ["MFA", "Required for all staff roles; no bypass role"],
  ["Session expiry", "15 minute idle timeout; 8 hour absolute maximum"],
  ["Session revocation", "Immediate revocation for role changes or suspected compromise"],
  ["Rate limiting", "Public tracking and intake endpoints must be rate-limited without fingerprinting"],
  ["No telemetry", "No analytics, marketing pixels, or browser fingerprinting"],
  ["Login monitoring", "Security operations only; not exposed to case investigators"],
];

export default function ComplianceSettingsPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-6xl mx-auto items-start leading-relaxed">
      <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-1">
        {[
          ["Security", Lock],
          ["Retention", Clock],
          ["Legal basis", Scale],
          ["Review log", FileText],
        ].map(([label, Icon], index) => (
          <button
            key={label}
            type="button"
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
              index === 0
                ? "bg-slate-50 border border-slate-200 text-cyan-700"
                : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="lg:col-span-3 space-y-6">
        <SecureCard title="Administrative security" subtitle="Static settings layout">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {securityItems.map(([label, value]) => (
              <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="font-bold text-slate-800">{label}</div>
                <div className="text-slate-600 mt-1">{value}</div>
              </div>
            ))}
          </div>
        </SecureCard>

        <SecureCard title="Retention policy" subtitle="Visible policy state only">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-800">Default retention</div>
              <div className="text-slate-600 mt-1">Three years for standard whistleblower cases in this UI draft.</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-800">Irrelevant data</div>
              <div className="text-slate-600 mt-1">14-day deletion window displayed on case details.</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-800">Legal hold</div>
              <div className="text-slate-600 mt-1">Visual state for preserving case materials when a legal hold applies.</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-800">Secure destruction</div>
              <div className="text-slate-600 mt-1">Deletion workflow copy only. No task scheduling exists yet.</div>
            </div>
          </div>
        </SecureCard>

        <SecureCard title="Legal responsibilities" subtitle="Controller and processor summary">
          <div className="space-y-4 text-xs text-slate-700">
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
                <Scale className="w-4 h-4 text-cyan-700" aria-hidden="true" />
                Processing basis
              </div>
              <p className="text-slate-600">
                Legal obligation, protected follow-up, anti-retaliation handling, and GDPR storage limitation.
              </p>
            </div>
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
                <UserCheck className="w-4 h-4 text-cyan-700" aria-hidden="true" />
                Responsibilities
              </div>
              <p className="text-slate-600">
                Authorized officers handle cases; security operations handle access monitoring; HR handles separated grievances.
              </p>
            </div>
          </div>
        </SecureCard>

        <SecureCard title="Compliance review decisions" subtitle="Old implementation cleanup notes preserved as UI">
          <AppTable headers={["Area", "Feature", "Decision", "Justification", "Risk"]}>
            {complianceReview.map((item) => (
              <tr key={`${item.area}-${item.decision}`} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-3 text-xs font-bold text-slate-800">{item.area}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{item.feature}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="bg-cyan-50 border border-cyan-200 rounded px-2 py-1 text-cyan-700 font-mono">
                    {item.decision}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{item.justification}</td>
                <td className="px-4 py-3 text-xs text-amber-800 font-semibold">{item.risk}</td>
              </tr>
            ))}
          </AppTable>
        </SecureCard>
      </div>
    </div>
  );
}
