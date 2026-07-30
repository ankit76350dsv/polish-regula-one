package com.privacypilot.backend.security;

// Jackson 3 (the default in Spring Boot 4) lives under "tools.jackson", not the old
// "com.fasterxml.jackson.databind". Only the ANNOTATIONS kept the com.fasterxml package,
// which is why the model classes still import from there.
import tools.jackson.databind.ObjectMapper;

import com.privacypilot.backend.dto.AppResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Stops any one caller from flooding the API.
 *
 * WHY THIS EXISTS (the gap it fills):
 * There was NO limit of any kind on any endpoint. Anyone with a session — or, for the
 * paths that reach the login check, anyone at all — could send requests as fast as their
 * machine allowed. Three concrete problems that caused:
 *   1. every request that gets this far triggers a call to RegulaOne's /api/auth/me, so
 *      flooding this service also floods the platform's login service;
 *   2. a script could hammer the register or the audit trail and exhaust the database;
 *   3. repeated guessing against any endpoint was completely unthrottled.
 * The project rules require rate limiting on all endpoints, stricter on writes.
 *
 * HOW IT WORKS — a "token bucket", which is the everyday shape of a rate limit:
 * every caller gets a bucket holding a number of tokens. Each request spends one token.
 * Tokens trickle back at a fixed rate. Burst hard and the bucket empties and requests are
 * refused with 429 until it refills — but normal use, even a screen that loads six things
 * at once, never notices, because the bucket starts full.
 *
 * READS AND WRITES GET SEPARATE BUCKETS: loading screens legitimately fires several GETs
 * at once, while a burst of writes is far more likely to be abuse. So a heavy reader can
 * never use up the allowance that protects the database from writes.
 *
 * WHO COUNTS AS "ONE CALLER": the session cookie when there is one (so one signed-in
 * person has their own allowance, on any device), otherwise the network address. The
 * cookie is never stored or logged — only an irreversible fingerprint of it is used as
 * the map key.
 *
 * ⚠ SCOPE — READ THIS BEFORE SCALING OUT: the counters live in THIS server's memory. With
 * one instance that is exactly right. Run several instances behind a load balancer and each
 * keeps its own counters, so the real limit becomes (instances × the configured limit).
 * That is a weaker limit, never a broken one. For a cluster, enforce the limit at the
 * gateway/ingress, or move the buckets to shared Redis.
 */
@Slf4j
@Component
// Runs early — before the request reaches a controller, and before the auth resolver calls
// out to RegulaOne — so a flood is stopped as cheaply as possible. Sits just inside
// CurrentUserContextFilter, which must remain the outermost filter so it can always clear
// its thread-local in a finally block.
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final double readCapacity;
    private final double readRefillPerSecond;
    private final double writeCapacity;
    private final double writeRefillPerSecond;

    /** Only these endpoints are limited; nothing else is served by this application. */
    private static final String API_PREFIX = "/api/";

    /**
     * Keep the bucket map from becoming a memory leak of its own: once it grows past this,
     * buckets nobody has used recently are dropped. A dropped bucket simply starts full
     * again, which is safe — it can only ever be more generous, never less.
     */
    private static final int MAX_TRACKED_CALLERS = 50_000;
    private static final long IDLE_EVICTION_NANOS = 10L * 60 * 1_000_000_000L; // 10 minutes

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimitFilter(
            ObjectMapper objectMapper,
            @Value("${privacypilot.rate-limit.enabled:true}") boolean enabled,
            @Value("${privacypilot.rate-limit.read.capacity:60}") double readCapacity,
            @Value("${privacypilot.rate-limit.read.refill-per-minute:120}") double readRefillPerMinute,
            @Value("${privacypilot.rate-limit.write.capacity:20}") double writeCapacity,
            @Value("${privacypilot.rate-limit.write.refill-per-minute:30}") double writeRefillPerMinute) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.readCapacity = readCapacity;
        this.readRefillPerSecond = readRefillPerMinute / 60.0;
        this.writeCapacity = writeCapacity;
        this.writeRefillPerSecond = writeRefillPerMinute / 60.0;
        log.info("[RateLimitFilter] enabled={} reads={}/burst {}per-min writes={}/burst {}per-min",
                enabled, (long) readCapacity, (long) readRefillPerMinute,
                (long) writeCapacity, (long) writeRefillPerMinute);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Skip anything that is not an API call, and skip the browser's CORS pre-flight —
        // an OPTIONS request carries no data, and refusing it would break the real request
        // that follows with a confusing CORS error instead of an honest 429.
        return !enabled
                || !request.getRequestURI().startsWith(API_PREFIX)
                || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        boolean isWrite = isWrite(request.getMethod());
        double capacity = isWrite ? writeCapacity : readCapacity;
        double refillPerSecond = isWrite ? writeRefillPerSecond : readRefillPerSecond;

        String key = (isWrite ? "w|" : "r|") + callerKey(request);
        long now = System.nanoTime();

        evictIdleIfCrowded(now);

        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket(capacity, now));
        long retryAfterSeconds = bucket.tryConsume(capacity, refillPerSecond, now);

        if (retryAfterSeconds > 0) {
            tooManyRequests(request, response, retryAfterSeconds, isWrite);
            return;
        }
        filterChain.doFilter(request, response);
    }

    // POST/PUT/PATCH/DELETE change data; everything else only reads it.
    private static boolean isWrite(String method) {
        return "POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method);
    }

    /**
     * Who to charge for this request: the signed-in session if there is one, otherwise the
     * network address.
     *
     * The session token itself is NEVER kept — it is hashed, and only the hash is used as a
     * map key. That gives a stable per-session identity without holding a credential in
     * memory or ever risking it in a log line.
     *
     * The address comes from getRemoteAddr(), which Spring fills in from the proxy headers
     * when {@code server.forward-headers-strategy} is configured (it is, in prod). Reading
     * X-Forwarded-For directly here would trust a header any client can invent.
     */
    private static String callerKey(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("idToken".equals(cookie.getName())
                        && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                    return "s:" + fingerprint(cookie.getValue());
                }
            }
        }
        String ip = request.getRemoteAddr();
        return "ip:" + (ip == null ? "unknown" : ip);
    }

    // An irreversible, fixed-length fingerprint of the session token. SHA-256 truncated to
    // 16 hex characters: plenty to tell sessions apart, and impossible to turn back into
    // the token. (Not a password hash — nothing is being verified, only counted.)
    private static String fingerprint(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is part of every Java runtime; this cannot happen in practice.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    // Drop buckets nobody has touched for a while, but only once the map is actually large
    // — sweeping on every request would cost more than it saves.
    private void evictIdleIfCrowded(long now) {
        if (buckets.size() <= MAX_TRACKED_CALLERS) {
            return;
        }
        buckets.entrySet().removeIf(e -> now - e.getValue().lastSeenNanos() > IDLE_EVICTION_NANOS);
    }

    /**
     * Refuse the request with 429 and the same {@link AppResponse} envelope every other
     * error uses, so the frontend handles it like any other failure. {@code Retry-After}
     * tells a well-behaved client exactly how long to wait.
     */
    private void tooManyRequests(HttpServletRequest request, HttpServletResponse response,
                                 long retryAfterSeconds, boolean isWrite) throws IOException {
        // Log the fact, never the identity's credential — the key is already a hash.
        log.warn("[RateLimitFilter] 429 {} {} (write={}, retry after {}s)",
                request.getMethod(), request.getRequestURI(), isWrite, retryAfterSeconds);

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfterSeconds));

        AppResponse<Object> body = AppResponse.fail(
                "Too many requests — please slow down and try again in a moment.",
                "RATE_LIMITED", HttpStatus.TOO_MANY_REQUESTS.value());
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    /**
     * One caller's allowance. Tokens are not topped up by a background timer; instead, each
     * request works out how many have trickled back since the last one. That keeps an idle
     * bucket completely free — no threads, no scheduled work.
     */
    private static final class Bucket {
        private double tokens;
        private long lastRefillNanos;

        private Bucket(double initialTokens, long nowNanos) {
            this.tokens = initialTokens;
            this.lastRefillNanos = nowNanos;
        }

        private synchronized long lastSeenNanos() {
            return lastRefillNanos;
        }

        /**
         * Try to spend one token.
         *
         * @return 0 when the request is allowed, otherwise the number of whole seconds the
         *         caller should wait before one token will be available again (never 0, so
         *         the caller can tell "allowed" from "refused").
         */
        private synchronized long tryConsume(double capacity, double refillPerSecond, long nowNanos) {
            // Add whatever has trickled back since the previous request, up to the brim.
            double elapsedSeconds = (nowNanos - lastRefillNanos) / 1_000_000_000.0;
            if (elapsedSeconds > 0) {
                tokens = Math.min(capacity, tokens + elapsedSeconds * refillPerSecond);
                lastRefillNanos = nowNanos;
            }
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return 0;
            }
            // Not enough yet — say how long until there is.
            double secondsUntilOneToken = (1.0 - tokens) / refillPerSecond;
            return Math.max(1L, (long) Math.ceil(secondsUntilOneToken));
        }
    }
}
