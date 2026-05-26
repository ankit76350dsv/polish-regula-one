package com.ksefflow.backend.services;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.ksefflow.backend.models.KsefAuditLog;
import com.ksefflow.backend.repository.KsefAuditLogRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
@Service
public class AuditLog {
    private static KsefAuditLogRepository audit_log_repository;

    public static void writeAuditLog(String tenantId, String action,
            String entityId, String oldValue, String newValue) {
        try {
            audit_log_repository.save(KsefAuditLog.builder()
                    .tenantId(tenantId)
                    .action(action)
                    .targetEntityType("INVOICE")
                    .targetEntityId(entityId)
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .complianceChecked(true)
                    .timestamp(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.error("Failed to write audit log [action={}] invoice [{}]: {}",
                    action, entityId, e.getMessage());
        }
    }
}
