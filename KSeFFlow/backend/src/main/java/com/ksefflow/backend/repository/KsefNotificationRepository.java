package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

// Repository for the ksef_notifications collection.
public interface KsefNotificationRepository extends MongoRepository<KsefNotification, String> {

    // All notifications for a tenant, newest first — used to populate the notification panel
    List<KsefNotification> findByTenantIdOrderByCreatedAtDesc(String tenantId);

    // Unread count — drives the red badge number on the notification bell
    long countByTenantIdAndReadFalse(String tenantId);

    // User-specific notifications (userId == user) + tenant broadcasts (userId == null)
    List<KsefNotification> findByTenantIdAndUserIdOrTenantIdAndUserIdIsNullOrderByCreatedAtDesc(
            String tenantId, String userId, String tenantId2);

    // Unread notifications for a specific user — used to mark-all-read on panel open
    List<KsefNotification> findByTenantIdAndUserIdAndReadFalse(String tenantId, String userId);

    // Paginated history — for a "notification inbox" full-history view
    Page<KsefNotification> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);
}
