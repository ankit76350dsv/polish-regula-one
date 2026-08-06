package com.regulaone.backend.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * The door check for INTERNAL service-to-service endpoints.
 *
 * Some endpoints are not called by a person in a browser but by another RegulaOne
 * application (KSeFFlow raising a notification, a module asking for an e-mail to be
 * sent). Those calls carry no user session, so instead they must present a shared
 * secret in the {@code X-Service-Token} header.
 *
 * WHY THIS IS ONE CLASS AND NOT A METHOD IN EACH CONTROLLER
 *   The check used to be copy-pasted into every internal controller, which meant the
 *   same security rule existed in more than one place and could drift apart. A
 *   security rule that appears twice is a security rule that will eventually
 *   disagree with itself, so it now lives here once and is injected where needed.
 *
 * TWO RULES IT ENFORCES
 *   1. FAIL CLOSED. If no token is configured on the server, the endpoint is shut
 *      (503) rather than left open to anyone.
 *   2. CONSTANT-TIME COMPARE. The supplied token is compared character by character
 *      with no early exit, so an attacker cannot learn the secret one character at a
 *      time by measuring how long the answer takes.
 *
 * Configure the secret with the NOTIFICATION_INTERNAL_TOKEN environment variable
 * (property {@code notification.internal.service-token}).
 */
@Slf4j
@Component
public class ServiceTokenGuard {

    private final String expectedToken;

    public ServiceTokenGuard(
            @Value("${notification.internal.service-token:}") String expectedToken) {
        this.expectedToken = expectedToken;
    }

    /**
     * Let the request through, or stop it.
     *
     * @param presentedToken   the value of the caller's {@code X-Service-Token} header
     * @param featureName      short name used only in log lines, e.g. "email"
     * @param notConfiguredMsg what the caller is told when the server has no token set
     *                         up — worded per endpoint so the message stays useful
     * @throws ResponseStatusException 503 when nothing is configured, 401 when the
     *                                 token is missing or wrong
     */
    public void require(String presentedToken, String featureName, String notConfiguredMsg) {
        if (expectedToken == null || expectedToken.isBlank()) {
            log.error("[{}] notification.internal.service-token is not configured — rejecting",
                    featureName);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, notConfiguredMsg);
        }
        if (presentedToken == null || !constantTimeEquals(expectedToken, presentedToken)) {
            log.warn("[{}] invalid or missing X-Service-Token — rejected", featureName);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid service token");
        }
    }

    /**
     * Compare two strings without giving away where they first differ.
     *
     * Every character is inspected even after a mismatch is found, so the answer
     * always takes the same amount of time.
     */
    private boolean constantTimeEquals(String expected, String presented) {
        if (expected.length() != presented.length()) {
            return false;
        }
        int difference = 0;
        for (int i = 0; i < expected.length(); i++) {
            difference |= expected.charAt(i) ^ presented.charAt(i);
        }
        return difference == 0;
    }
}
