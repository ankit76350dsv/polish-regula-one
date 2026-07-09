package com.safevoice.backend.websocket;

import com.safevoice.backend.dto.CaseActivityEvent;
import com.safevoice.backend.dto.CaseSummaryResponse;
import com.safevoice.backend.model.document.CaseMessage;

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

    /**
     * Broadcast a chat message to everyone currently viewing that ONE case — the reporter
     * and any staff with the case open — so the new message appears instantly on both sides.
     * The case channel ("/topic/case.{caseId}") is locked by the WebSocket security layer to
     * that case's reporter and that case's tenant, so the message can't leak elsewhere.
     *
     * @param caseId  the case the message belongs to
     * @param message the saved message returned by the REST API
     */
    public void publishMessage(String caseId, CaseMessage message) {
        if (caseId == null || caseId.isBlank()) {
            return;
        }
        String destination = "/topic/case." + caseId;
        try {
            messagingTemplate.convertAndSend(destination, message);
        } catch (Exception e) {
            // Never break sending the message because the live broadcast could not be sent;
            // the message is already saved and will appear on the next load.
            log.warn("[CaseEventPublisher] failed to publish message to {}: {}",
                    destination, e.getMessage());
        }
    }

    /**
     * Tell ALL of a tenant's staff that a case just had activity (a message), so their
     * Cases list / Inbox can move it to the top, update its unread badge, and show a "new
     * reply" notification — even if they are not viewing that case. Goes to the tenant-wide
     * activity channel, which only that tenant's staff are allowed to listen to.
     */
    public void publishActivity(String tenantId, CaseActivityEvent event) {
        if (tenantId == null || tenantId.isBlank()) {
            return;
        }
        String destination = "/topic/tenant." + tenantId + ".activity";
        try {
            messagingTemplate.convertAndSend(destination, event);
        } catch (Exception e) {
            log.warn("[CaseEventPublisher] failed to publish activity to {}: {}",
                    destination, e.getMessage());
        }
    }
}
