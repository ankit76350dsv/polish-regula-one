package com.safevoice.backend.websocket;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;

/**
 * Phase-0 connectivity check. A client sends to "/app/ping" and gets a reply on its private
 * "/user/queue/pong" destination. The reply echoes back WHO the server thinks the caller is
 * (kind + tenant), which proves the whole pipeline works end to end: handshake → CONNECT
 * authentication → principal → per-user routing. It carries no sensitive data and will be
 * removed once the real features land.
 */
@Controller
public class PingController {

    public record PongResponse(String message, String kind, String tenantId, String at) {}

    @MessageMapping("/ping")
    @SendToUser("/queue/pong")
    public PongResponse ping(Principal principal) {
        if (principal instanceof SafeVoicePrincipal p) {
            return new PongResponse("pong", p.getKind().name(), p.getTenantId(), Instant.now().toString());
        }
        // Should not happen — CONNECT is rejected when unauthenticated — but be safe.
        return new PongResponse("pong", "UNKNOWN", null, Instant.now().toString());
    }
}
