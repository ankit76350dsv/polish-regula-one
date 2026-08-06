package com.regulaone.backend.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The caller's IP address, worked out the same way everywhere.
 *
 * Two places need it and must agree: the audit trail (who did this, from where) and the
 * rate limiter (how many requests has this caller made). If they disagreed, a limit could
 * be counted per proxy while the trail recorded the real client, or the other way round.
 *
 * ── BEHIND A PROXY ──────────────────────────────────────────────────────────────
 *
 * In production the socket address is the load balancer, not the person, so the FIRST
 * entry of X-Forwarded-For is preferred. Only the first is taken: the rest of that header
 * is appended by intermediate hops and is not trustworthy.
 *
 * The value is capped so an oversized header cannot bloat an audit record or become a
 * huge key in the rate limiter's map.
 *
 * NOTE FOR DEPLOYMENT: this trusts X-Forwarded-For, which a client can also send directly.
 * That is safe only when the application is reachable ONLY through a proxy that overwrites
 * the header. If the container port is exposed to the internet, a caller can forge this
 * value and defeat both the rate limit and the accuracy of the audit trail.
 */
public final class ClientIp {

    private static final int MAX_LENGTH = 64;

    private ClientIp() {
        // Helper only — never instantiated.
    }

    /** The caller's address, or null when there is no request to read. */
    public static String of(HttpServletRequest request) {
        if (request == null) return null;

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return truncate(forwarded.split(",")[0].trim());
        }
        return truncate(request.getRemoteAddr());
    }

    private static String truncate(String value) {
        if (value == null) return null;
        return value.length() <= MAX_LENGTH ? value : value.substring(0, MAX_LENGTH);
    }
}
