package com.safevoice.backend.service.report;

import com.safevoice.backend.dto.CaseKeysResponse;
import com.safevoice.backend.dto.CaseSubmissionRequest;
import com.safevoice.backend.dto.CaseSubmissionResponse;
import com.safevoice.backend.dto.DataKeyResponse;
import com.safevoice.backend.dto.EncryptedPayloadDto;
import com.safevoice.backend.exception.CaseNotFoundException;
import com.safevoice.backend.exception.CaseReferenceConflictException;
import com.safevoice.backend.exception.TenantNotFoundException;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.document.Tenant;
import com.safevoice.backend.model.embedded.EncryptedPayload;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.enums.case_report.CaseSeverity;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.model.enums.case_report.DisclosureMode;
import com.safevoice.backend.model.enums.case_report.ReportCategory;
import com.safevoice.backend.repository.CaseMessageRepository;
import com.safevoice.backend.repository.CaseReportRepository;
import com.safevoice.backend.repository.RegulaOneUserRepository;
import com.safevoice.backend.repository.TenantRepository;
import com.safevoice.backend.service.AttachmentService;
import com.safevoice.backend.service.AuditLogService;
import com.safevoice.backend.service.crypto.EnvelopeEncryptionService;
import com.safevoice.backend.service.notification.SafeVoiceEmailNotificationService;
import com.safevoice.backend.service.report.utils.CaseReportUtils;
import com.safevoice.backend.websocket.CaseEventPublisher;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for CaseReportService — the core business service. Focus areas the compliance
 * review called out: report ENCRYPTION at submit, TENANT ISOLATION on reads, the anonymous
 * access-key flow, and the crypto key endpoints. Repositories and KMS are mocked (no DB/AWS).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT) // service has many branches; keep tests readable
class CaseReportServiceTest {

    @Mock private CaseReportRepository caseReportRepository;
    @Mock private CaseMessageRepository caseMessageRepository;
    @Mock private TenantRepository tenantRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private CaseEventPublisher caseEventPublisher;
    @Mock private AttachmentService attachmentService;
    @Mock private SafeVoiceEmailNotificationService emailNotificationService;
    @Mock private EnvelopeEncryptionService envelopeEncryptionService;
    @Mock private RegulaOneUserRepository regulaOneUserRepository;

    private CaseReportService service;

    @BeforeEach
    void setUp() {
        service = new CaseReportService(caseReportRepository, caseMessageRepository, tenantRepository,
                auditLogService, mongoTemplate, caseEventPublisher, attachmentService,
                emailNotificationService, envelopeEncryptionService, regulaOneUserRepository);
        ReflectionTestUtils.setField(service, "retentionYears", 5);
        ReflectionTestUtils.setField(service, "irrelevantReviewDays", 30);
        ReflectionTestUtils.setField(service, "allowPlaintextIntakeForLocalTesting", false);
    }

    private Tenant activeTenant() {
        Tenant t = new Tenant();
        t.setId("acme");
        t.setStatus("ACTIVE");
        t.setName("Acme");
        return t;
    }

    private CaseSubmissionRequest encryptedRequest(String categoryLabel) {
        CaseSubmissionRequest req = new CaseSubmissionRequest();
        req.setTenantId("acme");
        req.setCategory(categoryLabel);
        EncryptedPayloadDto dto = new EncryptedPayloadDto();
        dto.setCiphertext("CT");
        dto.setIv("IV");
        dto.setWrappedKey("WK");
        req.setEncryptedContent(dto);
        return req;
    }

    private void stubSuccessfulSaveChain() {
        when(tenantRepository.findById("acme")).thenReturn(Optional.of(activeTenant()));
        when(caseReportRepository.existsByTenantIdAndCaseReference(eq("acme"), anyString())).thenReturn(false);
        when(caseReportRepository.save(any(CaseReport.class))).thenAnswer(i -> i.getArgument(0));
        when(caseMessageRepository.countByTenantIdAndCaseIdAndReadByAdminFalse(any(), any())).thenReturn(0L);
    }

    // ── ENCRYPTION at submit ─────────────────────────────────────────────────────

    @Test
    void submit_normalReport_storesEncryptedContentAndReturnsAccessKey() {
        stubSuccessfulSaveChain();

        CaseSubmissionResponse resp = service.submit(encryptedRequest("Fraud"));

        assertThat(resp.getAccessKey()).isNotNull().matches("[0-9a-f]{64}");
        assertThat(resp.isHrOnly()).isFalse();

        ArgumentCaptor<CaseReport> captor = ArgumentCaptor.forClass(CaseReport.class);
        verify(caseReportRepository).save(captor.capture());
        CaseReport saved = captor.getValue();
        assertThat(saved.getEncryptedContent()).isNotNull();
        assertThat(saved.getEncryptedContent().getCiphertext()).isEqualTo("CT");
        assertThat(saved.getDescription()).isNull();              // no plaintext stored
        assertThat(saved.getKeyHash()).isNotNull().matches("[0-9a-f]{64}"); // only the hash
        assertThat(saved.getCategory()).isEqualTo(ReportCategory.FRAUD);
        verify(auditLogService).log(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void submit_hrGrievance_isAlsoEncryptedButGetsNoAccessKey() {
        stubSuccessfulSaveChain();

        CaseSubmissionResponse resp = service.submit(encryptedRequest("Individual HR Grievance"));

        assertThat(resp.isHrOnly()).isTrue();
        assertThat(resp.getAccessKey()).isNull(); // HR grievances get no anonymous key

        ArgumentCaptor<CaseReport> captor = ArgumentCaptor.forClass(CaseReport.class);
        verify(caseReportRepository).save(captor.capture());
        CaseReport saved = captor.getValue();
        assertThat(saved.getEncryptedContent()).isNotNull();      // HR now encrypted too
        assertThat(saved.getKeyHash()).isNull();
        assertThat(saved.getDisclosureMode()).isEqualTo(DisclosureMode.HR_HANDOFF);
    }

    @Test
    void submit_normalReport_rejectedWhenNoEncryptedContentAndPlaintextFlagOff() {
        when(tenantRepository.findById("acme")).thenReturn(Optional.of(activeTenant()));
        CaseSubmissionRequest req = new CaseSubmissionRequest();
        req.setTenantId("acme");
        req.setCategory("Fraud"); // no encryptedContent, no facts

        assertThatThrownBy(() -> service.submit(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("client-side encrypted");
    }

    @Test
    void submit_allowsPlaintextOnlyWhenLocalTestingFlagOn() {
        ReflectionTestUtils.setField(service, "allowPlaintextIntakeForLocalTesting", true);
        stubSuccessfulSaveChain();
        CaseSubmissionRequest req = new CaseSubmissionRequest();
        req.setTenantId("acme");
        req.setCategory("Fraud");
        req.setFacts("plain dev facts");

        service.submit(req);

        ArgumentCaptor<CaseReport> captor = ArgumentCaptor.forClass(CaseReport.class);
        verify(caseReportRepository).save(captor.capture());
        assertThat(captor.getValue().getDescription()).isEqualTo("plain dev facts");
        assertThat(captor.getValue().getEncryptedContent()).isNull();
    }

    @Test
    void submit_rejectsUnknownOrInactiveTenant() {
        when(tenantRepository.findById("acme")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.submit(encryptedRequest("Fraud")))
                .isInstanceOf(TenantNotFoundException.class);

        Tenant suspended = activeTenant();
        suspended.setStatus("SUSPENDED");
        when(tenantRepository.findById("acme")).thenReturn(Optional.of(suspended));
        assertThatThrownBy(() -> service.submit(encryptedRequest("Fraud")))
                .isInstanceOf(TenantNotFoundException.class);
    }

    @Test
    void submit_rejectsBlankTenant() {
        CaseSubmissionRequest req = encryptedRequest("Fraud");
        req.setTenantId("  ");
        assertThatThrownBy(() -> service.submit(req)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void submit_conflictsWhenReferenceAlreadyExistsThisMinute() {
        when(tenantRepository.findById("acme")).thenReturn(Optional.of(activeTenant()));
        when(caseReportRepository.existsByTenantIdAndCaseReference(eq("acme"), anyString())).thenReturn(true);
        assertThatThrownBy(() -> service.submit(encryptedRequest("Fraud")))
                .isInstanceOf(CaseReferenceConflictException.class);
    }

    // ── TENANT ISOLATION ─────────────────────────────────────────────────────────

    @Test
    void getById_returnsCaseOnlyForItsOwnTenant() {
        CaseReport r = new CaseReport();
        r.setId("c1");
        r.setTenantId("acme");
        r.setDeleted(false);
        when(caseReportRepository.findById("c1")).thenReturn(Optional.of(r));

        assertThat(service.getById("c1", "acme")).isSameAs(r);
        // A different tenant must NOT be able to read this case.
        assertThatThrownBy(() -> service.getById("c1", "other-org"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void getById_hidesDeletedOrMissingCases() {
        CaseReport deleted = new CaseReport();
        deleted.setId("c1");
        deleted.setTenantId("acme");
        deleted.setDeleted(true);
        when(caseReportRepository.findById("c1")).thenReturn(Optional.of(deleted));
        assertThatThrownBy(() -> service.getById("c1", "acme")).isInstanceOf(IllegalArgumentException.class);

        when(caseReportRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getById("missing", "acme")).isInstanceOf(IllegalArgumentException.class);
    }

    // ── ANONYMOUS ACCESS-KEY FLOW ────────────────────────────────────────────────

    @Test
    void resolveOwnedCase_requiresKeyToMatchThatExactCase() {
        String key = "the-secret-key";
        String hash = CaseReportUtils.sha256Hex(key);
        CaseReport r = new CaseReport();
        r.setId("c1");
        r.setTenantId("acme");
        r.setDeleted(false);
        r.setKeyHash(hash);
        when(caseReportRepository.findByKeyHash(hash)).thenReturn(Optional.of(r));

        assertThat(service.resolveOwnedCase(key, "c1")).isSameAs(r);
        // Valid key but WRONG case id → neutral not-found (no probing other cases).
        assertThatThrownBy(() -> service.resolveOwnedCase(key, "c2"))
                .isInstanceOf(CaseNotFoundException.class);
    }

    @Test
    void resolveOwnedCase_rejectsBlankKeyAndUnknownKey() {
        assertThatThrownBy(() -> service.resolveOwnedCase("  ", "c1"))
                .isInstanceOf(IllegalArgumentException.class);
        when(caseReportRepository.findByKeyHash(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.resolveOwnedCase("nope", "c1"))
                .isInstanceOf(CaseNotFoundException.class);
    }

    @Test
    void retrieveByAccessKey_returnsCaseAndAuditsAccess() {
        String key = "reporter-key";
        String hash = CaseReportUtils.sha256Hex(key);
        CaseReport r = new CaseReport();
        r.setId("c1");
        r.setTenantId("acme");
        r.setDeleted(false);
        r.setKeyHash(hash);
        when(caseReportRepository.findByKeyHash(hash)).thenReturn(Optional.of(r));

        assertThat(service.retrieveByAccessKey(key)).isSameAs(r);
        verify(auditLogService).log(eq("acme"), any(), any(), eq("c1"), any(), any(), any(), any());
    }

    @Test
    void retrieveByAccessKey_rejectsBlankAndMissing() {
        assertThatThrownBy(() -> service.retrieveByAccessKey("  "))
                .isInstanceOf(IllegalArgumentException.class);
        when(caseReportRepository.findByKeyHash(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.retrieveByAccessKey("nope"))
                .isInstanceOf(CaseNotFoundException.class);
    }

    // ── CRYPTO KEY ENDPOINTS ─────────────────────────────────────────────────────

    @Test
    void issueDataKey_delegatesToKmsForActiveTenant() {
        when(tenantRepository.findById("acme")).thenReturn(Optional.of(activeTenant()));
        DataKeyResponse dk = DataKeyResponse.builder().plaintextKey("p").wrappedKey("w").build();
        when(envelopeEncryptionService.generateDataKey("acme")).thenReturn(dk);

        assertThat(service.issueDataKey("acme")).isSameAs(dk);
        verify(envelopeEncryptionService).generateDataKey("acme");
    }

    @Test
    void issueDataKey_rejectsUnknownTenant() {
        when(tenantRepository.findById("ghost")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.issueDataKey("ghost"))
                .isInstanceOf(TenantNotFoundException.class);
    }

    @Test
    void buildReporterCaseKeys_unwrapsReportAndMessageKeys() {
        String key = "reader-key";
        String hash = CaseReportUtils.sha256Hex(key);
        CaseReport r = new CaseReport();
        r.setId("c1");
        r.setTenantId("acme");
        r.setDeleted(false);
        r.setKeyHash(hash);
        EncryptedPayload content = new EncryptedPayload();
        content.setWrappedKey("WK-report");
        r.setEncryptedContent(content);
        when(caseReportRepository.findByKeyHash(hash)).thenReturn(Optional.of(r));

        CaseMessage m = new CaseMessage();
        m.setId("m1");
        EncryptedPayload msgEnc = new EncryptedPayload();
        msgEnc.setWrappedKey("WK-msg");
        m.setEncryptedText(msgEnc);
        when(caseMessageRepository.findAllByTenantIdAndCaseIdOrderByTimestampAsc("acme", "c1"))
                .thenReturn(List.of(m));

        when(envelopeEncryptionService.unwrapDataKey("acme", "WK-report")).thenReturn("CONTENT-KEY");
        when(envelopeEncryptionService.unwrapDataKey("acme", "WK-msg")).thenReturn("MSG-KEY");

        CaseKeysResponse keys = service.buildReporterCaseKeys(key);

        assertThat(keys.getContentKey()).isEqualTo("CONTENT-KEY");
        assertThat(keys.getMessageKeys()).containsEntry("m1", "MSG-KEY");
    }

    @Test
    void buildStaffCaseKeys_unwrapsForCallersOwnTenant() {
        CaseReport r = new CaseReport();
        r.setId("c1");
        r.setTenantId("acme");
        r.setDeleted(false);
        EncryptedPayload content = new EncryptedPayload();
        content.setWrappedKey("WK-report");
        r.setEncryptedContent(content);
        when(caseReportRepository.findById("c1")).thenReturn(Optional.of(r));
        when(caseMessageRepository.findAllByTenantIdAndCaseIdOrderByTimestampAsc("acme", "c1"))
                .thenReturn(List.of());
        when(envelopeEncryptionService.unwrapDataKey("acme", "WK-report")).thenReturn("CONTENT-KEY");

        CaseKeysResponse keys = service.buildStaffCaseKeys("c1", "acme");

        assertThat(keys.getContentKey()).isEqualTo("CONTENT-KEY");
        assertThat(keys.getMessageKeys()).isEmpty();
    }

    // ── CASE UPDATES (status / severity / assignment / attachment) ───────────────

    private CaseReport existingCase() {
        CaseReport r = new CaseReport();
        r.setId("c1");
        r.setTenantId("acme");
        r.setDeleted(false);
        r.setStatus(CaseStatus.RECEIVED);
        r.setSeverity(CaseSeverity.MEDIUM);
        when(caseReportRepository.findById("c1")).thenReturn(Optional.of(r));
        when(caseReportRepository.save(any(CaseReport.class))).thenAnswer(i -> i.getArgument(0));
        return r;
    }

    @Test
    void updateStatus_changesStatusAndAudits() {
        CaseReport r = existingCase();
        service.updateStatus("c1", CaseStatus.INVESTIGATING, null, "acme", "SAFEVOICE_ADMIN", "u1");
        assertThat(r.getStatus()).isEqualTo(CaseStatus.INVESTIGATING);
        assertThat(r.getTimeline()).isNotEmpty();
        verify(caseReportRepository).save(r);
        verify(auditLogService).log(eq("acme"), any(), any(), eq("c1"), any(),
                eq("RECEIVED"), eq("INVESTIGATING"), any());
    }

    @Test
    void updateStatus_noOpWhenUnchanged() {
        CaseReport r = existingCase(); // already RECEIVED
        service.updateStatus("c1", CaseStatus.RECEIVED, null, "acme", "SAFEVOICE_ADMIN", "u1");
        verify(caseReportRepository, never()).save(any());
        verify(auditLogService, never()).log(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void updateSeverity_changesSeverityAndAudits() {
        CaseReport r = existingCase();
        service.updateSeverity("c1", CaseSeverity.CRITICAL, "acme", "SAFEVOICE_ADMIN", "u1");
        assertThat(r.getSeverity()).isEqualTo(CaseSeverity.CRITICAL);
        verify(auditLogService).log(eq("acme"), any(), any(), eq("c1"), any(),
                eq("MEDIUM"), eq("CRITICAL"), any());
    }

    @Test
    void assignInvestigator_setsInvestigatorAndAudits() {
        CaseReport r = existingCase();
        service.assignInvestigator("c1", "Anna Kowalska", "acme", "SAFEVOICE_ADMIN", "u1");
        assertThat(r.getAssignedInvestigator()).isEqualTo("Anna Kowalska");
        verify(caseReportRepository).save(r);
        verify(auditLogService).log(eq("acme"), any(), any(), eq("c1"), any(), any(),
                eq("Anna Kowalska"), any());
    }

    @Test
    void addAttachment_appendsAndAudits() {
        CaseReport r = existingCase();
        EvidenceAttachment att = new EvidenceAttachment();
        att.setId("att1");
        att.setDisplayName("Evidence (PDF)");
        att.setSha256Checksum("deadbeef");
        service.addAttachment("c1", att, "acme");
        assertThat(r.getAttachments()).contains(att);
        verify(caseReportRepository).save(r);
        verify(auditLogService).log(eq("acme"), any(), any(), eq("c1"), any(), any(),
                eq("att1"), any());
    }
}
