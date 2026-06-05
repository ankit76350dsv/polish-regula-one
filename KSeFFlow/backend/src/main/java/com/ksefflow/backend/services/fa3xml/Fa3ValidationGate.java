package com.ksefflow.backend.services.fa3xml;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

// SIMPLE EXPLANATION:
// This is the on/off switch for checking invoice XML against the official FA(3) rules.
//
// - In DEV and TEST we turn the check ON, so we catch mistakes early.
// - In PRODUCTION we turn it OFF by default, because KSeF itself checks the invoice
//   on its side (that is how the government's own example app works). This also avoids
//   a slow first check on a live server.
//
// The switch is the setting:  ksef.validation.xsd.enabled = true | false
//
// SPEED NOTE: the very first FA(3) check in a running app is slow (it has to build a big
// rule table once — about a few minutes). After that every check is about 2 milliseconds.
// So when the check is ON, we warm it up quietly in the background when the app starts,
// so real invoices are always fast.
@Slf4j
@Component
public class Fa3ValidationGate {

    private final Fa3XsdValidator fa3XsdValidator;

    // The on/off switch. Default is OFF (safe for production).
    @Value("${ksef.validation.xsd.enabled:false}")
    private boolean xsdValidationEnabled;

    public Fa3ValidationGate(Fa3XsdValidator fa3XsdValidator) {
        this.fa3XsdValidator = fa3XsdValidator;
    }

    // Check the invoice XML before we send it to KSeF.
    // If the switch is ON: run the full official FA(3) check (stop if the XML is wrong).
    // If the switch is OFF: skip our check and let KSeF check it on its side.
    public void validateBeforeSubmission(String xml) {
        if (!xsdValidationEnabled) {
            log.debug("[Fa3ValidationGate] Local FA(3) XSD check is OFF — KSeF will check the invoice on its side");
            return;
        }
        try {
            fa3XsdValidator.validate(xml);
            log.info("[Fa3ValidationGate] Invoice passed the official FA(3) check");
        } catch (KsefXmlGenerationException e) {
            // Log the reason clearly, then stop — we never send a bad invoice when the check is ON.
            log.error("[Fa3ValidationGate] Invoice FAILED the official FA(3) check: {}", e.getMessage());
            throw e;
        }
    }

    // When the app has started, if the check is ON, warm it up in the background once.
    // This way the slow one-time table build does not block app start and does not slow
    // down the first real invoice.
    @EventListener(ApplicationReadyEvent.class)
    public void warmUpIfEnabled() {
        if (!xsdValidationEnabled) {
            return;
        }
        Thread warmer = new Thread(() -> {
            try {
                long start = System.currentTimeMillis();
                log.info("[Fa3ValidationGate] Warming up the FA(3) checker in the background…");
                fa3XsdValidator.warmUp();
                log.info("[Fa3ValidationGate] FA(3) checker is warm and ready ({} ms)",
                        System.currentTimeMillis() - start);
            } catch (Exception e) {
                // Warm-up is only for speed. If it fails, real checks still work (just slower once).
                log.warn("[Fa3ValidationGate] FA(3) warm-up did not finish: {}", e.getMessage());
            }
        }, "fa3-xsd-warmup");
        warmer.setDaemon(true); // do not keep the app alive just for this
        warmer.start();
    }
}
