package com.privacypilot.backend.security;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves the authenticated caller by delegating to the RegulaOne backend.
 *
 * Exactly like SafeVoice and KSeFFlow, PrivacyPilot does NOT verify login tokens or
 * read the users collection itself: it forwards the caller's "idToken" cookie to
 * RegulaOne's GET /api/auth/me and trusts the identity it returns. RegulaOne stays
 * the single source of truth for authentication and tenant membership.
 *
 * {@link #resolve(HttpServletRequest)} throws a status the browser understands:
 * 401 (no/invalid session), 403 (no organisation), 503 (RegulaOne unreachable).
 */
@Slf4j
@Component
public class RegulaOneAuthClient {

    private final RestClient restClient;

    // Short-TTL cache of resolved sessions, keyed by idToken, so we do not hit
    // /api/auth/me on every single request. A token revoked at RegulaOne is still
    // honoured here for up to the TTL — kept short (default 30s) to bound that window.
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final long cacheTtlMs;
    private static final int MAX_CACHE_ENTRIES = 10_000;

    public RegulaOneAuthClient(
            @Value("${regulaone.api.base-url}") String baseUrl,
            @Value("${regulaone.api.connect-timeout-ms:3000}") int connectTimeoutMs,
            @Value("${regulaone.api.read-timeout-ms:5000}") int readTimeoutMs,
            @Value("${regulaone.api.me-cache-ttl-ms:30000}") long cacheTtlMs) {
        // Explicit timeouts so a slow/hung RegulaOne cannot pin request threads forever.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        factory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.cacheTtlMs = cacheTtlMs;
        log.info("[RegulaOneAuthClient] auth authority: {} (connect {}ms, read {}ms, /me cache {}ms)",
                baseUrl, connectTimeoutMs, readTimeoutMs, cacheTtlMs);
    }

    /**
     * Resolve the caller from the incoming request's idToken cookie. Never returns
     * null — throws {@link ResponseStatusException} when the caller cannot be
     * authenticated (401), has no tenant (403), or RegulaOne is down (503).
     */
    public AuthenticatedUser resolve(HttpServletRequest request) {
        String idToken = extractIdToken(request);
        if (idToken == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authentication session");
        }
        long now = System.currentTimeMillis();
        CacheEntry cached = cache.get(idToken);
        if (cached != null && cached.expiresAtMs() > now) {
            return cached.user();
        }

        MeData d = fetchMe(idToken); // throws 401 / 503

        // A tenant is required (super admins may legitimately have none).
        if (!"ROLE_SUPER_ADMIN".equals(d.role()) && (d.tenantId() == null || d.tenantId().isBlank())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Your account is not associated with an organisation");
        }

        AuthenticatedUser user = new AuthenticatedUser(d.id(), d.name(), d.email(), d.role(),
                d.tenantId(), d.tenantName(), d.tenantStatus(), d.permissions());

        // Best-effort bound on cache growth: drop expired entries once it gets large.
        if (cache.size() > MAX_CACHE_ENTRIES) {
            cache.entrySet().removeIf(e -> e.getValue().expiresAtMs() <= now);
        }
        cache.put(idToken, new CacheEntry(user, now + cacheTtlMs));
        return user;
    }

    // Shared /api/auth/me call. 401 for a rejected/invalid session, 503 when RegulaOne
    // cannot be reached, 401 for an empty body.
    private MeData fetchMe(String idToken) {
        MeResponse body;
        try {
            body = restClient.get()
                    .uri("/api/auth/me")
                    // Forward the cookie so RegulaOne's cookie token resolver picks it up.
                    .header(HttpHeaders.COOKIE, "idToken=" + idToken)
                    .retrieve()
                    .onStatus(status -> status.value() == 401 || status.value() == 403,
                            (req, res) -> {
                                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                                        "Session invalid or expired");
                            })
                    .body(MeResponse.class);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Authentication service is unavailable");
        }
        if (body == null || body.data() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Could not resolve authenticated user");
        }
        return body.data();
    }

    private String extractIdToken(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("idToken".equals(cookie.getName())
                        && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    // A cached, already-validated session with its expiry (epoch millis).
    private record CacheEntry(AuthenticatedUser user, long expiresAtMs) {}

    // Minimal projections of RegulaOne's AppResponse<UserResponse> envelope; ignore the rest.
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MeResponse(boolean success, String message, MeData data) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MeData(String id, String name, String email, String role,
                          String tenantId, String tenantName, String tenantStatus,
                          List<String> permissions) {}
}
