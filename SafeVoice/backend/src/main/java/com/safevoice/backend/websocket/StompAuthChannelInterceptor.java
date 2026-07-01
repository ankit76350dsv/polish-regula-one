package com.safevoice.backend.websocket;

import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.repository.CaseReportRepository;
import com.safevoice.backend.security.AuthenticatedUser;
import com.safevoice.backend.security.RegulaOneAuthClient;
import com.safevoice.backend.service.report.utils.CaseReportUtils;

import lombok.RequiredArgsConstructor;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * The security gate for every STOMP frame on the inbound channel.
 *
 * On CONNECT it builds a verified {@link SafeVoicePrincipal}:
 *   • Reporter — if the CONNECT frame carries an "X-Access-Key" header, we hash it and look
 *     up the matching case; the connection is pinned to that one case.
 *   • Staff    — otherwise we take the "idToken" cookie captured at handshake and ask
 *     RegulaOne /api/auth/me who it belongs to, getting back their tenant + permissions.
 * A CONNECT that satisfies neither is rejected.
 *
 * On SUBSCRIBE it authorises the destination against that principal, so a client can only
 * ever listen to its own organisation's topics (staff) or its own case (reporter). This is
 * where tenant/case isolation is enforced — never trusting anything the client claims.
 */
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String TENANT_PREFIX = "/topic/tenant.";
    private static final String CASE_PREFIX = "/topic/case.";

    private final RegulaOneAuthClient regulaOneAuthClient;
    private final CaseReportRepository caseReportRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            accessor.setUser(authenticate(accessor));
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeSubscription(accessor);
        }
        return message;
    }

    /** Build the verified principal for a CONNECT, or reject the connection. */
    private SafeVoicePrincipal authenticate(StompHeaderAccessor accessor) {
        // ── Reporter: authenticated by their case access key ──────────────────────
        String accessKey = accessor.getFirstNativeHeader("X-Access-Key");
        if (accessKey != null && !accessKey.isBlank()) {
            String keyHash = CaseReportUtils.sha256Hex(accessKey.trim());
            CaseReport report = caseReportRepository.findByKeyHash(keyHash)
                    .filter(r -> !r.isDeleted())
                    .orElseThrow(() -> new MessagingException("Invalid access key"));
            return SafeVoicePrincipal.reporter(report.getId(), report.getTenantId());
        }

        // ── Staff: authenticated by the shared "idToken" SSO cookie ───────────────
        // The cookie was captured at the handshake; we ask RegulaOne /api/auth/me who it
        // belongs to (no local token verification — RegulaOne is the source of truth).
        Object token = accessor.getSessionAttributes() != null
                ? accessor.getSessionAttributes().get(CookieHandshakeInterceptor.ID_TOKEN_ATTR)
                : null;
        if (token == null) {
            throw new MessagingException("Not authenticated: no access key and no session cookie");
        }

        AuthenticatedUser staff = regulaOneAuthClient.resolveByIdToken(token.toString())
                .orElseThrow(() -> new MessagingException(
                        "Not authenticated: session is invalid, expired, or has no organisation"));
        return SafeVoicePrincipal.staff(staff.email(), staff.tenantId(), staff.permissions());
    }

    /** Allow a SUBSCRIBE only if the destination belongs to this principal. */
    private void authorizeSubscription(StompHeaderAccessor accessor) {
        Object user = accessor.getUser();
        if (!(user instanceof SafeVoicePrincipal principal)) {
            throw new MessagingException("Not authenticated");
        }
        String destination = accessor.getDestination();
        if (destination == null) {
            throw new MessagingException("Missing destination");
        }

        // Per-user queues (e.g. /user/queue/pong) are already scoped to this connection.
        if (destination.startsWith("/user/")) {
            return;
        }

        // /topic/tenant.{tenantId}.* — staff may only watch their OWN organisation.
        if (destination.startsWith(TENANT_PREFIX)) {
            String rest = destination.substring(TENANT_PREFIX.length());
            int dot = rest.indexOf('.');
            String tenantId = dot >= 0 ? rest.substring(0, dot) : rest;
            if (principal.isStaff() && tenantId.equals(principal.getTenantId())) {
                return;
            }
            throw new MessagingException("Not allowed to subscribe to " + destination);
        }

        // /topic/case.{caseId} — reporter only their own case; staff only cases in their tenant.
        if (destination.startsWith(CASE_PREFIX)) {
            String caseId = destination.substring(CASE_PREFIX.length());
            if (principal.isReporter() && caseId.equals(principal.getCaseId())) {
                return;
            }
            if (principal.isStaff()) {
                boolean sameTenant = Optional.ofNullable(caseId)
                        .flatMap(caseReportRepository::findById)
                        .map(r -> principal.getTenantId().equals(r.getTenantId()))
                        .orElse(false);
                if (sameTenant) {
                    return;
                }
            }
            throw new MessagingException("Not allowed to subscribe to " + destination);
        }

        throw new MessagingException("Unknown destination: " + destination);
    }
}
