package com.ksefflow.backend.services;

import com.ksefflow.backend.models.KsefNotification;
import com.ksefflow.backend.models.utils.KsefNotificationType;
import com.ksefflow.backend.repository.KsefNotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

// SIMPLE EXPLANATION:
// This service is the one place that creates in-app notifications (the messages that show
// up in the notification bell inside KSeFFlow). Other services call it instead of talking to
// the database themselves, so notifications are always built the same correct way.
//
// A notification is always tied to a tenant. If we do not give a specific userId, the message
// is a broadcast — every user in that tenant sees it (for example "3 offline invoices could
// not be sent to KSeF before the deadline").
@Service
@RequiredArgsConstructor
@Slf4j
public class KsefNotificationService {

    private final KsefNotificationRepository notificationRepository;

    /**
     * Creates and saves one tenant-wide (broadcast) notification.
     *
     * @param tenantId          which company this message belongs to (required)
     * @param type              INFO / SUCCESS / WARN / ERROR — drives the colour/badge in the UI
     * @param title             short headline shown in bold
     * @param message           the full human-readable message
     * @param relatedEntityType optional deep-link type, e.g. "INVOICE", "CERTIFICATE", "QUEUE"
     * @param relatedEntityId   optional id the UI can open (e.g. the invoice id)
     * @return the saved notification
     */
    public KsefNotification notifyTenant(String tenantId,
                                         KsefNotificationType type,
                                         String title,
                                         String message,
                                         String relatedEntityType,
                                         String relatedEntityId) {
        KsefNotification notification = KsefNotification.builder()
                .tenantId(tenantId)
                .userId(null) // null = show to ALL users in this tenant
                .type(type)
                .title(title)
                .message(message)
                .relatedEntityType(relatedEntityType)
                .relatedEntityId(relatedEntityId)
                .build();

        KsefNotification saved = notificationRepository.save(notification);
        log.debug("[notifyTenant]:1 Created [{}] notification for tenant [{}]: {}", type, tenantId, title);
        return saved;
    }
}
