package com.ksefflow.backend.services;

import java.time.LocalDateTime;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import com.ksefflow.backend.models.KsefAuditLog;
import com.ksefflow.backend.repository.KsefAuditLogRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
@Service
public class AuditLog {

    // Instance field — properly injected by Spring via @RequiredArgsConstructor.
    private final KsefAuditLogRepository auditLogRepository;

    // Static back-reference so service-layer callers can use writeAuditLog()
    // without injecting this bean. Set once during application startup via
    // @PostConstruct — guaranteed to be non-null before any HTTP request arrives.
    private static AuditLog instance;

    @PostConstruct
    void init() {
        instance = this;
    }

    /**
     * Writes an immutable audit log entry.
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

        if (instance == null) {
            log.warn("AuditLog bean not yet initialized — skipping log [action={}]", action);
            return;
        }

        try {
            instance.auditLogRepository.save(KsefAuditLog.builder()
                    .tenantId(tenantId)
                    .action(action)
                    .targetEntityType("INVOICE")
                    .targetEntityId(entityId)
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .userEmail(userEmail)
                    .ipAddress(ipAddress)
                    .complianceChecked(true)
                    .timestamp(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.error("Failed to write audit log [action={}] invoice [{}]: {}",
                    action, entityId, e.getMessage());
        }
    }
}
