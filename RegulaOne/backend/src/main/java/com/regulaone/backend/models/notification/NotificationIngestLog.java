package com.regulaone.backend.models.notification;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Idempotency + source-audit record for inbound events. A publishing module sends a stable
 * {@code dedupeKey} (e.g. "INVOICE_RETRY_FAILED:<invoiceId>"); if we have already processed
 * that key for the tenant, the event is ignored — so a module retrying its publish call never
 * produces duplicate notifications.
 */
@Document(collection = "notification_ingest_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(name = "tenant_dedupe_unique", def = "{'tenantId': 1, 'dedupeKey': 1}", unique = true)
public class NotificationIngestLog {

    @Id
    private String id;

    private String tenantId;
    private String dedupeKey;
    private String eventType;
    private SourceModule sourceModule;
    private int recipientCount;

    private LocalDateTime occurredAt;   // when the business event happened (from the publisher)
    @Builder.Default
    private LocalDateTime processedAt = LocalDateTime.now();
}
