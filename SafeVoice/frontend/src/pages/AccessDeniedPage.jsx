import { Shield } from "lucide-react";
import { AppButton, SecureCard } from "../components/ui";

export default function AccessDeniedPage({ navigate }) {
  return (
    <div className="max-w-xl mx-auto py-16">
      <SecureCard
        title="Access denied"
        subtitle="This page mirrors the previous unauthorized access screen without adding route protection."
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Staff-only areas were previously gated by role checks. Phase 2 keeps the page structure only, so this route simply renders the message as a standalone page.
          </p>
          <AppButton
            type="button"
            variant="secure"
            icon={<Shield className="w-4 h-4" />}
            onClick={() => navigate("/report")}
          >
            Return to public portal
          </AppButton>
        </div>
      </SecureCard>
    </div>
  );
}
