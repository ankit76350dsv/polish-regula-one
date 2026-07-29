package com.safevoice.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP rate limiting for the PUBLIC whistleblower endpoints (`/api/safevoice/**`).
 *
 * CLAUDE.md §6 mandates rate limiting and §22 forbids disabling it on public endpoints. These
 * endpoints are unauthenticated (the reporter has no account), so without a throttle they can be
 * hammered to (a) brute-force / amplify attempts against the access-key lookup on /track and the
 * attachment download, and (b) spam report submissions or uploads to exhaust storage.
 *
 * Two token buckets per client IP:
 *   • a GENERAL bucket applied to every /api/safevoice/** request, and
 *   • a stricter SENSITIVE bucket applied additionally to the credential-checking / KMS-calling
 *     endpoints (/track, /attachments/download, /crypto/data-key, /crypto/case-keys), where
 *     brute-force and AWS KMS cost abuse are the concern.
 *
 * NOTE: this is an in-memory limiter, correct for a SINGLE instance. A multi-instance / horizontally
 * scaled deployment must move this to a shared store (Redis via bucket4j) or enforce it at the
 * API gateway / WAF, so the limit is global rather than per-pod. It also does NOT cover the
 * WebSocket handshake (/ws/**) — throttle that at the gateway.
 */
@Slf4j
@Component
// Run AFTER the Spring Security chain (which handles CORS): that way a 429 short-circuit still
// carries the CORS headers the security layer added, so a cross-origin browser can read it
// instead of masking it as a network error.
@Order(Ordered.LOWEST_PRECEDENCE)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String PUBLIC_PREFIX = "/api/safevoice/";
    private static final String TRACK_PATH = "/api/safevoice/reports/track";
    private static final String DOWNLOAD_PATH = "/api/safevoice/reports/attachments/download";
    // Crypto helpers make the server call AWS KMS (which costs money) and, for case-keys, check a
    // credential. Throttle them harder, like the other credential endpoints, to blunt cost abuse
    // and brute-force.
    private static final String DATA_KEY_PATH = "/api/safevoice/crypto/data-key";
    private static final String CASE_KEYS_PATH = "/api/safevoice/crypto/case-keys";

    // Keep memory bounded: cap how many IPs we track and evict buckets idle beyond this window.
    private static final int MAX_TRACKED_IPS = 50_000;
    private static final long IDLE_EVICT_MS = 10 * 60 * 1000L;

    private final boolean enabled;
    private final int generalPerMinute;
    private final int sensitivePerMinute;

    private final Map<String, Bucket> generalBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> sensitiveBuckets = new ConcurrentHashMap<>();

    public RateLimitFilter(
            @Value("${safevoice.rate-limit.enabled:true}") boolean enabled,
            @Value("${safevoice.rate-limit.general-per-minute:60}") int generalPerMinute,
            @Value("${safevoice.rate-limit.sensitive-per-minute:10}") int sensitivePerMinute) {
        this.enabled = enabled;
        this.generalPerMinute = generalPerMinute;
        this.sensitivePerMinute = sensitivePerMinute;
        if (!enabled) {
            log.warn("[RateLimitFilter] Rate limiting is DISABLED — public endpoints are unthrottled.");
        } else {
            log.info("[RateLimitFilter] Rate limiting ENABLED: {}/min general, {}/min on credential endpoints, per IP.",
                    generalPerMinute, sensitivePerMinute);
        }
    }

    // Only touch the public reporter endpoints; skip CORS preflight (OPTIONS) so it never counts
    // against the limit. Everything else passes straight through.
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                || !request.getRequestURI().startsWith(PUBLIC_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!enabled) {
            chain.doFilter(request, response);
            return;
        }

        long now = System.currentTimeMillis();
        String ip = clientIp(request);

        boolean allowed = consume(generalBuckets, ip, generalPerMinute, now);
        if (allowed && isSensitive(request)) {
            allowed = consume(sensitiveBuckets, ip, sensitivePerMinute, now);
        }

        if (!allowed) {
            reject(response);
            return;
        }
        chain.doFilter(request, response);
    }

    // The two endpoints where the access key is checked — brute-force targets, throttled harder.
    private boolean isSensitive(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        return TRACK_PATH.equals(uri) || DOWNLOAD_PATH.equals(uri)
                || DATA_KEY_PATH.equals(uri) || CASE_KEYS_PATH.equals(uri);
    }

    private boolean consume(Map<String, Bucket> buckets, String ip, int perMinute, long now) {
        // Best-effort eviction so a flood of unique IPs cannot grow the map without bound.
        if (buckets.size() > MAX_TRACKED_IPS) {
            buckets.entrySet().removeIf(e -> now - e.getValue().lastAccessMs > IDLE_EVICT_MS);
        }
        Bucket bucket = buckets.computeIfAbsent(ip, k -> new Bucket(perMinute, now));
        return bucket.tryConsume(now);
    }

    // Client IP. Behind a trusted proxy/ingress the real IP is in X-Forwarded-For (first hop);
    // fall back to the socket address otherwise. (XFF is only trustworthy behind a proxy that
    // sets it — ensure the ingress overwrites, not appends, client-supplied values.)
    private String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader(HttpHeaders.RETRY_AFTER, "60");
        // Match the { success, message, errorCode, status } envelope the frontend already reads.
        response.getWriter().write(
                "{\"success\":false,"
                        + "\"message\":\"Too many requests. Please wait a moment and try again.\","
                        + "\"errorCode\":\"RATE_LIMITED\","
                        + "\"status\":429}");
    }

    // A simple token bucket: `capacity` tokens, refilled continuously to `capacity` per minute.
    private static final class Bucket {
        private final double capacity;
        private final double refillPerMs;
        private double tokens;
        private long lastRefillMs;
        private volatile long lastAccessMs;

        Bucket(int perMinute, long now) {
            this.capacity = perMinute;
            this.refillPerMs = perMinute / 60000.0;
            this.tokens = perMinute; // start full (allow an initial burst up to capacity)
            this.lastRefillMs = now;
            this.lastAccessMs = now;
        }

        synchronized boolean tryConsume(long now) {
            lastAccessMs = now;
            long elapsed = now - lastRefillMs;
            if (elapsed > 0) {
                tokens = Math.min(capacity, tokens + elapsed * refillPerMs);
                lastRefillMs = now;
            }
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }
    }
}
