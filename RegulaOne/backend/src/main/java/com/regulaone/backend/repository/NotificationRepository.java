package com.regulaone.backend.repository;

import com.regulaone.backend.models.notification.Notification;
import com.regulaone.backend.models.notification.enums.NotificationStatus;
import com.regulaone.backend.models.notification.enums.SourceModule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

// All queries are tenant + recipient scoped — a user only ever sees their own notifications.
// softDeleted=false everywhere so erased rows disappear from the UI immediately.
public interface NotificationRepository extends MongoRepository<Notification, String> {

    Page<Notification> findByTenantIdAndRecipientUserIdAndSoftDeletedFalseOrderByCreatedAtDesc(
            String tenantId, String recipientUserId, Pageable pageable);

    Page<Notification> findByTenantIdAndRecipientUserIdAndStatusAndSoftDeletedFalseOrderByCreatedAtDesc(
            String tenantId, String recipientUserId, NotificationStatus status, Pageable pageable);

    long countByTenantIdAndRecipientUserIdAndStatusAndSoftDeletedFalse(
            String tenantId, String recipientUserId, NotificationStatus status);

    Optional<Notification> findByIdAndTenantIdAndRecipientUserId(
            String id, String tenantId, String recipientUserId);

    // Used by mark-all-read.
    List<Notification> findByTenantIdAndRecipientUserIdAndStatus(
            String tenantId, String recipientUserId, NotificationStatus status);

    // ── Per-app variants (frontend passes ?module=KSEFFLOW so it only sees its own app) ──

    Page<Notification> findByTenantIdAndRecipientUserIdAndSourceModuleAndSoftDeletedFalseOrderByCreatedAtDesc(
            String tenantId, String recipientUserId, SourceModule sourceModule, Pageable pageable);

    Page<Notification> findByTenantIdAndRecipientUserIdAndSourceModuleAndStatusAndSoftDeletedFalseOrderByCreatedAtDesc(
            String tenantId, String recipientUserId, SourceModule sourceModule, NotificationStatus status, Pageable pageable);

    long countByTenantIdAndRecipientUserIdAndSourceModuleAndStatusAndSoftDeletedFalse(
            String tenantId, String recipientUserId, SourceModule sourceModule, NotificationStatus status);

    List<Notification> findByTenantIdAndRecipientUserIdAndSourceModuleAndStatus(
            String tenantId, String recipientUserId, SourceModule sourceModule, NotificationStatus status);
}
