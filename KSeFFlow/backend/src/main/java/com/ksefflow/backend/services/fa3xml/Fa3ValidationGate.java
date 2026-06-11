package com.ksefflow.backend.services.fa3xml;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

// SIMPLE EXPLANATION:
// This is the on/off switch for checking invoice XML against the official FA(3) rules
// BEFORE we send it to KSeF.
//
// - In PRODUCTION we now turn the check ON. Catching a bad invoice here means we do NOT
//   waste a real KSeF submission (and a KSeF rate-limit slot) on something KSeF will only
//   reject anyway, and the user gets a clear "what is wrong" message immediately. This is
//   especially important for correction invoices, where a small mistake is easy to make.
// - In DEV the check stays OFF by default, because developers restart the app many times a
//   day and the very first check is slow (see the SPEED NOTE below).
//
// The switch is the setting:  ksef.validation.xsd.enabled = true | false
//
// SPEED NOTE: the very first FA(3) check in a running app is slow — Java has to build a big
// rule table once (a few minutes). After that, every check takes about 2 milliseconds.
// To make this safe in production we do TWO things:
//   1. When the app starts, we "warm up" the checker once in the background.
//   2. If a real invoice arrives BEFORE the warm-up has finished, that request WAITS for the
//      same warm-up to finish (a shared latch) instead of starting its own slow build. This
//      means the slow one-time cost is paid exactly once, by the warm-up — never twice, and
//      never as a surprise race between two requests.
@Slf4j
@Component
public class Fa3ValidationGate {

    private final Fa3XsdValidator fa3XsdValidator;

    // The on/off switch. Default is OFF (safe for fast dev restarts).
    @Value("${ksef.validation.xsd.enabled:false}")
    private boolean xsdValidationEnabled;

    // How long (in seconds) a real submission may wait for the one-time warm-up to finish
    // before it gives up waiting and validates anyway. The grammar build is ~233 s, so the
    // default leaves a safety margin. After warm-up completes once, the wait is effectively 0.
    @Value("${ksef.validation.xsd.warmup-timeout-seconds:300}")
    private long warmupTimeoutSeconds;

    // Counts down to zero exactly once, when the FA(3) checker is warm and ready.
    // A request that arrives during warm-up awaits this latch so it does not trigger a
    // second, concurrent grammar build.
    private final CountDownLatch warmupLatch = new CountDownLatch(1);

    public Fa3ValidationGate(Fa3XsdValidator fa3XsdValidator) {
        this.fa3XsdValidator = fa3XsdValidator;
    }

    // Check the invoice XML before we send it to KSeF.
    // If the switch is ON: wait for the checker to be warm (if needed), then run the full
    //   official FA(3) check and STOP if the XML is wrong — we never send a bad invoice.
    // If the switch is OFF: skip our check and let KSeF check it on its side.
    public void validateBeforeSubmission(String xml) {
        if (!xsdValidationEnabled) {
            log.debug("[validateBeforeSubmission]:1 Local FA(3) XSD check is OFF — KSeF will check the invoice on its side");
            return;
        }

        // Make sure the slow one-time table build is done (or wait for the background warm-up
        // that is already doing it). This stops two requests racing to build the same table.
        awaitWarmUp();

        try {
            fa3XsdValidator.validate(xml);
            log.info("[validateBeforeSubmission]:2 Invoice passed the official FA(3) check");
        } catch (KsefXmlGenerationException e) {
            // Log the reason clearly, then stop — we never send a bad invoice when the check is ON.
            log.error("[validateBeforeSubmission]:3 Invoice FAILED the official FA(3) check: {}", e.getMessage());
            throw e;
        }
    }

    // Wait for the background warm-up to finish, up to the configured timeout.
    // If warm-up has already finished, this returns immediately. If it times out (warm-up
    // is unusually slow or never ran), we proceed anyway — the validate() call will simply
    // build the table itself. We never block forever.
    private void awaitWarmUp() {
        if (warmupLatch.getCount() == 0) {
            return; // already warm — fast path
        }
        try {
            boolean ready = warmupLatch.await(warmupTimeoutSeconds, TimeUnit.SECONDS);
            if (!ready) {
                log.warn("[awaitWarmUp]:1 FA(3) checker was not warm after {} s — validating without waiting further",
                        warmupTimeoutSeconds);
            }
        } catch (InterruptedException e) {
            // Keep the thread's interrupted flag and stop waiting — do not swallow it silently.
            Thread.currentThread().interrupt();
            log.warn("[awaitWarmUp]:2 Interrupted while waiting for FA(3) warm-up — validating now");
        }
    }

    // When the app has started, if the check is ON, warm it up in the background once.
    // This way the slow one-time table build does not block app start, and it is paid exactly
    // once. When it finishes we open the latch so any waiting submissions can proceed fast.
    @EventListener(ApplicationReadyEvent.class)
    public void warmUpIfEnabled() {
        if (!xsdValidationEnabled) {
            // Open the latch so the (disabled) gate never makes anything wait.
            warmupLatch.countDown();
            return;
        }
        Thread warmer = new Thread(() -> {
            try {
                long start = System.currentTimeMillis();
                log.info("[warmUpIfEnabled]:1 Warming up the FA(3) checker in the background…");
                fa3XsdValidator.warmUp();
                log.info("[warmUpIfEnabled]:2 FA(3) checker is warm and ready ({} ms)",
                        System.currentTimeMillis() - start);
            } catch (Exception e) {
                // Warm-up is only for speed. If it fails, real checks still work (just slower once).
                log.warn("[warmUpIfEnabled]:3 FA(3) warm-up did not finish: {}", e.getMessage());
            } finally {
                // ALWAYS open the latch — even if warm-up failed — so submissions are never
                // blocked forever. A failed warm-up just means the first real check is slow.
                warmupLatch.countDown();
            }
        }, "fa3-xsd-warmup");
        warmer.setDaemon(true); // do not keep the app alive just for this
        warmer.start();
    }
}
