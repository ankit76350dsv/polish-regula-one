package com.safevoice.backend.websocket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Optional;

/**
 * Resolves a staff member by asking RegulaOne "who is this login token?".
 *
 * Just like KSeFFlow, SafeVoice does NOT re-verify Cognito tokens or read the users
 * collection itself. It forwards the shared "idToken" cookie to RegulaOne's
 * GET /api/auth/me and trusts the identity it returns. RegulaOne is the single source of
 * truth for authentication and tenant membership.
 *
 * Used by the WebSocket CONNECT auth (staff branch). Any failure — no token, expired
 * session, RegulaOne down, or a user with no organisation — simply yields an empty result,
 * and the caller rejects the connection.
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
     * Identify the staff member behind an idToken by calling RegulaOne /api/auth/me.
     *
     * @param idToken the raw value of the "idToken" cookie captured at the WS handshake
     * @return the resolved staff identity, or empty if the token is missing/invalid, the
     *         user has no organisation, or RegulaOne could not be reached.
     */
    public Optional<StaffIdentity> resolveByIdToken(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            return Optional.empty();
        }
        try {
            MeResponse body = restClient.get()
                    .uri("/api/auth/me")
                    // Forward the cookie so RegulaOne's CookieBearerTokenResolver picks it up.
                    .header(HttpHeaders.COOKIE, "idToken=" + idToken)
                    .retrieve()
                    .body(MeResponse.class);

            if (body == null || body.data() == null) {
                return Optional.empty();
            }
            MeData d = body.data();
            // A staff member must belong to an organisation for tenant-scoped subscriptions.
            if (d.tenantId() == null || d.tenantId().isBlank()) {
                log.warn("[resolveByIdToken]: user {} has no tenant — refusing socket", d.email());
                return Optional.empty();
            }
            return Optional.of(new StaffIdentity(d.email(), d.tenantId(), d.permissions()));
        } catch (RestClientException e) {
            // 401/403 (invalid/expired), 5xx, or network error → treat as not authenticated.
            log.warn("[resolveByIdToken]: /api/auth/me did not authenticate the socket: {}",
                    e.getMessage());
            return Optional.empty();
        }
    }

    /** The slice of identity SafeVoice needs for a socket: who, which org, what they may do. */
    public record StaffIdentity(String email, String tenantId, List<String> permissions) {}

    // Minimal projections of RegulaOne's AppResponse<UserResponse> envelope; ignore the rest.
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MeResponse(boolean success, String message, MeData data) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MeData(String id, String email, String role,
                          String tenantId, String tenantName, String tenantStatus,
                          List<String> permissions) {}
}
