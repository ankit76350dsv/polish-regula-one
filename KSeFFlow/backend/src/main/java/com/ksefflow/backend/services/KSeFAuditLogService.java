package com.ksefflow.backend.services;

import com.ksefflow.backend.models.KsefAuditLog;
import com.ksefflow.backend.repository.KsefAuditLogRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Single service for the KSeF audit trail — both writing immutable entries and
 * reading them back for the Compliance Audit Center.
 *
 * Writes go through the repository ({@link #writeAuditLog}); reads use MongoTemplate
 * for flexible server-side filtering ({@link #listAuditLogs}). The static write
 * methods let service-layer callers log without injecting this bean.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KSeFAuditLogService {

    private final MongoTemplate mongoTemplate;
    private final KsefAuditLogRepository auditLogRepository;

    // Static back-reference so service-layer callers can use writeAuditLog()
    // without injecting this bean. Set once during application startup via
    // @PostConstruct — guaranteed to be non-null before any HTTP request arrives.
    private static KSeFAuditLogService instance;

    @PostConstruct
    void init() {
        log.info("[init]:1 Registering static KSeFAuditLogService instance for service-layer audit writes");
        instance = this;
    }

    /**
     * Returns a paginated, filtered view of the audit log for a single tenant.
     *
     * All parameters except tenantId are optional.
     *
     * @param tenantId  mandatory tenant scope — cross-tenant access is never allowed
     * @param fromIso   ISO-8601 datetime lower bound (inclusive), e.g. "2026-01-01T00:00:00"
     * @param toIso     ISO-8601 datetime upper bound (inclusive)
     * @param role      exact userRole match (e.g. "Accountant", "Super Admin")
     * @param search    case-insensitive substring match across userEmail, action, ipAddress, newValue
     * @param pageable  page / size / sort — defaults to page=0, size=20, sort=timestamp desc
     */
    public Page<KsefAuditLog> listAuditLogs(
            String tenantId,
            String fromIso,
            String toIso,
            String role,
            String search,
            Pageable pageable) {
        log.info("[listAuditLogs]:1 Querying audit logs for tenant [{}] (role={} search={})",
                tenantId, role, search != null ? "[present]" : null);

        List<Criteria> criteriaList = new ArrayList<>();

        // Mandatory tenant isolation
        criteriaList.add(Criteria.where("tenantId").is(tenantId));

        // Optional date range
        LocalDateTime from = parseDateTime(fromIso);
        LocalDateTime to   = parseDateTime(toIso);
        if (from != null || to != null) {
            Criteria timeCriteria = Criteria.where("timestamp");
            if (from != null) timeCriteria = timeCriteria.gte(from);
            if (to   != null) timeCriteria = timeCriteria.lte(to);
            criteriaList.add(timeCriteria);
        }

        // Optional role filter (exact match)
        if (role != null && !role.isBlank() && !"ALL".equals(role)) {
            criteriaList.add(Criteria.where("userRole").is(role));
        }

        // Optional full-text search across audit-relevant string fields
        if (search != null && !search.isBlank()) {
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("userEmail").regex(search, "i"),
                    Criteria.where("action").regex(search, "i"),
                    Criteria.where("ipAddress").regex(search, "i"),
                    Criteria.where("newValue").regex(search, "i")
            ));
        }

        Criteria finalCriteria = new Criteria().andOperator(
                criteriaList.toArray(new Criteria[0]));

        // Separate count query (no pagination applied) for accurate totalElements
        Query countQuery = new Query(finalCriteria);
        long total = mongoTemplate.count(countQuery, KsefAuditLog.class);

        // Data query with sort + pagination
        Query dataQuery = new Query(finalCriteria)
                .with(org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "timestamp"))
                .with(pageable);
        List<KsefAuditLog> logs = mongoTemplate.find(dataQuery, KsefAuditLog.class);

        return new PageImpl<>(logs, pageable, total);
    }

    private LocalDateTime parseDateTime(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return LocalDateTime.parse(iso, DateTimeFormatter.ISO_DATE_TIME);
        } catch (DateTimeParseException e) {
            log.debug("[parseDateTime]:1 Ignoring unparseable datetime filter value: {}", iso);
            return null;
        }
    }

    // ── Write ─────────────────────────────────────────────────────────────────────

    /**
     * Writes an immutable audit log entry for an INVOICE entity.
     *
     * Backward-compatible convenience overload — delegates to the full method with
     * the entity type fixed to "INVOICE".
     *
     * @param tenantId   tenant that owns the audited entity
     * @param action     action code e.g. INVOICE_CREATED, INVOICE_SENT_TO_KSEF
     * @param entityId   MongoDB _id of the affected document
     * @param oldValue   previous state — null for CREATE operations
     * @param newValue   new state or descriptive detail
     * @param userEmail  email of the user who triggered the action (nullable)
     * @param ipAddress  client IP address extracted from the HTTP request (nullable)
     */
    public static void writeAuditLog(String tenantId, String action,
            String entityId, String oldValue, String newValue,
            String userEmail, String ipAddress) {
        writeAuditLog(tenantId, action, "INVOICE", entityId, oldValue, newValue, userEmail, ipAddress);
    }

    /**
     * Writes an immutable audit log entry for any entity type.
     *
     * @param tenantId    tenant that owns the audited entity
     * @param action      action code e.g. CERTIFICATE_UPLOADED, INVOICE_SENT_TO_KSEF
     * @param entityType  affected entity type e.g. "CERTIFICATE", "INVOICE", "SESSION"
     * @param entityId    MongoDB _id of the affected document
     * @param oldValue    previous state — null for CREATE operations
     * @param newValue    new state or descriptive detail (must never contain secrets)
     * @param userEmail   email of the user who triggered the action (nullable)
     * @param ipAddress   client IP address extracted from the HTTP request (nullable)
     */
    public static void writeAuditLog(String tenantId, String action, String entityType,
            String entityId, String oldValue, String newValue,
            String userEmail, String ipAddress) {
        log.info("[writeAuditLog]:1 Audit [{}] on {} [{}]", action, entityType, entityId);

        if (instance == null) {
            log.warn("[writeAuditLog]:2 KSeFAuditLogService bean not yet initialized — skipping log [action={}]", action);
            return;
        }

        try {
            instance.auditLogRepository.save(KsefAuditLog.builder()
                    .tenantId(tenantId)
                    .action(action)
                    .targetEntityType(entityType)
                    .targetEntityId(entityId)
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .userEmail(userEmail)
                    .ipAddress(ipAddress)
                    .complianceChecked(true)
                    .timestamp(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.error("[writeAuditLog]:3 Failed to write audit log [action={}] {} [{}]: {}",
                    action, entityType, entityId, e.getMessage());
        }
    }
}
