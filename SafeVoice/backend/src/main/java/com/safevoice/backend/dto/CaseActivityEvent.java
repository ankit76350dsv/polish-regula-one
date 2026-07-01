package com.safevoice.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * A lightweight "something happened on this case" signal sent to ALL of a tenant's staff
 * (on "/topic/tenant.{tenantId}.activity"), regardless of which page they are on.
 *
 * Unlike the full chat message (which only goes to people viewing that one case), this is
 * what lets every staff member's Cases list / Inbox react live: move the case to the top
 * (most-recent-activity first, like a chat app), bump its unread badge when the reporter
 * wrote, and show a "new reply" notification for cases they do not currently have open.
 *
 * It deliberately carries NO message text — only enough to update the lists and notify.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseActivityEvent {

    // Which case had activity (the database id used by the lists).
    private String caseId;

    // The readable handle shown in a notification (e.g. "SV/2026/0629/1408").
    private String caseReference;

    // Who wrote — used only for the notification label; never message content.
    private String sender;

    // True when the reporter wrote (so staff unread badges should increase); false when a
    // staff member wrote (their own reply does not add to the staff unread count).
    private boolean fromReporter;

    // When it happened — lets clients keep "most recent first" ordering consistent.
    private Instant at;
}
