package com.safevoice.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * A live "this case's status changed" signal, pushed to everyone viewing ONE case on
 * "/topic/case.{caseId}" — the reporter's tracking page AND any staff with the case open —
 * so the status badge/label updates instantly, with no refresh.
 *
 * It shares the case channel with chat messages, so it carries a {@code type} discriminator
 * ("CASE_UPDATE") that message payloads do not have; clients branch on it. It deliberately
 * carries ONLY the case's own lifecycle fields (status + when it was closed) — no message
 * content and no internal staff data — because the reporter also receives this channel.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseUpdateEvent {

    // Marks this frame as a case update (not a chat message). Always "CASE_UPDATE".
    @Builder.Default
    private String type = "CASE_UPDATE";

    // Which case changed (database id — matches the topic and the client's open case).
    private String caseId;

    // The new status as the backend enum NAME (e.g. "CLOSED"); the client maps it to the
    // friendly label it already uses everywhere else.
    private String status;

    // When the case was closed (ISO-8601), or null if it is open. Lets the reporter page
    // recompute the post-close reply window live.
    private String closedAt;

    // When the change happened.
    private Instant at;
}
