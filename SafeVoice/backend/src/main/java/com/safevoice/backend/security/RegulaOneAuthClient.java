package com.safevoice.backend.security;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

/**
 * Resolves the authenticated caller by delegating to the RegulaOne backend.
 *
 * Like KSeFFlow, SafeVoice does NOT re-verify Cognito tokens or read the user collection
 * itself: it forwards the caller's "idToken" cookie to RegulaOne's GET /api/auth/me and
 * trusts the identity it returns. RegulaOne stays the single source of truth for
 * authentication and tenant membership.
 *
 * Two entry points share the same /me call:
 *   • {@link #resolve(HttpServletRequest)} — for REST (the argument resolver). Throws a
 *     ResponseStatusException the browser understands: 401 (no/invalid session), 403 (no
 *     organisation), 503 (RegulaOne unreachable).
 *   • {@link #resolveByIdToken(String)} — for the WebSocket CONNECT, where we only have the
 *     cookie value. Returns empty instead of throwing, so the socket layer can reject.
 */
@Slf4j
@Component
public class RegulaOneAuthClient {

    private final RestClient restClient;

    public RegulaOneAuthClient(@Value("${regulaone.api.base-url}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        log.info("[RegulaOneAuthClient]: auth authority base URL: {}", baseUrl);
    }

    /**
     * Resolve the caller from the incoming request's idToken cookie (REST path).
     * Never returns null — throws {@link ResponseStatusException} when the caller cannot be
     * authenticated or has no tenant.
     */
    public AuthenticatedUser resolve(HttpServletRequest request) {
        String idToken = extractIdToken(request);
        if (idToken == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authentication session");
        }
        MeData d = fetchMe(idToken);

        boolean isSuperAdmin = "ROLE_SUPER_ADMIN".equals(d.role());
        if (!isSuperAdmin && (d.tenantId() == null || d.tenantId().isBlank())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Your account is not associated with an organisation");
        }
        return toUser(d);
    }

    /**
     * Resolve the caller from a raw idToken (WebSocket path). Returns empty — never throws —
     * for a missing/invalid session, a user with no organisation, or RegulaOne being down,
     * so the socket CONNECT interceptor can simply reject the connection.
     */
    public Optional<AuthenticatedUser> resolveByIdToken(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            return Optional.empty();
        }
        try {
            MeData d = fetchMe(idToken);
            if (d.tenantId() == null || d.tenantId().isBlank()) {
                return Optional.empty(); // socket staff must belong to a tenant
            }
            return Optional.of(toUser(d));
        } catch (ResponseStatusException e) {
            log.warn("[resolveByIdToken]: /api/auth/me did not authenticate the socket: {}",
                    e.getReason());
            return Optional.empty();
        }
    }

    // Shared /api/auth/me call. Throws 401 for a rejected/invalid session, 503 when RegulaOne
    // cannot be reached, and 401 for an empty body.
    private MeData fetchMe(String idToken) {
        MeResponse body;
        try {
            body = restClient.get()
                    .uri("/api/auth/me")
                    // Forward the cookie so RegulaOne's CookieBearerTokenResolver picks it up.
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

    private AuthenticatedUser toUser(MeData d) {
        return new AuthenticatedUser(d.id(), d.email(), d.role(),
                d.tenantId(), d.tenantName(), d.tenantStatus(), d.permissions());
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

    // Minimal projections of RegulaOne's AppResponse<UserResponse> envelope; ignore the rest.
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MeResponse(boolean success, String message, MeData data) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MeData(String id, String email, String role,
                          String tenantId, String tenantName, String tenantStatus,
                          List<String> permissions) {}
}
