import { AnimatePresence, motion } from "motion/react";
import { useMotionProps } from "../a11y/motion";
import {
  AccessDeniedView,
  AdminDashboard,
  BrandedSettingsView,
  CaseDetailsView,
  CaseManagementGrid,
  CentralEncryptedInbox,
  PublicReportPortal,
  ReportSuccessView,
  SecurityAuditTrailLogs,
  TrackCaseView,
  UsersPermissionsMatrix,
} from "../components/Views";

function PageTransition({ children, routeKey, variant = "slide" }) {
  const m = useMotionProps();
  const variants = {
    scale: {
      initial: { opacity: 0, scale: 0.98 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, y: -10 },
    },
    slide: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
    },
  };

  return (
    <motion.div key={routeKey} {...m(variants[variant])}>
      {children}
    </motion.div>
  );
}

export default function SafeVoiceRoutes({
  auditLogs,
  currentDetailsCase,
  currentPath,
  handlers,
  lastSuccessCategory,
  lastSuccessCode,
  lastSuccessPin,
  messages,
  reports,
  selectedCaseId,
  staffPermission,
  users,
}) {
  return (
    <AnimatePresence mode="wait">
      {currentPath === "/report" && (
        <PageTransition key="report" routeKey="report">
          <PublicReportPortal onSubmitReport={handlers.submitReport} />
        </PageTransition>
      )}

      {currentPath === "/report/success" && (
        <PageTransition key="success" routeKey="success" variant="scale">
          <ReportSuccessView
            generatedCode={lastSuccessCode}
            pin={lastSuccessPin}
            category={lastSuccessCategory}
          />
        </PageTransition>
      )}

      {currentPath === "/track" && (
        <PageTransition key="track" routeKey="track">
          <TrackCaseView
            reports={reports}
            messages={messages}
            onAddMessage={handlers.addReporterMessage}
            onAddEvidence={handlers.addReporterEvidence}
          />
        </PageTransition>
      )}

      {currentPath === "/access-denied" && (
        <PageTransition key="denied" routeKey="denied">
          <AccessDeniedView onGoReport={handlers.goToReport} />
        </PageTransition>
      )}

      {currentPath === "/dashboard" && staffPermission && (
        <PageTransition key="dashboard" routeKey="dashboard">
          <AdminDashboard
            reports={reports}
            activeRole={staffPermission}
            onNavigateToCases={handlers.goToCases}
          />
        </PageTransition>
      )}

      {currentPath === "/cases" && staffPermission && (
        <PageTransition key="cases" routeKey="cases">
          <CaseManagementGrid
            reports={reports}
            activeRole={staffPermission}
            onSelectCase={handlers.selectCase}
          />
        </PageTransition>
      )}

      {currentPath === "/cases/:id" &&
        currentDetailsCase &&
        staffPermission && (
          <PageTransition
            key={`case-detail-${selectedCaseId}`}
            routeKey={`case-detail-${selectedCaseId}`}
          >
            <CaseDetailsView
              caseItem={currentDetailsCase}
              messages={messages}
              users={users}
              activeRole={staffPermission}
              onUpdateStatus={handlers.updateCaseStatus}
              onUpdateSeverity={handlers.updateCaseSeverity}
              onAssignInvestigator={handlers.assignInvestigator}
              onAddInternalNote={handlers.addInternalNote}
              onAddAdminMessage={handlers.addAdminMessage}
              onRetentionUpdate={handlers.updateRetention}
            />
          </PageTransition>
        )}

      {currentPath === "/messages" && staffPermission && (
        <PageTransition key="messages" routeKey="messages">
          <CentralEncryptedInbox
            reports={reports}
            messages={messages}
            activeRole={staffPermission}
            onAddAdminMessage={handlers.addAdminMessage}
          />
        </PageTransition>
      )}

      {currentPath === "/audits" && staffPermission && (
        <PageTransition key="audits" routeKey="audits">
          <SecurityAuditTrailLogs logs={auditLogs} activeRole={staffPermission} />
        </PageTransition>
      )}

      {currentPath === "/users" && staffPermission && (
        <PageTransition key="users" routeKey="users">
          <UsersPermissionsMatrix
            users={users}
            activeRole={staffPermission}
            onInviteUser={handlers.inviteOfficer}
          />
        </PageTransition>
      )}

      {currentPath === "/settings" && staffPermission && (
        <PageTransition key="settings" routeKey="settings">
          <BrandedSettingsView />
        </PageTransition>
      )}
    </AnimatePresence>
  );
}
