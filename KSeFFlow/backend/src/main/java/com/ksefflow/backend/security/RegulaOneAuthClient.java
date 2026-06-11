package com.ksefflow.backend.security;

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

/**
 * Resolves the authenticated caller by delegating to the RegulaOne backend.
 *
 * Rather than re-implementing Cognito JWT verification and duplicating the
 * user/tenant collections, KSeFFlow forwards the caller's idToken cookie to
 * RegulaOne's GET /api/auth/me and trusts the identity it returns. RegulaOne
 * remains the single source of truth for authentication and tenant membership.
 *
 * Failures map to HTTP errors the browser understands:
 *   - missing/invalid/expired session  → 401 Unauthorized
 *   - authenticated but no organisation → 403 Forbidden
 *   - RegulaOne unreachable             → 503 Service Unavailable
 */
@Slf4j
@Component
public class RegulaOneAuthClient {

    private final RestClient restClient;

    private final String baseUrl;

    public RegulaOneAuthClient(@Value("${regulaone.api.base-url}") String baseUrl) {
        this.baseUrl = baseUrl;
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        log.info("[RegulaOneAuthClient]:1 Initialised — auth authority base URL: {}", baseUrl);
    }

    /**
     * Resolve the caller from the incoming request's idToken cookie.
     * Throws a {@link ResponseStatusException} (never returns null) when the
     * caller cannot be authenticated or has no tenant.
     */
    public AuthenticatedUser resolve(HttpServletRequest request) {
        // log.info("[RegulaOneAuthClient] Step 1 — extracting idToken cookie from incoming request");
        String idToken = extractIdToken(request);
        if (idToken == null) {
            log.warn("[resolve]:1 No idToken cookie present → 401");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authentication session");
        }
        log.info("[resolve]:2 idToken cookie found (len={}), calling {}/api/auth/me",
                idToken.length(), baseUrl);

        MeResponse body;
        try {
            body = restClient.get()
                    .uri("/api/auth/me")
                    // Forward the idToken cookie so RegulaOne's CookieBearerTokenResolver picks it up.
                    .header(HttpHeaders.COOKIE, "idToken=" + idToken)
                    .retrieve()
                    .onStatus(status -> status.value() == 401 || status.value() == 403,
                            (req, res) -> {
                                log.warn("[resolve]:3 RegulaOne /me rejected session — HTTP {} → 401",
                                        res.getStatusCode().value());
                                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                                        "Session invalid or expired");
                            })
                    .body(MeResponse.class);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("[resolve]:4 /api/auth/me call failed — RegulaOne unreachable? → 503", e);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Authentication service is unavailable");
        }

        log.info("[resolve]:5 Step 2 — /me responded, parsing identity");
        if (body == null || body.data() == null) {
            log.warn("[resolve]:6 /me returned an empty body/data → 401");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Could not resolve authenticated user");
        }

        MeData d = body.data();
        boolean isSuperAdmin = "ROLE_SUPER_ADMIN".equals(d.role());
        if (!isSuperAdmin && (d.tenantId() == null || d.tenantId().isBlank())) {
            log.warn("[resolve]:7 User {} has no tenant → 403", d.id());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Your account is not associated with an organisation");
        }

        log.info("[resolve]:8 Step 3 — resolved userId={} tenantId={} role={} tenantStatus={}",
                d.id(), d.tenantId(), d.role(), d.tenantStatus());
        return new AuthenticatedUser(d.id(), d.email(), d.role(), d.tenantId(), d.tenantName(), d.tenantStatus());
    }

    private String extractIdToken(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("idToken".equals(cookie.getName())) {
                    String value = cookie.getValue();
                    if (value != null && !value.isBlank()) {
                        return value;
                    }
                }
            }
        }
        return null;
    }

    // Minimal projections of RegulaOne's AppResponse<UserResponse> envelope.
    // Only the fields KSeFFlow needs are mapped; everything else is ignored.
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MeResponse(boolean success, String message, MeData data) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MeData(String id, String email, String role,
                          String tenantId, String tenantName, String tenantStatus) {
    }
}
