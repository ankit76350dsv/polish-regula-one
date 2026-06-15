package com.ksefflow.backend.services;

import com.ksefflow.backend.models.utils.KsefOfflineMode;
import com.ksefflow.backend.models.utils.KsefServiceMode;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicReference;

/**
 * KsefAvailabilityService — KSeF failure-mode detection (C7).
 *
 * SIMPLE EXPLANATION (why this exists):
 * When KSeF is down, an invoice issued offline must reach KSeF within a LEGAL deadline. But
 * the deadline depends on WHY KSeF is down:
 *   - If KSeF is just unreachable (network / outage we noticed ourselves) → next business day.
 *   - If the Ministry of Finance officially DECLARES a failure ("tryb awaryjny") on their BIP
 *     page → a longer 7-business-day window applies.
 * So before we park an invoice offline, we need to know the current KSeF state. This service
 * keeps that state in one place.
 *
 * How the state is set:
 *   1. AUTOMATICALLY — a small background job pings KSeF every couple of minutes. If KSeF stops
 *      answering, we switch ourselves to OFFLINE_UNAVAILABILITY. When it answers again, we
 *      switch back to ONLINE.
 *   2. MANUALLY by an admin — the Ministry only announces a real "tryb awaryjny" on their BIP
 *      website (there is no API flag for it). An admin reads that announcement and declares
 *      EMERGENCY here. EMERGENCY is "sticky": the automatic job will NEVER clear it, because
 *      only the Ministry (via the admin) can say the emergency is over.
 *
 * Official references: MF "Tryb awaryjny" and "Tryb offline – niedostępność KSeF" pages, and
 * Polish VAT Act art. 106nf (emergency) / art. 106nh (unavailability). See COMPLIANCE_GAP_ANALYSIS.md C7.
 */
@Service
@Slf4j
public class KsefAvailabilityService {

    private final KsefApiClient ksefApiClient;

    // Master on/off switch for the automatic ping. (Manual declarations always work.)
    @Value("${ksef.availability.monitor-enabled:true}")
    private boolean monitorEnabled;

    // The current known state, plus a small description of how/why it was set.
    // AtomicReference keeps reads/writes safe across the scheduler thread and request threads.
    private final AtomicReference<Status> status =
            new AtomicReference<>(new Status(KsefServiceMode.ONLINE, false, "Initial state", null, LocalDateTime.now()));

    public KsefAvailabilityService(KsefApiClient ksefApiClient) {
        this.ksefApiClient = ksefApiClient;
    }

    // ── Snapshot type returned to callers / the status endpoint ──────────────────

    /**
     * An immutable snapshot of the current KSeF availability state.
     *
     * @param mode      ONLINE / OFFLINE_UNAVAILABILITY / EMERGENCY
     * @param manual    true if a person declared this state (so the auto-ping must not override it)
     * @param reason    short human-readable explanation
     * @param declaredBy who set it ("auto-monitor" or an admin email)
     * @param since     when the state last changed
     */
    public record Status(KsefServiceMode mode, boolean manual, String reason,
                         String declaredBy, LocalDateTime since) {}

    // ── Reads ────────────────────────────────────────────────────────────────────

    public Status getStatus() {
        return status.get();
    }

    public boolean isOnline() {
        return status.get().mode() == KsefServiceMode.ONLINE;
    }

    /**
     * Maps the current state to the offline mode the invoice pipeline should record when it
     * has to park an invoice. EMERGENCY → the 7-business-day window; anything else that is not
     * online → the next-business-day unavailability window.
     */
    public KsefOfflineMode currentOfflineMode() {
        return status.get().mode() == KsefServiceMode.EMERGENCY
                ? KsefOfflineMode.EMERGENCY
                : KsefOfflineMode.OFFLINE_UNAVAILABILITY;
    }

    // ── Manual declarations (admin-driven, based on the official MF announcement) ──

    /** Declare a Ministry-announced emergency ("tryb awaryjny"). Sticky until cleared by an admin. */
    public Status declareEmergency(String reason, String declaredBy) {
        return setManual(KsefServiceMode.EMERGENCY, reason, declaredBy);
    }

    /** Manually declare unavailability (e.g. a known maintenance window). Sticky until cleared. */
    public Status declareUnavailability(String reason, String declaredBy) {
        return setManual(KsefServiceMode.OFFLINE_UNAVAILABILITY, reason, declaredBy);
    }

    /** Clear any manual declaration and hand control back to the automatic ping. */
    public Status declareOnline(String reason, String declaredBy) {
        Status next = new Status(KsefServiceMode.ONLINE, false,
                reason != null ? reason : "Manually set online", declaredBy, LocalDateTime.now());
        status.set(next);
        log.warn("[declareOnline]:1 KSeF availability manually set ONLINE by [{}] — automatic monitoring resumes", declaredBy);
        return next;
    }

    private Status setManual(KsefServiceMode mode, String reason, String declaredBy) {
        Status next = new Status(mode, true, reason, declaredBy, LocalDateTime.now());
        status.set(next);
        log.warn("[setManual]:1 KSeF availability manually set to [{}] by [{}]: {}", mode, declaredBy, reason);
        return next;
    }

    // ── Automatic monitor ──────────────────────────────────────────────────────────

    /**
     * Pings KSeF on a fixed delay (default every 2 minutes). It ONLY moves between ONLINE and
     * the auto OFFLINE_UNAVAILABILITY state. It never touches a state a person set by hand
     * (manual == true) — in particular it never clears an EMERGENCY, because only the Ministry
     * can end an emergency.
     */
    @Scheduled(
            fixedDelayString = "${ksef.availability.ping-interval-ms:120000}",
            initialDelayString = "${ksef.availability.initial-delay-ms:30000}")
    public void monitor() {
        if (!monitorEnabled) {
            return;
        }
        Status current = status.get();
        if (current.manual()) {
            // A human is in control of this state (e.g. EMERGENCY). Do not override it.
            log.debug("[monitor]:1 Skipping auto-check — state [{}] was set manually by [{}]",
                    current.mode(), current.declaredBy());
            return;
        }

        boolean reachable = ksefApiClient.isApiReachable();

        if (reachable && current.mode() != KsefServiceMode.ONLINE) {
            // KSeF is back. Clear our own auto-unavailability.
            status.set(new Status(KsefServiceMode.ONLINE, false,
                    "KSeF reachable again (auto-detected)", "auto-monitor", LocalDateTime.now()));
            log.warn("[monitor]:2 KSeF is reachable again — availability auto-restored to ONLINE");
        } else if (!reachable && current.mode() == KsefServiceMode.ONLINE) {
            // KSeF stopped answering. Switch to system-detected unavailability.
            status.set(new Status(KsefServiceMode.OFFLINE_UNAVAILABILITY, false,
                    "KSeF not reachable (auto-detected)", "auto-monitor", LocalDateTime.now()));
            log.warn("[monitor]:3 KSeF is not reachable — availability auto-set to OFFLINE_UNAVAILABILITY. "
                    + "Invoices will be issued offline with a next-business-day deadline.");
        }
    }
}
