package com.ksefflow.backend.services.retry;

import com.ksefflow.backend.models.KsefInvoice;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Single source of truth for the offline-retry backoff schedule.
 *
 * Both the background retry job (to decide what is "due") and the invoice read path (to TELL the
 * user when the next automatic attempt will happen) use this, so the formula and the configured
 * backoff values can never drift apart. Holds no other dependencies — safe to inject anywhere.
 */
@Component
public class KsefRetryScheduleCalculator {

    @Value("${ksef.retry.base-backoff-seconds:60}")
    private long baseBackoffSeconds;

    @Value("${ksef.retry.max-backoff-seconds:3600}")
    private long maxBackoffSeconds;

    /**
     * The earliest moment the invoice becomes eligible for its next automatic retry:
     * lastRetryAt + base × 2^(attempts-1), capped at max-backoff. An invoice that has never
     * been retried (lastRetryAt == null) is due immediately (returns "now").
     *
     * NOTE: the scheduled job runs on a fixed interval (default every 5 min), so the ACTUAL
     * send happens on the first scheduler tick at/after this time — this is the earliest time.
     */
    public LocalDateTime nextEligibleAt(KsefInvoice invoice) {
        if (invoice.getLastRetryAt() == null) {
            return LocalDateTime.now();
        }
        int attempts = Math.max(invoice.getSubmissionAttempts(), 1);
        long multiplier = 1L << Math.min(attempts - 1, 16); // bounded shift, no overflow
        long delaySeconds = Math.min(baseBackoffSeconds * multiplier, maxBackoffSeconds);
        return invoice.getLastRetryAt().plusSeconds(delaySeconds);
    }

    /** True when the invoice is at/after its next-eligible time. */
    public boolean isDue(KsefInvoice invoice, LocalDateTime now) {
        return !now.isBefore(nextEligibleAt(invoice));
    }
}
