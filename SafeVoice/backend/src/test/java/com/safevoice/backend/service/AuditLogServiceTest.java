package com.safevoice.backend.service;

import com.safevoice.backend.model.document.AuditLog;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.repository.AuditLogRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the tamper-evident audit hash chain — the record auditors rely on.
 * We build a real 2-entry chain through log() (no DB), then prove verifyChain() accepts an
 * intact chain and detects a tampered entry.
 */
@ExtendWith(MockitoExtension.class)
class AuditLogServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;
    @Mock
    private MongoTemplate mongoTemplate;

    private AuditLogService service() {
        return new AuditLogService(auditLogRepository, mongoTemplate);
    }

    private AuditLog log(AuditLogService svc, String newValue) {
        return svc.log("acme", "Ankit Kumar", AuditActionType.REPORT_RECEIVED,
                "case-1", AuditOutcome.RECORDED, null, newValue, "notice");
    }

    @Test
    void log_firstEntryLinksToGenesisAndProducesHash() {
        AuditLogService svc = service();
        when(auditLogRepository.findFirstByTenantIdOrderByTimestampDesc("acme")).thenReturn(null);
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(i -> i.getArgument(0));

        AuditLog first = log(svc, "v1");

        assertThat(first.getHashChain()).isNotNull().matches("[0-9a-f]{64}");
        assertThat(first.getTenantId()).isEqualTo("acme");
        assertThat(first.getActionType()).isEqualTo(AuditActionType.REPORT_RECEIVED);
    }

    @Test
    void log_secondEntryChainsToTheFirst() {
        AuditLogService svc = service();
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(i -> i.getArgument(0));
        // First call: no previous entry. Second call: the first entry is the previous.
        when(auditLogRepository.findFirstByTenantIdOrderByTimestampDesc("acme")).thenReturn(null);
        AuditLog first = log(svc, "v1");
        when(auditLogRepository.findFirstByTenantIdOrderByTimestampDesc("acme")).thenReturn(first);
        AuditLog second = log(svc, "v2");

        // Different entries → different links; the chain moved forward.
        assertThat(second.getHashChain()).isNotEqualTo(first.getHashChain());
    }

    @Test
    void verifyChain_acceptsAnIntactChain() {
        AuditLogService svc = service();
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(i -> i.getArgument(0));
        when(auditLogRepository.findFirstByTenantIdOrderByTimestampDesc("acme")).thenReturn(null);
        AuditLog first = log(svc, "v1").toBuilder().id("id1").build();
        when(auditLogRepository.findFirstByTenantIdOrderByTimestampDesc("acme")).thenReturn(first);
        AuditLog second = log(svc, "v2").toBuilder().id("id2").build();

        when(mongoTemplate.find(any(Query.class), eq(AuditLog.class)))
                .thenReturn(List.of(first, second));

        AuditLogService.AuditChainVerification result = svc.verifyChain("acme");

        assertThat(result.verified()).isTrue();
        assertThat(result.entriesChecked()).isEqualTo(2);
        assertThat(result.firstBrokenId()).isNull();
    }

    @Test
    void verifyChain_detectsATamperedEntry() {
        AuditLogService svc = service();
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(i -> i.getArgument(0));
        when(auditLogRepository.findFirstByTenantIdOrderByTimestampDesc("acme")).thenReturn(null);
        AuditLog first = log(svc, "v1").toBuilder().id("id1").build();
        when(auditLogRepository.findFirstByTenantIdOrderByTimestampDesc("acme")).thenReturn(first);
        AuditLog second = log(svc, "v2").toBuilder().id("id2").build();

        // Simulate a direct-DB edit: change a field but keep the OLD stored hash.
        AuditLog tampered = first.toBuilder().newValue("HACKED").build();
        when(mongoTemplate.find(any(Query.class), eq(AuditLog.class)))
                .thenReturn(List.of(tampered, second));

        AuditLogService.AuditChainVerification result = svc.verifyChain("acme");

        assertThat(result.verified()).isFalse();
        assertThat(result.firstBrokenId()).isEqualTo("id1");
    }

    @Test
    void verifyChain_rejectsBlankTenant() {
        assertThatThrownBy(() -> service().verifyChain("  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void search_returnsPagedResults() {
        AuditLogService svc = service();
        AuditLog entry = AuditLog.builder().id("a1").tenantId("acme")
                .actionType(AuditActionType.REPORT_RECEIVED).outcome(AuditOutcome.RECORDED).build();
        when(mongoTemplate.count(any(Query.class), eq(AuditLog.class))).thenReturn(1L);
        when(mongoTemplate.find(any(Query.class), eq(AuditLog.class))).thenReturn(List.of(entry));

        var page = svc.search("acme", null, null, null, null, null, null, 1, 20);

        assertThat(page.getItems()).containsExactly(entry);
        assertThat(page.getTotal()).isEqualTo(1L);
        assertThat(page.getPage()).isEqualTo(1);
        assertThat(page.getTotalPages()).isEqualTo(1);
    }

    @Test
    void search_appliesFiltersAndDateRangeWithoutError() {
        AuditLogService svc = service();
        when(mongoTemplate.count(any(Query.class), eq(AuditLog.class))).thenReturn(0L);
        when(mongoTemplate.find(any(Query.class), eq(AuditLog.class))).thenReturn(List.of());

        // Exercises enum parsing + date-range parsing (from/to) branches.
        var page = svc.search("acme", "fraud", "REPORT_RECEIVED", "RECORDED", "case-1",
                "2026-01-01", "2026-12-31", 0, 999);

        assertThat(page.getItems()).isEmpty();
        // page < 1 is clamped to 1; size over the max is clamped to 200.
        assertThat(page.getPage()).isEqualTo(1);
        assertThat(page.getSize()).isEqualTo(200);
    }

    @Test
    void search_rejectsBlankTenant() {
        assertThatThrownBy(() -> service().search("  ", null, null, null, null, null, null, 1, 20))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
