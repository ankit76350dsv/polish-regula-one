package com.regulaone.backend.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Caps how often ONE caller may hit the endpoints that need no session.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────────
 *
 * Sign-in, sign-up and password recovery are open to the internet by necessity. Without a
 * limit they can be hammered: passwords guessed against a known e-mail address, or a
 * mailbox flooded by repeating "forgot password". Cognito applies throttling of its own,
 * but that is AWS protecting AWS — not a control this platform owns or can evidence.
 * CLAUDE.md §6 requires rate limiting on public endpoints.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────────
 *
 * It is a fixed window counted IN MEMORY, per instance. That is honest and useful, and it
 * is deliberately simple: no new dependency, nothing to operate.
 *
 * It is NOT a distributed limit. Two instances behind a load balancer allow twice the
 * configured rate, and the counters reset when an instance restarts. For a real ceiling in
 * production, put a limit on the load balancer or WAF as well — this filter is the floor,
 * not the whole defence.
 *
 * ── HOW IT COUNTS ───────────────────────────────────────────────────────────────
 *
 * One counter per (caller address + path), reset every {@code windowSeconds}. A caller who
 * exceeds the allowance gets 429 with a Retry-After header, and nothing further runs — the
 * request never reaches Cognito or the database, which is the point.
 *
 * The response says only that there were too many attempts. It never reveals whether the
 * account exists, which would undo the care taken in the password-recovery endpoint.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)   // before authentication: reject early, cheaply
public class RateLimitFilter extends OncePerRequestFilter {

    /**
     * The endpoints this applies to: everything reachable WITHOUT a session that either
     * checks a credential or sends an e-mail.
     *
     * The internal service-to-service routes (/api/internal/**, /api/email/send) are
     * deliberately absent. They are machine traffic guarded by a shared token, and a
     * module raising a burst of legitimate notifications must not be throttled into
     * losing them.
     */
    private static final List<String> LIMITED_PATHS = List.of(
            "/api/sso/login",
            "/api/sso/respond-challenge",
            "/api/sso/refresh",
            "/api/auth/signup",
            "/api/auth/confirm",
            "/api/auth/resend-code",
            "/api/auth/forgot-password",          // also covers /forgot-password/confirm
            "/api/auth/change-password");

    /** Stop the map growing without bound if a flood arrives from many addresses. */
    private static final int MAX_TRACKED_CALLERS = 50_000;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Value("${security.rate-limit.enabled:true}")
    private boolean enabled;

    /** Requests allowed per caller, per path, per window. */
    @Value("${security.rate-limit.max-requests:10}")
    private int maxRequests;

    @Value("${security.rate-limit.window-seconds:60}")
    private int windowSeconds;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!enabled) return true;
        // Only POST bodies carry credentials; a GET on these paths is not the risk.
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;

        String path = request.getRequestURI();
        return LIMITED_PATHS.stream().noneMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String caller = ClientIp.of(request);
        String key = caller + " " + request.getRequestURI();

        if (isOverLimit(key)) {
            // The address is logged, not the body and not any account name: enough to
            // investigate an attack, without recording who someone tried to sign in as.
            log.warn("[rate-limit] {} exceeded {} requests in {}s for {}",
                    caller, maxRequests, windowSeconds, request.getRequestURI());

            response.setStatus(429);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Retry-After", String.valueOf(windowSeconds));
            response.getWriter().write(
                    "{\"success\":false,"
                    + "\"message\":\"Too many attempts. Please wait a moment and try again.\","
                    + "\"errorCode\":\"RATE_LIMITED\","
                    + "\"status\":429}");
            return;
        }

        chain.doFilter(request, response);
    }

    /** Count this request and say whether the caller has now gone over the allowance. */
    private boolean isOverLimit(String key) {
        long now = System.currentTimeMillis();
        long windowMillis = windowSeconds * 1000L;

        if (windows.size() > MAX_TRACKED_CALLERS) {
            windows.entrySet().removeIf(e -> now - e.getValue().startedAt > windowMillis);
        }

        Window window = windows.compute(key, (k, existing) ->
                (existing == null || now - existing.startedAt > windowMillis)
                        ? new Window(now)
                        : existing);

        return window.count.incrementAndGet() > maxRequests;
    }

    /** One caller's counter for the current window. */
    private static final class Window {
        private final long startedAt;
        private final AtomicInteger count = new AtomicInteger();

        private Window(long startedAt) {
            this.startedAt = startedAt;
        }
    }
}
