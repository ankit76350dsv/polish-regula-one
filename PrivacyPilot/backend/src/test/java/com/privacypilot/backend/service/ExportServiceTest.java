package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.export.ExportRequest;
import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.document.Breach;
import com.privacypilot.backend.model.document.PrivacyNotice;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.model.enums.export.ExportFormat;
import com.privacypilot.backend.model.enums.export.ExportTarget;
import com.privacypilot.backend.model.enums.notice.NoticeAudience;
import com.privacypilot.backend.repository.BreachRepository;
import com.privacypilot.backend.repository.PrivacyNoticeRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests that taking data OUT of PrivacyPilot always leaves an EXPORT line in the audit
 * trail — the gap that let the whole Art. 30 register be downloaded with no trace.
 *
 * Plain JUnit + Mockito: no Spring context, no database, no network, so it runs in CI.
 */
class ExportServiceTest {

    private static final String TENANT = "tenant-1";
    private static final AuditContext CTX =
            new AuditContext(TENANT, "Anna Kowalska", "PRIVACYPILOT_ADMIN", "10.0.0.5", "Firefox");

    private PrivacyNoticeRepository notices;
    private BreachRepository breaches;
    private AuditService auditService;
    private ExportService service;
    private AuthenticatedUser caller;

    @BeforeEach
    void setUp() {
        notices = mock(PrivacyNoticeRepository.class);
        breaches = mock(BreachRepository.class);
        auditService = mock(AuditService.class);
        service = new ExportService(notices, breaches, auditService);
        caller = new AuthenticatedUser("user-1", "Anna Kowalska", "anna@example.com",
                "ROLE_USER", TENANT, "ABC sp. z o.o.", "ACTIVE",
                List.of("PRIVACYPILOT_ADMIN"));
        when(auditService.record(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new AuditEntry());
    }

    private static ExportRequest request(ExportTarget target, ExportFormat format) {
        ExportRequest r = new ExportRequest();
        r.setTarget(target);
        r.setFormat(format);
        return r;
    }

    /** Grab the arguments the service passed to the audit writer. */
    private ArgumentCaptor<Map<String, Object>> captureAudit(AuditAction action,
                                                            AuditEntityType entityType) {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> values = ArgumentCaptor.forClass(Map.class);
        verify(auditService).record(eq(CTX), eq(action), eq(entityType),
                any(), any(), any(), values.capture());
        return values;
    }

    @Test
    @DisplayName("exporting the controller register writes an EXPORT line with count and filters")
    void recordsControllerRegisterExport() {
        ExportRequest r = request(ExportTarget.REGISTER_CONTROLLER, ExportFormat.CSV);
        r.setItemCount(42);
        r.setFilterSummary("department=hr; basis=consent");

        service.record(caller, r, CTX);

        Map<String, Object> values = captureAudit(AuditAction.EXPORT, AuditEntityType.REGISTER).getValue();
        assertEquals("register_controller", values.get("target"));
        assertEquals("csv", values.get("format"));
        assertEquals(42, values.get("itemCount"));
        assertEquals("department=hr; basis=consent", values.get("filters"));
    }

    @Test
    @DisplayName("exporting the audit trail is itself recorded in the audit trail")
    void recordsAuditTrailExport() {
        // CSV is what the UI produces — an auditor or UODO inspector opens it in a
        // spreadsheet (the before/after diffs travel as JSON text inside their cells).
        service.record(caller, request(ExportTarget.AUDIT_TRAIL, ExportFormat.CSV), CTX);

        Map<String, Object> values =
                captureAudit(AuditAction.EXPORT, AuditEntityType.AUDIT_TRAIL).getValue();
        assertEquals("audit_trail", values.get("target"));
        assertEquals("csv", values.get("format"));
        // A whole-list export has no single record, so no id is claimed.
        verify(auditService).record(any(), any(), any(), eq(null), any(), any(), any());
    }

    @Test
    @DisplayName("a whole-list export never touches the record repositories")
    void wholeListExportDoesNotLookUpRecords() {
        service.record(caller, request(ExportTarget.REGISTER_PROCESSOR, ExportFormat.CSV), CTX);
        verifyNoInteractions(notices, breaches);
    }

    @Test
    @DisplayName("an export line never carries a 'before' state — a copy changes nothing")
    void exportHasNoOldValue() {
        service.record(caller, request(ExportTarget.AUDIT_TRAIL, ExportFormat.JSON), CTX);
        verify(auditService).record(any(), any(), any(), any(), any(), eq(null), any());
    }

    @Test
    @DisplayName("omitted count and filters are simply left off the audit line")
    void omitsBlankDetails() {
        ExportRequest r = request(ExportTarget.AUDIT_TRAIL, ExportFormat.JSON);
        r.setFilterSummary("   ");

        service.record(caller, r, CTX);

        Map<String, Object> values =
                captureAudit(AuditAction.EXPORT, AuditEntityType.AUDIT_TRAIL).getValue();
        assertTrue(values.containsKey("target"));
        assertNull(values.get("itemCount"));
        assertNull(values.get("filters"));
    }

    @Test
    @DisplayName("printing a notice records the version that was printed")
    void recordsNoticeExportWithReadableLabel() {
        PrivacyNotice notice = new PrivacyNotice();
        notice.setId("notice-9");
        notice.setAudience(NoticeAudience.EMPLOYEES);
        notice.setVersion(3);
        when(notices.findByIdAndTenantIdAndDeletedFalse("notice-9", TENANT))
                .thenReturn(Optional.of(notice));

        ExportRequest r = request(ExportTarget.PRIVACY_NOTICE, ExportFormat.PRINT);
        r.setEntityId("notice-9");

        service.record(caller, r, CTX);

        ArgumentCaptor<String> label = ArgumentCaptor.forClass(String.class);
        verify(auditService).record(eq(CTX), eq(AuditAction.EXPORT), eq(AuditEntityType.NOTICE),
                eq("notice-9"), label.capture(), any(), any());
        assertTrue(label.getValue().contains("employees v3"), label.getValue());
    }

    @Test
    @DisplayName("copying a breach report is recorded like any other export")
    void recordsBreachReportClipboardExport() {
        Breach breach = new Breach();
        breach.setId("breach-4");
        breach.setTitle("Lost laptop");
        when(breaches.findByIdAndTenantIdAndDeletedFalse("breach-4", TENANT))
                .thenReturn(Optional.of(breach));

        ExportRequest r = request(ExportTarget.BREACH_REPORT, ExportFormat.CLIPBOARD);
        r.setEntityId("breach-4");

        service.record(caller, r, CTX);

        Map<String, Object> values =
                captureAudit(AuditAction.EXPORT, AuditEntityType.BREACH).getValue();
        assertEquals("clipboard", values.get("format"));
    }

    @Test
    @DisplayName("a single-document export with no id is rejected, and nothing is recorded")
    void refusesSingleDocumentExportWithoutId() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.record(caller, request(ExportTarget.PRIVACY_NOTICE, ExportFormat.MARKDOWN), CTX));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        verifyNoInteractions(auditService);
    }

    @Test
    @DisplayName("cannot record an export of another company's notice (tenant isolation)")
    void refusesForeignNotice() {
        // The tenant-scoped lookup finds nothing, which is what isolates the companies.
        when(notices.findByIdAndTenantIdAndDeletedFalse("notice-other", TENANT))
                .thenReturn(Optional.empty());
        ExportRequest r = request(ExportTarget.PRIVACY_NOTICE, ExportFormat.MARKDOWN);
        r.setEntityId("notice-other");

        ResponseStatusException ex =
                assertThrows(ResponseStatusException.class, () -> service.record(caller, r, CTX));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        // No audit line may be written about a record that is not ours.
        verifyNoInteractions(auditService);
    }

    @Test
    @DisplayName("cannot record an export of another company's breach (tenant isolation)")
    void refusesForeignBreach() {
        when(breaches.findByIdAndTenantIdAndDeletedFalse("breach-other", TENANT))
                .thenReturn(Optional.empty());
        ExportRequest r = request(ExportTarget.BREACH_REPORT, ExportFormat.WORD);
        r.setEntityId("breach-other");

        ResponseStatusException ex =
                assertThrows(ResponseStatusException.class, () -> service.record(caller, r, CTX));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        verifyNoInteractions(auditService);
    }
}
