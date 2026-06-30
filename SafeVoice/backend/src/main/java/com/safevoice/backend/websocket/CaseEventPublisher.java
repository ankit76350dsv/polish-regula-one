package com.safevoice.backend.websocket;

import com.safevoice.backend.dto.CaseSummaryResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Pushes case-related events out over WebSocket.
 *
 * This is the "announcer": when something happens to a case, it tells the right group of
 * connected browsers. Each organisation has its own channel ("/topic/tenant.{tenantId}.…")
 * and the WebSocket security layer only lets that organisation's staff listen to it, so an
 * event for one company can never reach another.
 *
 * Publishing is best-effort: if no one is listening (or messaging hiccups), the underlying
 * action (e.g. saving the report) has already succeeded and must not be undone, so we never
 * let a publish failure bubble up.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CaseEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Announce that a NEW case has arrived for an organisation. Goes to every staff member
     * of that tenant who is connected, on any page, so their Cases list / Inbox can update
     * live and show a notification.
     *
     * @param tenantId the organisation the case belongs to
     * @param summary  the slim case summary (same shape the case list already uses)
     */
    public void publishNewCase(String tenantId, CaseSummaryResponse summary) {
        if (tenantId == null || tenantId.isBlank()) {
            return;
        }
        String destination = "/topic/tenant." + tenantId + ".cases";
        try {
            messagingTemplate.convertAndSend(destination, summary);
        } catch (Exception e) {
            // Never break the report submission because a live notification could not be sent.
            log.warn("[CaseEventPublisher] failed to publish new case to {}: {}",
                    destination, e.getMessage());
        }
    }
}
