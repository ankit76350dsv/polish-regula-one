package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Request body for submitting a new whistleblower report.
 *
 * The field names here mirror EXACTLY what the public web form sends, so the
 * frontend and backend speak the same language with no translation layer in the
 * browser. The form posts:
 *
 *   {
 *     "tenantId":       "acme-sp-z-o-o" | null,   // which organisation (optional)
 *     "category":       "Corruption",             // a visible category label
 *     "incidentDate":   "2026-06-20",             // calendar date (YYYY-MM-DD)
 *     "area":           "Warehouse, Gdansk",      // where it happened
 *     "facts":          "On 20 June I saw ...",   // the description of what happened
 *     "channel":        "written" | "oral",       // how the reporter wants to report
 *     "requestMeeting": true | false,             // wants an in-person meeting (Art. 9(2))
 *     "attachments":    [{ "displayName": "...", "sizeLabel": "..." }]
 *   }
 *
 * The service layer translates these plain values into the system's strong types
 * (enums, Instant, EvidenceAttachment) — never the browser.
 */
@Data
public class CaseSubmissionRequest {

    // Which organisation the report belongs to. Required: every report must name a
    // real, registered organisation, and the server checks it exists before accepting.
    @NotBlank(message = "Tenant id is required")
    private String tenantId;

    // The visible category label chosen in the form (e.g. "Fraud").
    @NotBlank(message = "Report category is required")
    private String category;

    // The date the incident happened, as a calendar date string "YYYY-MM-DD".
    // Optional so the reporter is never blocked if they cannot recall an exact date.
    private String incidentDate;

    // Free-text location/area where the incident took place. Stored as "department".
    private String area;

    // The actual description of what happened. This is the heart of the report.
    @NotBlank(message = "A description of the facts is required")
    private String facts;

    // How the reporter wants to communicate: "written" (default) or "oral".
    private String channel;

    // True if the reporter is exercising their legal right to request a face-to-face meeting.
    private boolean requestMeeting;

    // Metadata about uploaded evidence files. We keep ONLY the display name and a
    // human size label — no IP, device, or other tracking data — to protect anonymity.
    private List<AttachmentMetadata> attachments = new ArrayList<>();

    /**
     * Lightweight description of one uploaded evidence file. We deliberately store
     * just the name and a size label so nothing about the reporter's device leaks.
     */
    @Data
    public static class AttachmentMetadata {
        private String displayName;
        private String sizeLabel;
    }
}
