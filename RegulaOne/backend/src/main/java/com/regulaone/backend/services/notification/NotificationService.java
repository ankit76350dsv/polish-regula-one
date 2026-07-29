package com.regulaone.backend.services.notification;

import com.regulaone.backend.dto.notification.IngestResult;
import com.regulaone.backend.dto.notification.NotificationEvent;
import com.regulaone.backend.dto.notification.NotificationResponse;
import com.regulaone.backend.dto.notification.UpdatePreferenceRequest;
import com.regulaone.backend.models.User;
import com.regulaone.backend.models.notification.*;
import com.regulaone.backend.models.notification.enums.*;
import com.regulaone.backend.repository.NotificationIngestLogRepository;
import com.regulaone.backend.repository.NotificationPreferenceRepository;
import com.regulaone.backend.repository.NotificationRepository;
import com.regulaone.backend.services.notification.utils.RecipientResolver;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The heart of the notification Hub.
 *
 * Phase 1 scope: ingest an event → resolve recipients by permission (or explicit ids) → write
 * ONE in-app notification per recipient (the canonical store) → idempotency via the ingest log.
 * Plus the user-facing reads/writes (list, unread count, mark read, archive, delete) and
 * per-user preferences.
 *
 * Deferred to later phases (kept out so this compiles and runs with zero new infra):
 *   - email / push fan-out through a retrying outbox (Phase 3 / 5)
 *   - real-time SSE delivery (Phase 4)
 * Those hook in right after the in-app write below, gated by {@link NotificationPreference}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final NotificationIngestLogRepository ingestLogRepository;
    private final RecipientResolver recipientResolver;

    // ── Ingest (called by the internal API and, later, by in-process publishers) ──

    public IngestResult ingest(NotificationEvent event) {
        String tenantId = event.getTenantId();
        NotificationEventType type = NotificationEventType.fromCode(event.getEventType());
        String dedupeKey = event.getDedupeKey();

        // 1) Idempotency — a re-sent event with the same key does nothing.
        if (dedupeKey != null && !dedupeKey.isBlank()
                && ingestLogRepository.existsByTenantIdAndDedupeKey(tenantId, dedupeKey)) {
            log.info("[ingest]:1 Duplicate event suppressed — tenant={} dedupeKey={}", tenantId, dedupeKey);
            return IngestResult.builder()
                    .accepted(false).recipientCount(0).dedupeKey(dedupeKey)
                    .message("Duplicate event ignored").build();
        }

        // 2) Resolve recipients — explicit ids win; otherwise by audience permissions.
        List<User> recipients;
        if (event.getRecipientUserIds() != null && !event.getRecipientUserIds().isEmpty()) {
            recipients = recipientResolver.byIds(tenantId, event.getRecipientUserIds());
        } else {
            List<String> audience = (event.getAudiencePermissions() != null && !event.getAudiencePermissions().isEmpty())
                    ? event.getAudiencePermissions()
                    : type.getAudiencePermissions();
            recipients = recipientResolver.byPermissions(tenantId, audience);
        }

        NotificationSeverity severity = parseSeverity(event.getSeverity(), type.getSeverity());

        // 3) Write one in-app notification per recipient.
        int created = 0;
        for (User u : recipients) {
            Notification n = Notification.builder()
                    .tenantId(tenantId)
                    .recipientUserId(u.getId())
                    .eventType(type)
                    .sourceModule(event.getSourceModule())
                    .category(type.getCategory())
                    .severity(severity)
                    .sensitivity(type.getSensitivity())
                    .title(event.getTitle())
                    .body(event.getBody())
                    .relatedEntityType(event.getRelatedEntityType())
                    .relatedEntityId(event.getRelatedEntityId())
                    .status(NotificationStatus.UNREAD)
                    .createdAt(LocalDateTime.now())
                    .build();
            notificationRepository.save(n);
            created++;
            // ← later phases: enqueue EMAIL/PUSH outbox messages here, gated by preferences.
        }

        // 4) Record the ingest for idempotency + source audit.
        if (dedupeKey != null && !dedupeKey.isBlank()) {
            try {
                ingestLogRepository.save(NotificationIngestLog.builder()
                        .tenantId(tenantId).dedupeKey(dedupeKey).eventType(type.name())
                        .sourceModule(event.getSourceModule()).recipientCount(created)
                        .occurredAt(event.getOccurredAt()).processedAt(LocalDateTime.now()).build());
            } catch (DuplicateKeyException dup) {
                log.info("[ingest]:2 Concurrent duplicate — dedupeKey={}", dedupeKey);
            }
        }

        log.info("[ingest]:3 event={} tenant={} recipients={}", type, tenantId, created);
        return IngestResult.builder()
                .accepted(true).recipientCount(created).dedupeKey(dedupeKey)
                .message("Created " + created + " notification(s)").build();
    }

    // ── User-facing reads/writes (always tenant + recipient scoped) ───────────────

    // module is optional — when provided, results are restricted to that app (by sourceModule)
    // so a module's frontend only sees its own notifications. When null, all apps are returned.
    public Page<NotificationResponse> list(String tenantId, String userId, SourceModule module, String status, Pageable pageable) {
        boolean byStatus = status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status);
        boolean byApp = module != null;
        NotificationStatus st = byStatus ? NotificationStatus.valueOf(status.toUpperCase()) : null;

        Page<Notification> page;
        if (byApp && byStatus) {
            page = notificationRepository
                    .findByTenantIdAndRecipientUserIdAndSourceModuleAndStatusAndSoftDeletedFalseOrderByCreatedAtDesc(tenantId, userId, module, st, pageable);
        } else if (byApp) {
            page = notificationRepository
                    .findByTenantIdAndRecipientUserIdAndSourceModuleAndSoftDeletedFalseOrderByCreatedAtDesc(tenantId, userId, module, pageable);
        } else if (byStatus) {
            page = notificationRepository
                    .findByTenantIdAndRecipientUserIdAndStatusAndSoftDeletedFalseOrderByCreatedAtDesc(tenantId, userId, st, pageable);
        } else {
            page = notificationRepository
                    .findByTenantIdAndRecipientUserIdAndSoftDeletedFalseOrderByCreatedAtDesc(tenantId, userId, pageable);
        }
        return page.map(NotificationResponse::from);
    }

    public long unreadCount(String tenantId, String userId, SourceModule module) {
        if (module != null) {
            return notificationRepository
                    .countByTenantIdAndRecipientUserIdAndSourceModuleAndStatusAndSoftDeletedFalse(tenantId, userId, module, NotificationStatus.UNREAD);
        }
        return notificationRepository
                .countByTenantIdAndRecipientUserIdAndStatusAndSoftDeletedFalse(tenantId, userId, NotificationStatus.UNREAD);
    }

    public NotificationResponse get(String tenantId, String userId, SourceModule module, String id) {
        return NotificationResponse.from(load(tenantId, userId, module, id));
    }

    public NotificationResponse markRead(String tenantId, String userId, SourceModule module, String id) {
        Notification n = load(tenantId, userId, module, id);
        if (n.getStatus() == NotificationStatus.UNREAD) {
            n.setStatus(NotificationStatus.READ);
            n.setReadAt(LocalDateTime.now());
            notificationRepository.save(n);
        }
        return NotificationResponse.from(n);
    }

    // Marks unread as read. Scoped to one app when module is provided (so KSeFFlow's
    // "mark all read" doesn't clear another app's notifications), else across all apps.
    public int markAllRead(String tenantId, String userId, SourceModule module) {
        List<Notification> unread = (module != null)
                ? notificationRepository.findByTenantIdAndRecipientUserIdAndSourceModuleAndStatus(tenantId, userId, module, NotificationStatus.UNREAD)
                : notificationRepository.findByTenantIdAndRecipientUserIdAndStatus(tenantId, userId, NotificationStatus.UNREAD);
        LocalDateTime now = LocalDateTime.now();
        unread.forEach(n -> { n.setStatus(NotificationStatus.READ); n.setReadAt(now); });
        notificationRepository.saveAll(unread);
        return unread.size();
    }

    public NotificationResponse archive(String tenantId, String userId, SourceModule module, String id) {
        Notification n = load(tenantId, userId, module, id);
        n.setStatus(NotificationStatus.ARCHIVED);
        notificationRepository.save(n);
        return NotificationResponse.from(n);
    }

    public void delete(String tenantId, String userId, SourceModule module, String id) {
        Notification n = load(tenantId, userId, module, id);
        n.setSoftDeleted(true);
        n.setDeletedAt(LocalDateTime.now());
        notificationRepository.save(n);
    }

    private Notification load(String tenantId, String userId, SourceModule module, String id) {
        return notificationRepository.findByIdAndTenantIdAndRecipientUserIdAndSourceModuleAndSoftDeletedFalse(
                        id, tenantId, userId, module)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
    }

    // ── Preferences (auto-creates sensible defaults on first read) ────────────────

    public NotificationPreference getPreferences(String tenantId, String userId) {
        return preferenceRepository.findByUserId(userId)
                .orElseGet(() -> preferenceRepository.save(NotificationPreference.defaultsFor(tenantId, userId)));
    }

    public NotificationPreference updatePreferences(String tenantId, String userId, UpdatePreferenceRequest req) {
        NotificationPreference p = getPreferences(tenantId, userId);
        if (req.getChannelDefaults() != null)   p.setChannelDefaults(req.getChannelDefaults());
        if (req.getPerCategory() != null)        p.setPerCategory(req.getPerCategory());
        if (req.getQuietHoursEnabled() != null)  p.setQuietHoursEnabled(req.getQuietHoursEnabled());
        if (req.getQuietHoursFromHour() != null) p.setQuietHoursFromHour(req.getQuietHoursFromHour());
        if (req.getQuietHoursToHour() != null)   p.setQuietHoursToHour(req.getQuietHoursToHour());
        if (req.getTimezone() != null)           p.setTimezone(req.getTimezone());
        if (req.getDigestFrequency() != null)    p.setDigestFrequency(req.getDigestFrequency());
        p.setUpdatedAt(LocalDateTime.now());
        return preferenceRepository.save(p);
    }

    private NotificationSeverity parseSeverity(String override, NotificationSeverity fallback) {
        if (override == null || override.isBlank()) return fallback;
        try { return NotificationSeverity.valueOf(override.toUpperCase()); }
        catch (IllegalArgumentException e) { return fallback; }
    }

    //! ── Test helper (dev/QA only — gated by a config flag in the controller) ──────
    //
    // Creates one sample notification per event type, addressed ONLY to the calling user,
    // so the UI can be exercised end-to-end (every severity colour, category, read/unread,
    // archive, delete, filters) without needing a real business event. Self-targeted, so it
    // cannot reach anyone else's mailbox.
    public int createSelfTestNotifications(String tenantId, String userId) {
        NotificationEventType[] samples = {
                NotificationEventType.INVOICE_SUBMISSION_FAILED,
                NotificationEventType.INVOICE_RETRY_FAILED,
                NotificationEventType.INVOICE_SENT,
                NotificationEventType.KSEF_COMMUNICATION_FAILURE,
                NotificationEventType.KSEF_EMERGENCY_DECLARED,
                NotificationEventType.CERTIFICATE_ISSUE,
                NotificationEventType.WORKFLOW_APPROVAL_PENDING,
                NotificationEventType.TASK_ASSIGNED,
                NotificationEventType.COMPLIANCE_DEADLINE_APPROACHING,
                NotificationEventType.AUTH_SECURITY_EVENT,
        };
        int created = 0;
        for (NotificationEventType t : samples) {
            Notification n = Notification.builder()
                    .tenantId(tenantId)
                    .recipientUserId(userId)
                    .eventType(t)
                    .sourceModule(SourceModule.REGULAONE)
                    .category(t.getCategory())
                    .severity(t.getSeverity())
                    .sensitivity(t.getSensitivity())
                    .title("[TEST] " + t.name())
                    .body("Sample " + t.getSeverity() + " notification (" + t.getCategory()
                            + ") generated for UI testing.")
                    .relatedEntityType("TEST")
                    .relatedEntityId("test-" + t.name())
                    .status(NotificationStatus.UNREAD)
                    .createdAt(LocalDateTime.now())
                    .build();
            notificationRepository.save(n);
            created++;
        }
        log.info("[createSelfTestNotifications] created {} test notifications for user {}", created, userId);
        return created;
    }
}
