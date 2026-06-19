package com.ksefflow.backend.services.retry;

import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.notification.HubNotificationPublisher;
import com.ksefflow.backend.repository.KsefInvoiceRepository;
import com.ksefflow.backend.services.KSeFAuditLogService;
import com.ksefflow.backend.services.KSeFInvoiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * KsefRetryQueueService — the offline retry queue (Phase 5).
 *
 * SIMPLE EXPLANATION (why this exists):
 * When KSeF cannot be reached, an invoice is "parked" with status OFFLINE_MODE and a legal
 * DEADLINE by which it MUST reach KSeF (next business day for offline24 / unavailability,
 * 7 business days for a Ministry-declared emergency). The law does not accept "the network
 * was down" forever — the invoice still has to get into KSeF. This background job is what
 * actually keeps trying to send those parked invoices until they succeed or the deadline is
 * missed, so a human does not have to remember to click "retry".
 *
 * What it does, every interval:
 *   1. Find every invoice that is OFFLINE_MODE or RETRYING (across all tenants — this is the
 *      platform-wide cron).
 *   2. For each one:
 *      - If the legal deadline has already passed and it is still not sent → mark it FAILED and
 *        alert the tenant (a human must now act; the legal window was missed).
 *      - If it has been retried too many times → mark it FAILED and alert (safety stop).
 *      - If it is not yet "due" (we wait longer and longer between tries — exponential backoff)
 *        → skip it this round.
 *      - Otherwise → ask KSeFInvoiceService to try sending it again.
 *   3. One bad invoice never stops the others — each is handled inside its own try/catch.
 *
 * Legal basis for the deadlines: Polish VAT Act art. 106nda (offline24) and art. 106nf
 * (tryb awaryjny). See COMPLIANCE_GAP_ANALYSIS.md item C4 and the official MF pages.
 *
 * NOTE (holidays): the deadline itself is computed in KSeFInvoiceService and currently skips
 * weekends only, not Polish public holidays. A holiday calendar should be added before relying
 * on this for hard, same-day-of-deadline cutoffs.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KsefRetryQueueService {

    private final KsefInvoiceRepository invoiceRepository;
    private final KSeFInvoiceService invoiceService;
    // Notifications go to the centralized Hub (RegulaOne), not a local store.
    private final HubNotificationPublisher hubPublisher;

    // The "user" recorded in audit logs for actions taken by this automatic job (no real person).
    private static final String SYSTEM_ACTOR = "system@ksefflow";
    private static final String SYSTEM_IP = "scheduler";

    // ── Tunables (all overridable from application-{profile}.properties) ─────────

    // Master on/off switch for the whole retry job.
    @Value("${ksef.retry.enabled:true}")
    private boolean enabled;

    // Safety stop: after this many total attempts, give up auto-retrying and ask a human.
    @Value("${ksef.retry.max-attempts:10}")
    private int maxAttempts;

    // Backoff: wait this many seconds before the FIRST retry, then double each time…
    @Value("${ksef.retry.base-backoff-seconds:60}")
    private long baseBackoffSeconds;

    // …but never wait longer than this between retries.
    @Value("${ksef.retry.max-backoff-seconds:3600}")
    private long maxBackoffSeconds;

    // ── The scheduled job ────────────────────────────────────────────────────────

    /**
     * Runs on a fixed delay (default: every 5 minutes, first run 2 minutes after start-up).
     * "fixedDelay" means the next run starts this many ms AFTER the previous run finishes, so
     * runs never pile up on top of each other even if one round is slow.
     */
    @Scheduled(
            fixedDelayString = "${ksef.retry.interval-ms:300000}",
            initialDelayString = "${ksef.retry.initial-delay-ms:120000}")
    public void processOfflineQueue() {
        if (!enabled) {
            return;
        }

        // Collect everything waiting to be (re)sent. findByStatus is platform-wide on purpose
        // — this is the single global cron, and each invoice already carries its own tenantId.
        List<KsefInvoice> queue = new ArrayList<>();
        queue.addAll(invoiceRepository.findByStatus(KsefInvoiceStatus.OFFLINE_MODE));
        queue.addAll(invoiceRepository.findByStatus(KsefInvoiceStatus.RETRYING));

        if (queue.isEmpty()) {
            log.debug("[processOfflineQueue]:1 No offline/retrying invoices to process");
            return;
        }

        log.info("[processOfflineQueue]:2 Processing offline retry queue — {} invoice(s) waiting", queue.size());
        LocalDateTime now = LocalDateTime.now();
        int sent = 0, requeued = 0, failed = 0, skipped = 0;

        for (KsefInvoice invoice : queue) {
            try {
                // (a) Legal deadline already missed → escalate to a human, stop auto-retrying.
                if (isDeadlineBreached(invoice, now)) {
                    failQueueItem(invoice,
                            "Legal KSeF submission deadline was missed (deadline " + invoice.getKsefSubmissionDeadline()
                                    + "). Manual submission and review required.");
                    failed++;
                    continue;
                }

                // (b) Too many attempts → safety stop, escalate to a human.
                if (invoice.getSubmissionAttempts() >= maxAttempts) {
                    failQueueItem(invoice,
                            "Automatic retries exhausted (" + invoice.getSubmissionAttempts() + " attempts). Manual review required.");
                    failed++;
                    continue;
                }

                // (c) Not due yet (still inside its backoff wait) → leave it for a later round.
                if (!isDueForRetry(invoice, now)) {
                    skipped++;
                    continue;
                }

                // (d) Due → try to send it again.
                KsefInvoice result = invoiceService.resubmitOffline(invoice, SYSTEM_ACTOR, SYSTEM_IP);
                if (result.getStatus() == KsefInvoiceStatus.SENT) {
                    sent++;
                    hubPublisher.publishInvoiceEvent("INVOICE_SENT", result.getTenantId(),
                            "Offline invoice submitted to KSeF",
                            "Invoice " + result.getInvoiceNumber() + " was successfully sent to KSeF (ksefId "
                                    + result.getKsefId() + ").",
                            result.getId(), "INVOICE_SENT:" + result.getId());
                } else {
                    requeued++; // still offline — will be tried again next round
                }
            } catch (Exception e) {
                // Never let one invoice's problem stop the rest of the queue.
                requeued++;
                log.error("[processOfflineQueue]:3 Retry failed unexpectedly for invoice [{}] (tenant [{}]): {}",
                        invoice.getId(), invoice.getTenantId(), e.getMessage(), e);
            }
        }

        log.info("[processOfflineQueue]:4 Retry round done — sent={}, still-queued={}, failed={}, skipped(backoff)={}",
                sent, requeued, failed, skipped);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    // True if there is a deadline and we are now past it while the invoice is still not in KSeF.
    private boolean isDeadlineBreached(KsefInvoice invoice, LocalDateTime now) {
        return invoice.getKsefSubmissionDeadline() != null
                && now.isAfter(invoice.getKsefSubmissionDeadline());
    }

    // Exponential backoff: wait longer after each failed attempt so we do not hammer KSeF.
    // attempt 1 → base, attempt 2 → base×2, attempt 3 → base×4 … capped at max-backoff.
    // An invoice that has never been retried (lastRetryAt == null) is due immediately.
    private boolean isDueForRetry(KsefInvoice invoice, LocalDateTime now) {
        if (invoice.getLastRetryAt() == null) {
            return true;
        }
        int attempts = Math.max(invoice.getSubmissionAttempts(), 1);
        // Use a bounded shift to compute base × 2^(attempts-1) without overflowing.
        long multiplier = 1L << Math.min(attempts - 1, 16); // cap exponent so the shift stays safe
        long delaySeconds = Math.min(baseBackoffSeconds * multiplier, maxBackoffSeconds);
        LocalDateTime nextEligible = invoice.getLastRetryAt().plusSeconds(delaySeconds);
        return !now.isBefore(nextEligible);
    }

    // Marks an invoice FAILED, writes an immutable audit entry, and alerts the tenant so a
    // human can submit/correct it manually (FAILED → DRAFT → submit is the existing recovery path).
    private void failQueueItem(KsefInvoice invoice, String reason) {
        invoice.setLastErrorMessage(reason);
        // SYSTEM actor — this transition is made by the automated retry job, not a user.
        invoice.recordStatus(KsefInvoiceStatus.FAILED, reason, SYSTEM_ACTOR);
        invoiceRepository.save(invoice);

        KSeFAuditLogService.writeAuditLog(invoice.getTenantId(), "INVOICE_RETRY_FAILED", invoice.getId(),
                null, reason, SYSTEM_ACTOR, SYSTEM_IP);

        hubPublisher.publishInvoiceEvent("INVOICE_RETRY_FAILED", invoice.getTenantId(),
                "Invoice could not be sent to KSeF",
                "Invoice " + invoice.getInvoiceNumber() + " was moved to FAILED. " + reason,
                invoice.getId(), "INVOICE_RETRY_FAILED:" + invoice.getId());

        log.error("[failQueueItem]:1 Invoice [{}] (tenant [{}]) marked FAILED — {}",
                invoice.getInvoiceNumber(), invoice.getTenantId(), reason);
    }
}
