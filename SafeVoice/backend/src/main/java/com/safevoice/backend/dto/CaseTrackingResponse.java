package com.safevoice.backend.dto;

import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * What the reporter gets back when they look up their case with the access key:
 * the full case record plus the secure two-way message thread. This matches the
 * shape the tracking page expects: { report, messages }.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseTrackingResponse {

    // The case record (status, timeline, dates, attachments, etc.).
    private CaseReport report;

    // The chat thread between the reporter and the compliance team, oldest first.
    private List<CaseMessage> messages;
}
