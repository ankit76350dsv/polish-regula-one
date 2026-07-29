package com.safevoice.backend.service;

import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.retention.RetentionState;
import com.safevoice.backend.repository.CaseMessageRepository;
import com.safevoice.backend.repository.CaseReportRepository;
import com.safevoice.backend.service.jobs.RetentionService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the retention/destruction job — the GDPR "storage limitation" enforcer.
 * Verifies that an expired case has its files purged, its thread deleted, its PII stripped,
 * and an audit entry written; and that an empty run does nothing.
 */
@ExtendWith(MockitoExtension.class)
class RetentionServiceTest {

    @Mock
    private CaseReportRepository caseReportRepository;
    @Mock
    private CaseMessageRepository caseMessageRepository;
    @Mock
    private AttachmentService attachmentService;
    @Mock
    private AuditLogService auditLogService;

    private RetentionService service() {
        return new RetentionService(caseReportRepository, caseMessageRepository,
                attachmentService, auditLogService);
    }

    private EvidenceAttachment attachmentWithRef(String ref) {
        EvidenceAttachment a = new EvidenceAttachment();
        a.setStorageVaultRef(ref);
        return a;
    }

    @Test
    void purge_doesNothingWhenNothingIsDue() {
        when(caseReportRepository.findDueForDeletion(any(Instant.class))).thenReturn(List.of());

        service().purgeExpiredCases();

        verify(attachmentService, never()).delete(any());
        verify(caseReportRepository, never()).save(any());
    }

    @Test
    void purge_destroysExpiredCaseAndStripsPersonalData() {
        CaseReport report = new CaseReport();
        report.setId("case-1");
        report.setTenantId("acme");
        report.setDescription("sensitive narrative");
        report.setKeyHash("somehash");
        report.getRetention().setState(RetentionState.ACTIVE);
        report.getRetention().setRetentionYears(5);
        report.getAttachments().add(attachmentWithRef("s3/case-file"));

        CaseMessage message = new CaseMessage();
        message.setId("m1");
        message.getAttachments().add(attachmentWithRef("s3/msg-file"));

        when(caseReportRepository.findDueForDeletion(any(Instant.class))).thenReturn(List.of(report));
        when(caseMessageRepository.findAllByTenantIdAndCaseIdOrderByTimestampAsc("acme", "case-1"))
                .thenReturn(List.of(message));
        when(caseReportRepository.save(any(CaseReport.class))).thenAnswer(i -> i.getArgument(0));

        service().purgeExpiredCases();

        // Both the case file AND the thread file are purged from S3.
        verify(attachmentService).delete("s3/case-file");
        verify(attachmentService).delete("s3/msg-file");
        // The thread is deleted.
        verify(caseMessageRepository).deleteAll(List.of(message));
        // PII is stripped and the case is marked destroyed + soft-deleted.
        assertThat(report.getDescription()).isNull();
        assertThat(report.getKeyHash()).isNull();
        assertThat(report.getAttachments()).isEmpty();
        assertThat(report.getRetention().getState()).isEqualTo(RetentionState.DESTROYED);
        assertThat(report.isDeleted()).isTrue();
        assertThat(report.getDeletedAt()).isNotNull();
        verify(caseReportRepository).save(report);
        // An immutable audit entry records the destruction.
        verify(auditLogService).log(eq("acme"), eq("System"),
                eq(AuditActionType.RETENTION_UPDATED), eq("case-1"), any(), any(), any(), any());
    }
}
