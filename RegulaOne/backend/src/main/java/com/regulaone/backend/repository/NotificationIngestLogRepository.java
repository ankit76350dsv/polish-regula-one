package com.regulaone.backend.repository;

import com.regulaone.backend.models.notification.NotificationIngestLog;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface NotificationIngestLogRepository extends MongoRepository<NotificationIngestLog, String> {
    boolean existsByTenantIdAndDedupeKey(String tenantId, String dedupeKey);
}
