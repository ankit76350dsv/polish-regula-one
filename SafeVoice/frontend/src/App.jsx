import SafeVoiceLayout from "./layouts/SafeVoiceLayout";
import SafeVoiceRoutes from "./routes/SafeVoiceRoutes";
import { useSafeVoiceController } from "./hooks/useSafeVoiceController";

export default function App() {
  const safeVoice = useSafeVoiceController();

  const handlers = {
    addAdminMessage: safeVoice.handleAddAdminReplyMessage,
    addInternalNote: safeVoice.handleAddInternalNote,
    addReporterEvidence: safeVoice.handleReporterEvidenceSubmit,
    addReporterMessage: safeVoice.handleReporterMessageSubmit,
    assignInvestigator: safeVoice.handleAssignInvestigator,
    goToCases: () => safeVoice.navigateTo("/cases"),
    goToReport: () => safeVoice.navigateTo("/report"),
    inviteOfficer: safeVoice.handleInviteOfficerObj,
    selectCase: safeVoice.handleSelectCase,
    submitReport: safeVoice.handleFormReportSubmit,
    updateCaseSeverity: safeVoice.handleUpdateCaseSeverity,
    updateCaseStatus: safeVoice.handleUpdateCaseStatus,
    updateRetention: safeVoice.handleRetentionUpdate,
  };

  return (
    <SafeVoiceLayout
      activeRole={safeVoice.activeRole}
      currentPath={safeVoice.currentPath}
      messagesCount={safeVoice.messages.length}
      navigateTo={safeVoice.navigateTo}
      setRole={safeVoice.setRole}
    >
      <SafeVoiceRoutes
        auditLogs={safeVoice.auditLogs}
        currentDetailsCase={safeVoice.currentDetailsCase}
        currentPath={safeVoice.currentPath}
        handlers={handlers}
        lastSuccessCategory={safeVoice.lastSuccessCategory}
        lastSuccessCode={safeVoice.lastSuccessCode}
        lastSuccessPin={safeVoice.lastSuccessPin}
        messages={safeVoice.messages}
        reports={safeVoice.reports}
        selectedCaseId={safeVoice.selectedCaseId}
        staffPermission={safeVoice.staffPermission}
        users={safeVoice.users}
      />
    </SafeVoiceLayout>
  );
}
